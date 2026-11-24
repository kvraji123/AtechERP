import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProcessMasters } from "../../api/part.api";
import { useAppFeedback } from "../../components/AppFeedback";
import PartProcessPlanEditor, { blankProcessPlan,
  type InspectionPrintContext, type ProcessOperationRow, type ProcessPlanForm, type ProcessPlanSaveOptions } from "./PartProcessPlanEditor";

const sharedFields: Array<keyof ProcessOperationRow> = [
  "operationMasterId", "operationDescription", "sourceType", "machineTypeId",
  "cycleTimeSeconds", "clampingTimeSeconds", "settingTimeHours", "outsourceCostInr",
  "processCostInr", "toolList", "program", "programNumber", "documentApprovals", "instructionAttachments",
];

function sharedFieldValue(field: keyof ProcessOperationRow, value: ProcessOperationRow[keyof ProcessOperationRow]) {
  if (field !== "instructionAttachments" || !Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(value.map((attachment) => ({
    attachmentId: attachment.attachmentId,
    attachmentName: attachment.attachmentName,
    fileName: attachment.fileName,
    file: attachment.file ? {
      name: attachment.file.name,
      size: attachment.file.size,
      lastModified: attachment.file.lastModified,
    } : null,
  })));
}

function definitionChanged(previous: ProcessOperationRow, next: ProcessOperationRow) {
  return sharedFields.some((field) => sharedFieldValue(field, previous[field]) !== sharedFieldValue(field, next[field]));
}

export default function PartProcessPlanVariantsEditor({
  value, onChange, masters, printContext, onSaveInspection, saving, canApproveDocuments = false, readOnly = false,
}: {
  value: ProcessPlanForm[];
  onChange: (next: ProcessPlanForm[]) => void;
  masters: ProcessMasters;
  printContext: InspectionPrintContext;
  onSaveInspection: (nextPlans?: ProcessPlanForm[], options?: ProcessPlanSaveOptions) => Promise<boolean>;
  saving: boolean;
  canApproveDocuments?: boolean;
  readOnly?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { confirmDelete } = useAppFeedback();
  const safeIndex = Math.min(activeIndex, Math.max(value.length - 1, 0));
  const activePlan = value[safeIndex];
  const usage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const plan of value) for (const operation of plan.operations) {
      if (operation.processDefinitionId) counts.set(operation.processDefinitionId,
        (counts.get(operation.processDefinitionId) || 0) + 1);
    }
    return counts;
  }, [value]);

  const withUsage = (plan: ProcessPlanForm): ProcessPlanForm => ({ ...plan,
    operations: plan.operations.map((operation) => ({ ...operation,
      sharedVariantCount: operation.processDefinitionId
        ? usage.get(operation.processDefinitionId) || 1 : 1,
    })),
  });

  const addVariant = () => {
    const next = blankProcessPlan();
    next.routeName = `Route ${value.length + 1}`;
    next.isDefault = value.length === 0;
    onChange([...value,next]);
    setActiveIndex(value.length);
  };

  const cloneVariant = () => {
    if (!activePlan) return;
    const cloned: ProcessPlanForm = {
      ...activePlan,processPlanId:undefined,planCode:"",routeName:`${activePlan.routeName} Copy`,
      planStatus:"DRAFT",isDefault:false,activeFlag:"Y",
      operations:activePlan.operations.map((operation) => ({ ...operation,
        processOperationId:undefined,
        processDefinitionId:undefined,
        processDefinitionCode:undefined,
        sharedVariantCount:1,
        // Work instructions belong to the source operation. The cloned
        // operation starts independently, so attach its own instructions.
        instructionAttachments:[],
        inspectionPlan:operation.inspectionPlan ? { ...operation.inspectionPlan,
          inspectionPlanId:undefined,
          planStatus:"DRAFT",
          characteristics:operation.inspectionPlan.characteristics.map((row) => ({
            ...row,inspectionCharacteristicId:undefined,
          })),
        } : null,
      })),
    };
    onChange([...value,cloned]);
    setActiveIndex(value.length);
  };

  const deleteVariant = async () => {
    if (!activePlan) return;
    const retainedForHistory = Boolean(activePlan.processPlanId && activePlan.planStatus === "APPROVED");
    const message = retainedForHistory
      ? `Delete ${activePlan.planCode || activePlan.routeName}? Approved variants are retained for history and will be deactivated.`
      : `Delete ${activePlan.planCode || activePlan.routeName}? This variant will be removed when the Part is saved.`;
    if (!await confirmDelete({
      title: "Delete Process Plan Variant?",
      message,
      confirmLabel: retainedForHistory ? "Deactivate Variant" : "Delete Variant",
    })) return;

    if (retainedForHistory) {
      const remainingActive = value.findIndex((plan,index) => index !== safeIndex && plan.activeFlag === "Y");
      onChange(value.map((plan,index) => {
        if (index === safeIndex) return { ...plan,activeFlag:"N",isDefault:false };
        if (activePlan.isDefault && index === remainingActive) return { ...plan,isDefault:true };
        return plan;
      }));
      return;
    }

    const remaining = value.filter((_,index) => index !== safeIndex);
    if (activePlan.isDefault && remaining.length && !remaining.some((plan) => plan.isDefault && plan.activeFlag === "Y")) {
      const defaultIndex = remaining.findIndex((plan) => plan.activeFlag === "Y");
      if (defaultIndex >= 0) remaining[defaultIndex] = { ...remaining[defaultIndex],isDefault:true };
    }
    onChange(remaining);
    setActiveIndex(Math.max(0,Math.min(safeIndex,remaining.length - 1)));
  };

  const updateMetadata = (patch: Partial<ProcessPlanForm>) => {
    onChange(value.map((plan,index) => index === safeIndex
      ? { ...plan,...patch,planStatus:patch.planStatus || "DRAFT" }
      : patch.isDefault ? { ...plan,isDefault:false } : plan));
  };

  const updateActivePlan = (nextPlan: ProcessPlanForm) => {
    if (!activePlan) return;
    const operations = nextPlan.operations.map((nextOperation) => {
      const previous = activePlan.operations.find((operation) =>
        nextOperation.processOperationId && operation.processOperationId === nextOperation.processOperationId)
        || activePlan.operations.find((operation) => nextOperation.processDefinitionId
          && operation.processDefinitionId === nextOperation.processDefinitionId);
      const wasShared = previous?.processDefinitionId
        && (usage.get(previous.processDefinitionId) || 1) > 1;

      // Older variants may still share a stored definition. On the first
      // edit, detach this operation instead of changing another variant.
      return wasShared && definitionChanged(previous, nextOperation)
        ? { ...nextOperation, processDefinitionId: undefined, processDefinitionCode: undefined, sharedVariantCount: 1 }
        : nextOperation;
    });
    onChange(value.map((plan,planIndex) => planIndex === safeIndex
      ? { ...nextPlan, operations }
      : plan));
  };

  if (!activePlan) return <section className="process-variant-empty">
    <h3>Process Plan Variants</h3><p>Add the first capacity-specific route for this Part.</p>
    {!readOnly && <button type="button" className="primary-action-button" onClick={addVariant}><Plus size={16}/>New Variant</button>}
  </section>;

  return <section className="process-variants-panel">
    <header className="process-variants-heading"><div><h3>Process Plan Variants</h3>
      <p>Each variant has its own independent process operations.</p></div>
      {!readOnly && <button type="button" className="marketing-add-line-button" onClick={addVariant}><Plus size={15}/>New Variant</button>}
    </header>
    <div className="process-variant-tabs" role="tablist" aria-label="Process Plan Variants">
      {value.map((plan,index) => <button type="button" role="tab" aria-selected={index === safeIndex}
        className={`process-variant-tab ${index === safeIndex ? "active" : ""} ${plan.activeFlag === "N" ? "inactive" : ""}`}
        key={plan.processPlanId ?? `variant-${index}`} onClick={() => setActiveIndex(index)}>
        <strong>{plan.planCode || `NEW-${index + 1}`} · {plan.routeName}</strong>
        <span>{plan.productionCapacityPerDay || "0"}/day · {plan.planStatus}{plan.isDefault ? " · DEFAULT" : ""}</span>
      </button>)}
    </div>
    <div className="process-variant-toolbar">
      <label>Route Name<input value={activePlan.routeName} readOnly={readOnly || activePlan.activeFlag === "N"}
        onChange={(event) => updateMetadata({ routeName:event.target.value })}/></label>
      <label className="process-variant-default"><input type="checkbox" checked={activePlan.isDefault}
        disabled={readOnly || activePlan.activeFlag === "N"} onChange={(event) => updateMetadata({ isDefault:event.target.checked })}/>Default variant</label>
      {!readOnly && <div className="process-variant-actions"><button type="button" className="secondary-action-button" onClick={cloneVariant}><CopyPlus size={15}/>Clone Variant</button>
        <button type="button" className="process-variant-delete-button" disabled={activePlan.activeFlag === "N"}
          onClick={() => void deleteVariant()}><Trash2 size={15}/>Delete Variant</button></div>}
    </div>
    <PartProcessPlanEditor value={withUsage(activePlan)} onChange={updateActivePlan} masters={masters}
      printContext={printContext} onSaveInspection={(updatedPlan, options) => {
        if (!updatedPlan) return onSaveInspection(undefined, options);
        return onSaveInspection(value.map((plan, index) => index === safeIndex ? updatedPlan : plan), options);
      }} saving={saving} canApproveDocuments={canApproveDocuments}
      readOnly={readOnly || activePlan.activeFlag === "N"}/>
  </section>;
}
