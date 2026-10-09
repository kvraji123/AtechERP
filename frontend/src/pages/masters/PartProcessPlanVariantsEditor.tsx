import { CopyPlus, Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProcessMasters } from "../../api/part.api";
import PartProcessPlanEditor, { blankProcessPlan,
  type ProcessOperationRow, type ProcessPlanForm } from "./PartProcessPlanEditor";

const sharedFields: Array<keyof ProcessOperationRow> = [
  "operationMasterId", "operationDescription", "sourceType", "machineTypeId",
  "cycleTimeSeconds", "clampingTimeSeconds", "settingTimeHours", "outsourceCostInr",
  "processCostInr",
];

function definitionChanged(previous: ProcessOperationRow, next: ProcessOperationRow) {
  return sharedFields.some((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
}

function definitionValues(source: ProcessOperationRow) {
  return Object.fromEntries(sharedFields.map((field) => [field, source[field]])) as Partial<ProcessOperationRow>;
}

export default function PartProcessPlanVariantsEditor({
  value, onChange, masters, onSaveInspection, saving, readOnly = false,
}: {
  value: ProcessPlanForm[];
  onChange: (next: ProcessPlanForm[]) => void;
  masters: ProcessMasters;
  onSaveInspection: () => Promise<boolean>;
  saving: boolean;
  readOnly?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
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

  const deleteVariant = () => {
    if (!activePlan) return;
    const retainedForHistory = Boolean(activePlan.processPlanId && activePlan.planStatus === "APPROVED");
    const message = retainedForHistory
      ? `Delete ${activePlan.planCode || activePlan.routeName}? Approved variants are retained for history and will be deactivated.`
      : `Delete ${activePlan.planCode || activePlan.routeName}? This variant will be removed when the Part is saved.`;
    if (!window.confirm(message)) return;

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
    const changedDefinitions = new Map<number,ProcessOperationRow>();
    for (const nextOperation of nextPlan.operations) {
      if (!nextOperation.processDefinitionId) continue;
      const previous = activePlan.operations.find((operation) =>
        operation.processDefinitionId === nextOperation.processDefinitionId);
      if (previous && definitionChanged(previous,nextOperation)) {
        changedDefinitions.set(nextOperation.processDefinitionId,nextOperation);
      }
    }
    onChange(value.map((plan,planIndex) => {
      const base = planIndex === safeIndex ? nextPlan : plan;
      let affected = planIndex === safeIndex;
      const operations = base.operations.map((operation) => {
        if (!operation.processDefinitionId) return operation;
        const changed = changedDefinitions.get(operation.processDefinitionId);
        if (!changed) return operation;
        affected = true;
        return { ...operation,...definitionValues(changed) };
      });
      return affected ? { ...base,operations,planStatus:"DRAFT" as const } : base;
    }));
  };

  if (!activePlan) return <section className="process-variant-empty">
    <h3>Process Plan Variants</h3><p>Add the first capacity-specific route for this Part.</p>
    {!readOnly && <button type="button" className="primary-action-button" onClick={addVariant}><Plus size={16}/>New Variant</button>}
  </section>;

  return <section className="process-variants-panel">
    <header className="process-variants-heading"><div><h3>Process Plan Variants</h3>
      <p>Shared Process references update every linked variant.</p></div>
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
      <span className="process-shared-notice"><Link2 size={14}/>Editing a shared Process ID updates all linked variants.</span>
      {!readOnly && <div className="process-variant-actions"><button type="button" className="secondary-action-button" onClick={cloneVariant}><CopyPlus size={15}/>Clone Variant</button>
        <button type="button" className="process-variant-delete-button" disabled={activePlan.activeFlag === "N"}
          onClick={deleteVariant}><Trash2 size={15}/>Delete Variant</button></div>}
    </div>
    <PartProcessPlanEditor value={withUsage(activePlan)} onChange={updateActivePlan} masters={masters}
      onSaveInspection={onSaveInspection} saving={saving} readOnly={readOnly || activePlan.activeFlag === "N"}/>
  </section>;
}
