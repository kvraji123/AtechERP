import { ClipboardCheck, CopyPlus, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ProcessMasters } from "../../api/part.api";

export type InspectionCharacteristicRow = {
  inspectionCharacteristicId?: number;
  balloonNumber: string;
  characteristicMasterId: string;
  characteristicText: string;
  characteristicSearch: string;
  specifiedDimension: string;
  toleranceMode: "GRADE" | "MANUAL" | "NOT_APPLICABLE";
  toleranceGradeId: string;
  toleranceGradeText: string;
  toleranceMinus: string;
  tolerancePlus: string;
  lsl: string;
  usl: string;
  drawingGrid: string;
  instrumentMasterId: string;
  sampleSize: string;
  inspectionFrequency: string;
  scCcIdentification: boolean;
  periodicOperatorRequired: boolean;
  finalInspectionRequired: boolean;
};

export type ProcessOperationRow = {
  processOperationId?: number;
  processDefinitionId?: number;
  processDefinitionCode?: string;
  sharedVariantCount?: number;
  operationNumber: string;
  operationMasterId: string;
  operationDescription: string;
  sourceType: "INHOUSE" | "OUTSOURCE";
  machineTypeId: string;
  cycleTimeSeconds: string;
  clampingTimeSeconds: string;
  settingTimeHours: string;
  outsourceCostInr: string;
  processCostInr: string;
  inspectionPlan: null | {
    inspectionPlanId?: number;
    planStatus: "DRAFT" | "READY";
    cmmRequired: boolean;
    characteristics: InspectionCharacteristicRow[];
  };
};

export type ProcessPlanForm = {
  processPlanId?: number;
  planCode: string;
  routeName: string;
  drawingRevisionNumber: string;
  productionCapacityPerDay: string;
  planStatus: "DRAFT" | "APPROVED";
  isDefault: boolean;
  activeFlag: "Y" | "N";
  operations: ProcessOperationRow[];
};

export const blankProcessPlan = (): ProcessPlanForm => ({
  planCode: "",
  routeName: "Default Route",
  drawingRevisionNumber: "",
  productionCapacityPerDay: "",
  planStatus: "DRAFT",
  isDefault: true,
  activeFlag: "Y",
  operations: [],
});

const blankCharacteristic = (): InspectionCharacteristicRow => ({
  balloonNumber: "",
  characteristicMasterId: "",
  characteristicText: "",
  characteristicSearch: "",
  specifiedDimension: "",
  toleranceMode: "MANUAL",
  toleranceGradeId: "",
  toleranceGradeText: "",
  toleranceMinus: "",
  tolerancePlus: "",
  lsl: "",
  usl: "",
  drawingGrid: "",
  instrumentMasterId: "",
  sampleSize: "",
  inspectionFrequency: "",
  scCcIdentification: false,
  periodicOperatorRequired: false,
  finalInspectionRequired: false,
});

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumeric(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: string | number) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function inspectionChecksComplete(rows: InspectionCharacteristicRow[]) {
  return rows.length > 0 && rows.every((entry) =>
    entry.scCcIdentification
    && entry.periodicOperatorRequired
    && entry.finalInspectionRequired);
}

export default function PartProcessPlanEditor({
  value,
  onChange,
  masters,
  onSaveInspection,
  saving,
  readOnly = false,
}: {
  value: ProcessPlanForm;
  onChange: (next: ProcessPlanForm) => void;
  masters: ProcessMasters;
  onSaveInspection: () => Promise<boolean>;
  saving: boolean;
  readOnly?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const allProcessesReady = value.operations.length > 0
    && value.operations.every((row) => row.inspectionPlan?.planStatus === "READY");

  const costingMode = (sourceCode: string) => masters.sources
    .find((entry) => entry.sourceCode === sourceCode)?.costingMode
    || (sourceCode === "OUTSOURCE" ? "OUTSOURCE" : "INHOUSE");
  const isOutsource = (row: ProcessOperationRow) => costingMode(row.sourceType) === "OUTSOURCE";
  const calculatedCost = (row: ProcessOperationRow) => {
    const machineType = masters.machineTypes.find((entry) => String(entry.machineTypeId) === row.machineTypeId);
    return isOutsource(row)
      ? numeric(row.outsourceCostInr)
      : (Number(machineType?.hourlyCostInr || 0)
        * (numeric(row.cycleTimeSeconds) + numeric(row.clampingTimeSeconds))) / 3600;
  };

  const updateOperation = (index: number, field: keyof ProcessOperationRow, fieldValue: any) => {
    const operations = value.operations.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      let updated = { ...row, [field]: fieldValue };
      if (field === "sourceType") {
        updated = costingMode(fieldValue) === "OUTSOURCE"
          ? { ...updated, machineTypeId: "", cycleTimeSeconds: "", clampingTimeSeconds: "", settingTimeHours: "" }
          : { ...updated, outsourceCostInr: "" };
      }
      if (["sourceType", "machineTypeId", "cycleTimeSeconds", "clampingTimeSeconds", "outsourceCostInr"].includes(String(field))) {
        updated = { ...updated, processCostInr: calculatedCost(updated).toFixed(2) };
      }
      return updated;
    });
    if (field === "sourceType" && costingMode(fieldValue) === "INHOUSE") {
      operations[index] = { ...operations[index], processCostInr: calculatedCost(operations[index]).toFixed(2) };
    }
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const resequenceOperations = (operations: ProcessOperationRow[]) => operations.map((operation, index) => ({
    ...operation,
    operationNumber: String((index + 1) * 10),
  }));

  const addOperation = () => onChange({
    ...value,
    planStatus: "DRAFT",
    operations: resequenceOperations([...value.operations, {
      operationNumber: "",
      operationMasterId: "",
      operationDescription: "",
      sourceType: (masters.sources[0]?.sourceCode || "INHOUSE") as "INHOUSE" | "OUTSOURCE",
      machineTypeId: "",
      cycleTimeSeconds: "",
      clampingTimeSeconds: "",
      settingTimeHours: "",
      outsourceCostInr: "",
      processCostInr: "0.00",
      inspectionPlan: null,
    }]),
  });

  const cloneOperation = (rowIndex: number) => {
    const source = value.operations[rowIndex];
    if (!source) return;

    const cloned: ProcessOperationRow = {
      ...source,
      processOperationId: undefined,
      processDefinitionId: undefined,
      processDefinitionCode: undefined,
      sharedVariantCount: 1,
      operationNumber: "",
      inspectionPlan: source.inspectionPlan ? {
        ...source.inspectionPlan,
        inspectionPlanId: undefined,
        planStatus: "DRAFT",
        characteristics: source.inspectionPlan.characteristics.map((characteristic) => ({
          ...characteristic,
          inspectionCharacteristicId: undefined,
        })),
      } : null,
    };
    const operations = [...value.operations];
    operations.splice(rowIndex + 1, 0, cloned);
    onChange({ ...value, operations: resequenceOperations(operations), planStatus: "DRAFT" });
  };

  const configure = (index: number) => {
    if (!value.operations[index].inspectionPlan) {
      if (readOnly) return;
      updateOperation(index, "inspectionPlan", { planStatus: "DRAFT", cmmRequired: false, characteristics: [blankCharacteristic()] });
    }
    setActiveIndex(index);
  };

  const matchingToleranceGrade = (row: InspectionCharacteristicRow) => {
    const gradeText = row.toleranceGradeText.trim().toUpperCase();
    const dimension = optionalNumeric(row.specifiedDimension);
    if (!gradeText || dimension === null) return undefined;
    return masters.toleranceGrades.find((entry) =>
      entry.gradeCode.trim().toUpperCase() === gradeText
      && (Number(entry.basicSizeFrom) === 0 ? dimension >= 0 : dimension > Number(entry.basicSizeFrom))
      && dimension <= Number(entry.basicSizeTo));
  };

  const updateCharacteristic = (rowIndex: number, field: keyof InspectionCharacteristicRow, fieldValue: any) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;
    const characteristics = operation.inspectionPlan.characteristics.map((row, index) =>
      index === rowIndex ? { ...row, [field]: fieldValue } : row);
    let row = characteristics[rowIndex];
    if (["specifiedDimension", "toleranceGradeText", "toleranceMinus", "tolerancePlus"].includes(String(field))) {
      const dimension = optionalNumeric(row.specifiedDimension);
      const grade = matchingToleranceGrade(row);
      if (grade && dimension !== null) {
        row = {
          ...row,
          toleranceMode: "GRADE",
          toleranceGradeId: String(grade.toleranceGradeId),
          toleranceMinus: String(Math.abs(Number(grade.lowerDeviationMicrons)) / 1000),
          tolerancePlus: String(Number(grade.upperDeviationMicrons) / 1000),
          lsl: (dimension + Number(grade.lowerDeviationMicrons) / 1000).toFixed(4),
          usl: (dimension + Number(grade.upperDeviationMicrons) / 1000).toFixed(4),
        };
      } else {
        const toleranceMinus = optionalNumeric(row.toleranceMinus);
        const tolerancePlus = optionalNumeric(row.tolerancePlus);
        row = {
          ...row,
          toleranceMode: "MANUAL",
          toleranceGradeId: "",
          lsl: dimension !== null && toleranceMinus !== null ? (dimension - toleranceMinus).toFixed(4) : "",
          usl: dimension !== null && tolerancePlus !== null ? (dimension + tolerancePlus).toFixed(4) : "",
        };
      }
      characteristics[rowIndex] = row;
    }
    const inspectionPlan = {
      ...operation.inspectionPlan,
      planStatus: inspectionChecksComplete(characteristics) ? "READY" as const : "DRAFT" as const,
      characteristics,
    };
    const operations = value.operations.map((entry, index) => index === activeIndex ? { ...entry, inspectionPlan } : entry);
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const updateCharacteristicSearch = (rowIndex: number, searchText: string) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;
    const normalized = searchText.trim().toUpperCase();
    const match = masters.characteristics.find((entry) =>
      entry.characteristicName.trim().toUpperCase() === normalized
      || entry.characteristicCode.trim().toUpperCase() === normalized);
    const characteristics = operation.inspectionPlan.characteristics.map((row, index) => index === rowIndex
      ? {
          ...row,
          characteristicSearch: searchText,
          characteristicMasterId: match ? String(match.characteristicMasterId) : "",
          characteristicText: match ? "" : searchText.trim(),
        }
      : row);
    const inspectionPlan = {
      ...operation.inspectionPlan,
      planStatus: inspectionChecksComplete(characteristics) ? "READY" as const : "DRAFT" as const,
      characteristics,
    };
    onChange({
      ...value,
      operations: value.operations.map((entry, index) => index === activeIndex ? { ...entry, inspectionPlan } : entry),
      planStatus: "DRAFT",
    });
  };

  const cloneCharacteristic = (rowIndex: number) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;

    const source = operation.inspectionPlan.characteristics[rowIndex];
    if (!source) return;

    const cloned: InspectionCharacteristicRow = {
      ...source,
      inspectionCharacteristicId: undefined,
      balloonNumber: "",
    };
    const characteristics = [...operation.inspectionPlan.characteristics];
    characteristics.splice(rowIndex + 1, 0, cloned);
    const inspectionPlan = {
      ...operation.inspectionPlan,
      planStatus: "DRAFT" as const,
      characteristics,
    };
    const operations = value.operations.map((entry, index) =>
      index === activeIndex ? { ...entry, inspectionPlan } : entry);
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const activeOperation = activeIndex === null ? null : value.operations[activeIndex];
  const toleranceGradeCodes = Array.from(new Set(masters.toleranceGrades.map((entry) => entry.gradeCode)));

  return <div className="part-process-panel">
    <div className="part-process-header">
      <div><h3>Process Plan</h3><p>Configure operation sequence and operation-wise inspection acceptance.</p></div>
      <div className="part-process-summary">
        <label>Production Capacity / Day<input type="number" min="0" step="0.001" value={value.productionCapacityPerDay} readOnly={readOnly}
          onChange={(event) => onChange({ ...value, productionCapacityPerDay: event.target.value, planStatus: "DRAFT" })}/></label>
        <span className={`part-process-status ${value.planStatus.toLowerCase()}`}>{value.planStatus}</span>
        {!readOnly && <button type="button" className="marketing-add-line-button" onClick={addOperation}><Plus size={15}/>Add Process</button>}
      </div>
    </div>

    <div className="part-process-table-wrap"><table className="part-process-table">
      <thead><tr><th className="process-clone-column" aria-label="Clone process row"/><th>Op. No.</th><th>Process Ref.</th><th>Operation Name</th><th>Description</th><th>Source</th><th>Machine Type</th><th>Cycle Time (Sec)</th><th>Clamping (Sec)</th><th>Setting (Hrs)</th><th>Process Cost</th><th>Inspection Plan</th><th/></tr></thead>
      <tbody>
        {!value.operations.length && <tr><td colSpan={13} className="part-process-empty">No process added. Click Add Process to begin.</td></tr>}
        {value.operations.map((row, index) => {
          return <tr key={row.processOperationId ?? `process-${index}`}>
            <td data-label="Clone" className="process-clone-column">{!readOnly && <button type="button" className="process-operation-clone-button" title={`Clone process row ${index + 1}`} aria-label={`Clone process row ${index + 1}`} onClick={() => cloneOperation(index)}><CopyPlus size={15}/></button>}</td>
            <td data-label="Op. No."><input className="small readonly" type="number" value={row.operationNumber} readOnly/></td>
            <td data-label="Process Ref."><span className={`process-definition-reference ${(row.sharedVariantCount || 1) > 1 ? "shared" : "custom"}`} title={(row.sharedVariantCount || 1) > 1 ? `Shared by ${row.sharedVariantCount} variants` : "Used only in this variant"}>{row.processDefinitionCode || "NEW"}<small>{(row.sharedVariantCount || 1) > 1 ? `Shared ×${row.sharedVariantCount}` : "Custom"}</small></span></td>
            <td data-label="Operation Name"><select value={row.operationMasterId} disabled={readOnly} onChange={(e) => {
              const master = masters.operations.find((entry) => String(entry.operationMasterId) === e.target.value);
              const nextSource = (master?.defaultSource || masters.sources[0]?.sourceCode || "INHOUSE") as "INHOUSE" | "OUTSOURCE";
              const operations = value.operations.map((entry, rowIndex) => {
                if (rowIndex !== index) return entry;
                let next = { ...entry, operationMasterId: e.target.value, sourceType: nextSource };
                next = costingMode(nextSource) === "OUTSOURCE"
                  ? { ...next, machineTypeId: "", cycleTimeSeconds: "", clampingTimeSeconds: "", settingTimeHours: "" }
                  : { ...next, outsourceCostInr: "" };
                return { ...next, processCostInr: calculatedCost(next).toFixed(2) };
              });
              onChange({ ...value, operations, planStatus: "DRAFT" });
            }}><option value="">Select</option>{masters.operations.map((entry) => <option key={entry.operationMasterId} value={entry.operationMasterId}>{entry.operationName}</option>)}</select></td>
            <td data-label="Description"><input value={row.operationDescription} readOnly={readOnly} onChange={(e) => updateOperation(index, "operationDescription", e.target.value)} placeholder="Operation details"/></td>
            <td data-label="Source"><select value={row.sourceType} disabled title="Source is controlled by Operation Name Master"><option value="">Select source</option>{masters.sources.map((source) => <option key={source.sourceCode} value={source.sourceCode}>{source.sourceName}</option>)}</select></td>
            <td data-label="Machine Type">{!isOutsource(row) ? <select value={row.machineTypeId} disabled={readOnly} onChange={(e) => updateOperation(index, "machineTypeId", e.target.value)}><option value="">Select Machine Type</option>{masters.machineTypes.map((entry) => <option key={entry.machineTypeId} value={entry.machineTypeId}>{entry.machineTypeCode} - {entry.machineTypeName} (INR {Number(entry.hourlyCostInr || 0).toFixed(2)}/hr)</option>)}</select> : <input value="Not applicable" disabled/>}</td>
            <td data-label="Cycle Time (Sec)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" value={row.cycleTimeSeconds} onChange={(e) => updateOperation(index, "cycleTimeSeconds", e.target.value)}/></td>
            <td data-label="Clamping (Sec)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" value={row.clampingTimeSeconds} onChange={(e) => updateOperation(index, "clampingTimeSeconds", e.target.value)}/></td>
            <td data-label="Setting (Hrs)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" step="0.01" value={row.settingTimeHours} onChange={(e) => updateOperation(index, "settingTimeHours", e.target.value)}/></td>
            <td data-label="Process Cost">{isOutsource(row) ? <input type="number" min="0" step="0.01" value={row.outsourceCostInr} readOnly={readOnly} onChange={(e) => updateOperation(index, "outsourceCostInr", e.target.value)} placeholder="Enter outsource cost"/> : <strong>{money(calculatedCost(row))}</strong>}</td>
            <td data-label="Inspection Plan"><div className="operation-sequence-control"><button type="button" disabled={readOnly && !row.inspectionPlan} className={`inspection-configure ${row.inspectionPlan?.planStatus.toLowerCase() || ""}`} onClick={() => configure(index)}><ClipboardCheck size={15}/>{row.inspectionPlan ? (readOnly ? `View ${row.inspectionPlan.planStatus}` : row.inspectionPlan.planStatus) : "Not Configured"}</button></div></td>
            <td data-label="Actions">{!readOnly && <button type="button" className="marketing-delete-line-button" onClick={() => onChange({ ...value, operations: resequenceOperations(value.operations.filter((_, i) => i !== index)), planStatus: "DRAFT" })}><Trash2 size={15}/></button>}</td>
          </tr>;
        })}
      </tbody>
      {!!value.operations.length && <tfoot><tr className="part-process-total-row">
        <td className="part-process-total-message" colSpan={9}>{!allProcessesReady && <small>Complete all required inspection checks for every operation before approving the Process Plan.</small>}</td>
        <td className="part-process-total-label">Total Process Cost</td>
        <td className="part-process-total-value"><strong>{money(value.operations.reduce((sum, row) => sum + calculatedCost(row), 0))}</strong></td>
        <td colSpan={2}>{!readOnly && <button type="button" className="primary-action-button" disabled={!allProcessesReady} title={allProcessesReady ? "Approve Process Plan" : "All processes must be READY before approval"} onClick={() => {
          if (window.confirm("Approve this Process Plan Variant? All linked Inspection Plans are ready. Save the Part to complete the approval.")) {
            onChange({ ...value, planStatus: "APPROVED" });
          }
        }}>Approve Process Plan</button>}</td>
      </tr></tfoot>}
    </table></div>

    {activeOperation?.inspectionPlan && <div className="inspection-page-overlay" role="dialog" aria-modal="true" aria-label={`Inspection Plan - Operation ${activeOperation.operationNumber}`}>
      <section className="inspection-page">
        <header><div><ClipboardCheck size={19}/><div><h3>Inspection Plan - Operation {activeOperation.operationNumber}</h3><p>{masters.operations.find((entry) => String(entry.operationMasterId) === activeOperation.operationMasterId)?.operationName || "Operation"}</p></div></div><button type="button" aria-label="Close Inspection Plan" onClick={() => setActiveIndex(null)}><X size={18}/></button></header>
        <fieldset disabled={readOnly} className="inspection-readonly-fieldset">
        <div className="inspection-modal-toolbar"><div className="inspection-toolbar-actions"><div className="inspection-cmm-control" role="group" aria-label="CMM"><strong>CMM</strong><label><input type="radio" name={`cmm-${activeIndex}`} checked={activeOperation.inspectionPlan.cmmRequired} onChange={() => {
          const next = { ...activeOperation.inspectionPlan!, cmmRequired: true };
          updateOperation(activeIndex!, "inspectionPlan", next);
        }}/>On</label><label><input type="radio" name={`cmm-${activeIndex}`} checked={!activeOperation.inspectionPlan.cmmRequired} onChange={() => {
          const next = { ...activeOperation.inspectionPlan!, cmmRequired: false };
          updateOperation(activeIndex!, "inspectionPlan", next);
        }}/>Off</label></div><button type="button" className="marketing-add-line-button" onClick={() => {
          const next = { ...activeOperation.inspectionPlan!, characteristics: [...activeOperation.inspectionPlan!.characteristics, blankCharacteristic()] };
          updateOperation(activeIndex!, "inspectionPlan", next);
        }}><Plus size={15}/>Add Characteristic</button></div></div>

        <datalist id="inspection-characteristic-options">{masters.characteristics.map((entry) => <option key={entry.characteristicMasterId} value={entry.characteristicName}>{entry.characteristicCode}</option>)}</datalist>
        <datalist id="inspection-tolerance-grade-options">{toleranceGradeCodes.map((gradeCode) => <option key={gradeCode} value={gradeCode}/>)}</datalist>

        <div className="inspection-grid-wrap"><table className="inspection-grid">
          <thead><tr><th>S.No.</th><th className="inspection-balloon-column">Balloon No.</th><th>Characteristic</th><th>Specified Dimension</th><th>Tol Grade</th><th>Tol−</th><th>Tol+</th><th>LSL</th><th>USL</th><th>Drg Grid</th><th>Instrument / Gauge</th><th>Sample Size</th><th>Inspection Frequency</th><th>SC / CC</th><th className="inspection-periodic-column">Periodic Inspection Operator</th><th>Final</th><th/></tr></thead>
          <tbody>{activeOperation.inspectionPlan.characteristics.map((row, index) => {
            const matchedGrade = matchingToleranceGrade(row);
            return <tr key={row.inspectionCharacteristicId ?? `characteristic-${index}`}>
              <td><button type="button" className="inspection-serial-clone-button" title={`Clone inspection row ${index + 1}`} aria-label={`Clone inspection row ${index + 1}`} onClick={() => cloneCharacteristic(index)}><span>{index + 1}</span><CopyPlus size={13}/></button></td>
              <td className="inspection-balloon-column"><input value={row.balloonNumber} onChange={(e) => updateCharacteristic(index, "balloonNumber", e.target.value)}/></td>
              <td><div className="inspection-search-picker"><input list="inspection-characteristic-options" value={row.characteristicSearch} onChange={(e) => updateCharacteristicSearch(index, e.target.value)} placeholder="Search or enter characteristic"/><small className={row.characteristicMasterId ? "matched" : row.characteristicText ? "manual" : ""}>{row.characteristicMasterId ? "Master matched" : row.characteristicText ? "Free text characteristic" : "Search or type a characteristic"}</small></div></td>
              <td><input type="number" step="0.0001" value={row.specifiedDimension} onChange={(e) => updateCharacteristic(index, "specifiedDimension", e.target.value)}/></td>
              <td><div className="inspection-grade-entry"><input list="inspection-tolerance-grade-options" value={row.toleranceGradeText} onChange={(e) => updateCharacteristic(index, "toleranceGradeText", e.target.value)} placeholder="Type grade"/><small className={matchedGrade ? "matched" : "manual"}>{matchedGrade ? "Master matched" : "Manual tolerance"}</small></div></td>
              <td><input readOnly={Boolean(matchedGrade)} type="number" min="0" step="0.0001" value={row.toleranceMinus} onChange={(e) => updateCharacteristic(index, "toleranceMinus", e.target.value)}/></td>
              <td><input readOnly={Boolean(matchedGrade)} type="number" min="0" step="0.0001" value={row.tolerancePlus} onChange={(e) => updateCharacteristic(index, "tolerancePlus", e.target.value)}/></td>
              <td><input readOnly value={row.lsl}/></td>
              <td><input readOnly value={row.usl}/></td>
              <td><input value={row.drawingGrid} onChange={(e) => updateCharacteristic(index, "drawingGrid", e.target.value)}/></td>
              <td><select value={row.instrumentMasterId} onChange={(e) => updateCharacteristic(index, "instrumentMasterId", e.target.value)}><option value="">Select</option>{masters.instruments.map((entry) => <option key={entry.instrumentMasterId} value={entry.instrumentMasterId}>{entry.instrumentName}</option>)}</select></td>
              <td><select value={row.sampleSize} onChange={(e) => updateCharacteristic(index, "sampleSize", e.target.value)}><option value="">Select</option>{masters.sampleSizes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
              <td><select value={row.inspectionFrequency} onChange={(e) => updateCharacteristic(index, "inspectionFrequency", e.target.value)}><option value="">Select</option>{masters.frequencies.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
              <td><input type="radio" checked={row.scCcIdentification} onClick={() => updateCharacteristic(index, "scCcIdentification", !row.scCcIdentification)} readOnly/></td>
              <td className="inspection-periodic-column"><input type="radio" checked={row.periodicOperatorRequired} onClick={() => updateCharacteristic(index, "periodicOperatorRequired", !row.periodicOperatorRequired)} readOnly/></td>
              <td><input type="radio" checked={row.finalInspectionRequired} onClick={() => updateCharacteristic(index, "finalInspectionRequired", !row.finalInspectionRequired)} readOnly/></td>
              <td><div className="inspection-row-actions">
                <button type="button" className="marketing-delete-line-button" title="Delete row" aria-label={`Delete inspection row ${index + 1}`} onClick={() => {
                  const next = { ...activeOperation.inspectionPlan!, planStatus: "DRAFT" as const, characteristics: activeOperation.inspectionPlan!.characteristics.filter((_, i) => i !== index) };
                  updateOperation(activeIndex!, "inspectionPlan", next);
                }}><Trash2 size={15}/></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>
        </fieldset>
        <footer>{!readOnly && <button type="button" className="inspection-delete-plan" onClick={() => {
          updateOperation(activeIndex!, "inspectionPlan", null);
          setActiveIndex(null);
        }}><Trash2 size={14}/>Delete Inspection Plan</button>}{!readOnly && <button type="button" disabled={saving} className={`inspection-status-action ${activeOperation.inspectionPlan.planStatus.toLowerCase()}`} onClick={async () => {
          if (await onSaveInspection()) setActiveIndex(null);
        }}>{saving ? "Saving..." : activeOperation.inspectionPlan.planStatus === "READY" ? "Save Ready" : "Save Draft"}</button>}<button type="button" className="secondary-action-button" onClick={() => setActiveIndex(null)}>Close</button></footer>
      </section>
    </div>}
  </div>;
}
