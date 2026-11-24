import { ArrowLeftRight, ClipboardCheck, CopyPlus, Download, FileCode2, FileSpreadsheet, FileText, Plus, Printer, Save, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { attachmentApi, attachmentFileUrl } from "../../api/attachment.api";
import { type ProcessMasters } from "../../api/part.api";
import { useAppFeedback } from "../../components/AppFeedback";
import { useAuth } from "../../context/AuthContext";

export type InspectionCharacteristicRow = {
  inspectionCharacteristicId?: number;
  balloonNumber: string;
  characteristicMasterId: string;
  characteristicText: string;
  characteristicSearch: string;
  specifiedDimension: string;
  toleranceMode: "GRADE" | "MANUAL" | "NOT_APPLICABLE" | "STANDARD";
  toleranceGradeId: string;
  toleranceGradeText: string;
  toleranceStandardId: string;
  toleranceMinus: string;
  tolerancePlus: string;
  lsl: string;
  usl: string;
  drawingGrid: string;
  instrumentMasterId: string;
  sampleSize: string;
  inspectionFrequency: string;
  scCcIdentification: boolean;
  patrolInspectionQaRequired: boolean;
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
  toolList: ToolListForm | null;
  program: ProgramForm | null;
  programNumber: string;
  documentApprovals: ProcessDocumentApprovals;
  instructionAttachments: ProcessInstructionAttachment[];
  inspectionPlan: null | {
    inspectionPlanId?: number;
    planStatus: "DRAFT" | "READY";
    approvalStatus?: "DRAFT" | "APPROVED";
    cmmRequired: boolean;
    measurementUnit: "MM" | "INCH";
    toleranceStandardId: string;
    characteristics: InspectionCharacteristicRow[];
  };
};

export type ProcessInstructionAttachment = {
  attachmentId?: number;
  attachmentType: "WORK_INSTRUCTION";
  attachmentName: string;
  file: File | null;
  fileName?: string;
  fileUrl?: string;
};

export type ToolListToolRow = {
  toolDiameter: string;
  toolName: string;
  rpm: string;
  feed: string;
  holderName: string;
  holderLength: string;
  colletSize: string;
  toolInsertSpecification: string;
  toolMake: string;
  toolNumber: string;
  toolClampingDetail: string;
  heightOffset: string;
  toolFluteLength: string;
  toolOverhangDetails: string;
  toolLife: string;
};

export type ToolListCostRow = {
  toolDiameter: string;
  toolName: string;
  insertSpecification: string;
  insertOrToolRate: string;
  numberOfEdges: string;
  numberOfPockets: string;
  toolLifePerEdge: string;
  lifeOfOverallEdge: string;
};

export type ToolListForm = {
  documentDate: string;
  fixtureNumber: string;
  material: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  lastRevisionDate: string;
  signature: string;
  remarks: string;
  toolRows: ToolListToolRow[];
  costRows: ToolListCostRow[];
};

export type ProgramRevision = {
  revisionNumber: number;
  changedBy: string;
  changedOn: string;
};

export type ProgramForm = {
  programNumber: string;
  programText: string;
  revisionNumber: number;
  revisionHistory: ProgramRevision[];
};

type PendingProgramUpdate = {
  current: ProgramForm;
  programNumber: string;
  programText: string;
  nextRevision: number;
};

type ProgramSaveNotice = {
  tone: "success" | "error";
  message: string;
};

export type ProcessDocumentApprovals = {
  program: boolean;
  toolList: boolean;
  workInstructions: boolean;
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

export type InspectionPrintContext = {
  drawingNumber: string;
  drawingRevisionNumber: string;
  partKind: string;
  partName: string;
  partNumber: string;
  drawingCode: string;
  customerName: string;
  materialSpecification: string;
};

export type ProcessPlanSaveOptions = {
  /** @deprecated Prefer the two specific attachment options below. */
  skipAttachments?: boolean;
  skipPartAttachments?: boolean;
  skipWorkInstructionAttachments?: boolean;
  /**
   * Save only the Process Plan documents for an already-saved Part. This keeps
   * Program, Tool List and Work Instruction updates independent of unrelated
   * Part Master fields on older records.
   */
  documentOnly?: boolean;
};

type InspectionPrintType = "SETUP" | "PATROL" | "PERIODIC" | "FINAL";

const inspectionPrintTypes: Array<{
  value: InspectionPrintType;
  label: string;
  reportTitle: string;
  matches: (row: InspectionCharacteristicRow) => boolean;
}> = [
  { value: "SETUP", label: "Setup IP", reportTitle: "First Part Inspection Report", matches: () => true },
  { value: "PATROL", label: "Patrol Inspection IP", reportTitle: "Patrol Inspection Report", matches: (row) => row.patrolInspectionQaRequired },
  { value: "PERIODIC", label: "Periodic Inspection IP", reportTitle: "Periodic Inspection Report", matches: (row) => row.periodicOperatorRequired },
  { value: "FINAL", label: "Final Inspection IP", reportTitle: "Final Inspection Report", matches: (row) => row.finalInspectionRequired },
];

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

const blankToolListToolRow = (): ToolListToolRow => ({
  toolDiameter: "", toolName: "", rpm: "", feed: "", holderName: "", holderLength: "", colletSize: "",
  toolInsertSpecification: "", toolMake: "", toolNumber: "", toolClampingDetail: "",
  heightOffset: "", toolFluteLength: "", toolOverhangDetails: "", toolLife: "",
});

const blankToolListCostRow = (): ToolListCostRow => ({
  toolDiameter: "", toolName: "", insertSpecification: "", insertOrToolRate: "", numberOfEdges: "",
  numberOfPockets: "", toolLifePerEdge: "", lifeOfOverallEdge: "",
});

const blankToolList = (): ToolListForm => ({
  documentDate: "", fixtureNumber: "", material: "", preparedBy: "", checkedBy: "", approvedBy: "", lastRevisionDate: "",
  signature: "", remarks: "", toolRows: [], costRows: [],
});

const blankProgram = (programNumber = ""): ProgramForm => ({
  programNumber,
  programText: "",
  revisionNumber: 0,
  revisionHistory: [],
});

export const blankProcessDocumentApprovals = (): ProcessDocumentApprovals => ({
  program: false,
  toolList: false,
  workInstructions: false,
});

export type ProcessPlanApprovalIssue = {
  operationNumber: string;
  missing: string[];
};

const hasToolListContent = (toolList: ToolListForm | null) => Boolean(toolList && (
  Object.entries(toolList)
    .filter(([field]) => field !== "toolRows" && field !== "costRows")
    .some(([, fieldValue]) => String(fieldValue || "").trim())
  || toolList.toolRows.some((row) => Object.values(row).some((fieldValue) => fieldValue.trim()))
  || toolList.costRows.some((row) => Object.values(row).some((fieldValue) => fieldValue.trim()))
));

export function getProcessPlanApprovalIssues(operations: ProcessOperationRow[]): ProcessPlanApprovalIssue[] {
  if (!operations.length) return [{ operationNumber: "Process Plan", missing: ["at least one operation"] }];
  return operations.flatMap((operation) => {
    const missing: string[] = [];
    if (!operation.program?.revisionNumber || !operation.program.programNumber.trim() || !operation.program.programText.trim()) missing.push("Program");
    else if (!operation.documentApprovals?.program) missing.push("Program approval");
    if (!hasToolListContent(operation.toolList)) missing.push("Tool List");
    else if (!operation.documentApprovals?.toolList) missing.push("Tool List approval");
    if (!operation.instructionAttachments.length) missing.push("Work Instructions");
    else if (!operation.documentApprovals?.workInstructions) missing.push("Work Instructions approval");
    if (!operation.inspectionPlan?.characteristics.length || operation.inspectionPlan.planStatus !== "READY") missing.push("Inspection Plan");
    else if (operation.inspectionPlan.approvalStatus !== "APPROVED") missing.push("Inspection Plan approval");
    return missing.length ? [{ operationNumber: operation.operationNumber || "new", missing }] : [];
  });
}

export function processPlanApprovalIssueMessage(issues: ProcessPlanApprovalIssue[]) {
  return `Cannot approve the Process Plan. ${issues.map((issue) =>
    `${issue.operationNumber === "Process Plan" ? issue.operationNumber : `Operation ${issue.operationNumber}`}: ${issue.missing.join(", ")}`
  ).join(". ")}. Complete the listed item(s) and try again.`;
}

const blankCharacteristic = (): InspectionCharacteristicRow => ({
  balloonNumber: "",
  characteristicMasterId: "",
  characteristicText: "",
  characteristicSearch: "",
  specifiedDimension: "",
  toleranceMode: "MANUAL",
  toleranceGradeId: "",
  toleranceGradeText: "",
  toleranceStandardId: "",
  toleranceMinus: "",
  tolerancePlus: "",
  lsl: "",
  usl: "",
  drawingGrid: "",
  instrumentMasterId: "",
  sampleSize: "",
  inspectionFrequency: "",
  scCcIdentification: false,
  patrolInspectionQaRequired: false,
  periodicOperatorRequired: false,
  finalInspectionRequired: false,
});

type SpreadsheetCell = string | number | boolean | Date | null | undefined;

const inspectionPlanImportColumns = [
  ["sequence", "sno"],
  ["balloonNumber", "balloonno"],
  ["characteristic", "characteristic"],
  ["specifiedDimension", "specifieddimension"],
  ["toleranceGrade", "tolerancegrade"],
  ["toleranceMinus", "tolminus"],
  ["tolerancePlus", "tolplus"],
  ["lsl", "lsl"],
  ["usl", "usl"],
  ["drawingGrid", "drawinggrid"],
  ["instrument", "instrumentgauge"],
  ["sampleSize", "samplesize"],
  ["inspectionFrequency", "inspectionfrequency"],
  ["scCc", "sccc"],
  ["patrolInspectionQa", "patrolinspectionqa"],
  ["periodicOperator", "periodicinspectionoperator"],
  ["finalInspection", "finalinspection"],
] as const;

function spreadsheetText(value: SpreadsheetCell) {
  return String(value ?? "").trim();
}

function canonicalSpreadsheetText(value: SpreadsheetCell) {
  return spreadsheetText(value)
    .toLowerCase()
    .replace(/[−–—]/g, "minus")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "");
}

function spreadsheetBoolean(value: SpreadsheetCell) {
  const text = canonicalSpreadsheetText(value);
  if (["yes", "y", "true", "1"].includes(text)) return true;
  if (["no", "n", "false", "0", ""].includes(text)) return false;
  return null;
}

function importedNumber(value: SpreadsheetCell, label: string, excelRow: number, errors: string[], minZero = false) {
  const text = spreadsheetText(value);
  if (!text) return "";
  const number = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(number) || (minZero && number < 0)) {
    errors.push(`Row ${excelRow}: ${label} must be ${minZero ? "zero or greater" : "a valid number"}.`);
    return "";
  }
  return String(number);
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumeric(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function convertMeasurementValue(value: string, fromUnit: "MM" | "INCH", toUnit: "MM" | "INCH") {
  const parsed = optionalNumeric(value);
  if (parsed === null || fromUnit === toUnit) return value;
  return (fromUnit === "MM" ? parsed / 25.4 : parsed * 25.4).toFixed(4);
}

function money(value: string | number) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function inspectionPlanReady(rows: InspectionCharacteristicRow[]) {
  return rows.length > 0;
}

function isCmmInstrument(instrument: ProcessMasters["instruments"][number]) {
  return /\bCMM\b/i.test(`${instrument.instrumentCode} ${instrument.instrumentName}`);
}

export default function PartProcessPlanEditor({
  value,
  onChange,
  masters,
  printContext,
  onSaveInspection,
  saving,
  canApproveDocuments = false,
  readOnly = false,
}: {
  value: ProcessPlanForm;
  onChange: (next: ProcessPlanForm) => void;
  masters: ProcessMasters;
  printContext: InspectionPrintContext;
  onSaveInspection: (nextPlan?: ProcessPlanForm, options?: ProcessPlanSaveOptions) => Promise<boolean>;
  saving: boolean;
  canApproveDocuments?: boolean;
  readOnly?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeToolListIndex, setActiveToolListIndex] = useState<number | null>(null);
  const [activeProgramIndex, setActiveProgramIndex] = useState<number | null>(null);
  const [activeWorkInstructionIndex, setActiveWorkInstructionIndex] = useState<number | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramForm | null>(null);
  const [pendingProgramUpdate, setPendingProgramUpdate] = useState<PendingProgramUpdate | null>(null);
  const [programSaveNotice, setProgramSaveNotice] = useState<ProgramSaveNotice | null>(null);
  const [toolListSaveNotice, setToolListSaveNotice] = useState<ProgramSaveNotice | null>(null);
  const [toolListMaterialDraft, setToolListMaterialDraft] = useState<string | null>(null);
  const [workInstructionSaveNotice, setWorkInstructionSaveNotice] = useState<ProgramSaveNotice | null>(null);
  const { user } = useAuth();
  const { confirmAction, showError, showSuccess } = useAppFeedback();
  const inspectionImportInputRef = useRef<HTMLInputElement | null>(null);
  const toolListImportInputRef = useRef<HTMLInputElement | null>(null);
  const [exportingInspectionPlan, setExportingInspectionPlan] = useState(false);
  const [importingInspectionPlan, setImportingInspectionPlan] = useState(false);
  const [importingToolList, setImportingToolList] = useState(false);
  const [printTypePickerOpen, setPrintTypePickerOpen] = useState(false);
  const [toolListTab, setToolListTab] = useState<"TOOLS" | "COSTS">("TOOLS");
  const [operationNumberDrafts, setOperationNumberDrafts] = useState<Record<string, string>>({});
  const processPlanApprovalIssues = getProcessPlanApprovalIssues(value.operations);
  const allProcessesReady = processPlanApprovalIssues.length === 0;
  const processPlanCanBeApproved = canApproveDocuments && Boolean(value.processPlanId)
    && value.operations.every((operation) => Boolean(operation.processDefinitionId));

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

  const approveProcessPlan = async () => {
    if (!canApproveDocuments || !value.processPlanId || value.operations.some((operation) => !operation.processDefinitionId)) {
      showError("Save / update the Part before approving and releasing its Process Plan.");
      return;
    }
    if (!allProcessesReady) {
      showError(processPlanApprovalIssueMessage(processPlanApprovalIssues));
      return;
    }
    const confirmed = await confirmAction({
      title: "Approve & Release Process Plan?",
      message: "Every operation has an approved Program, Tool List, Work Instructions and Inspection Plan. Save the Part to complete the release.",
      confirmLabel: "Approve & Release",
    });

    if (confirmed) {
      onChange({ ...value, planStatus: "APPROVED" });
    }
  };

  const updateOperation = (index: number, field: keyof ProcessOperationRow, fieldValue: any) => {
    const operations = value.operations.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      let updated = { ...row, [field]: fieldValue };
      if (field === "inspectionPlan" && row.inspectionPlan?.approvalStatus === "APPROVED" && fieldValue) {
        const withoutApproval = (plan: NonNullable<ProcessOperationRow["inspectionPlan"]>) => {
          const { approvalStatus: _approvalStatus, ...content } = plan;
          return JSON.stringify(content);
        };
        if (withoutApproval(row.inspectionPlan) !== withoutApproval(fieldValue)) {
          updated = { ...updated, inspectionPlan: { ...fieldValue, approvalStatus: "DRAFT" as const } };
        }
      }
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

  const nextOperationNumber = (operations: ProcessOperationRow[]) => {
    const highest = Math.max(0, ...operations
      .map((operation) => Number(operation.operationNumber))
      .filter((operationNumber) => Number.isFinite(operationNumber) && operationNumber > 0));
    return String(highest + 10);
  };

  const operationNumberDraftKey = (operation: ProcessOperationRow, index: number) => String(
    operation.processOperationId || operation.processDefinitionId || `new-${index}`
  );

  const swapOperationPackages = (operationIndex: number, targetIndex: number) => {
    const source = value.operations[operationIndex];
    const target = value.operations[targetIndex];
    if (!source || !target || operationIndex === targetIndex) return;
    const sourceNumber = String(source.operationNumber || "").trim();
    const targetNumber = String(target.operationNumber || "").trim();
    if (!sourceNumber || !targetNumber) {
      showError("Both operations need a number before they can be swapped.");
      return;
    }
    const operations = value.operations.map((operation, index) => {
      // Keep the operation-number slots in place while exchanging the complete
      // operation package. The definition IDs travel with their IP, Tool List,
      // program number and work instructions.
      if (index === operationIndex) return { ...target, operationNumber: sourceNumber };
      if (index === targetIndex) return { ...source, operationNumber: targetNumber };
      return operation;
    });
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess(`Operation ${sourceNumber} and Operation ${targetNumber} were swapped with their Inspection Plans, Tool Lists, programs and work instructions.`);
  };

  const commitOperationNumber = (operationIndex: number, draftKey: string, valueToCommit: string) => {
    const nextNumber = String(valueToCommit || "").trim();
    setOperationNumberDrafts((drafts) => {
      const { [draftKey]: _draft, ...remainingDrafts } = drafts;
      return remainingDrafts;
    });
    const operation = value.operations[operationIndex];
    if (!operation || nextNumber === String(operation.operationNumber || "")) return;
    if (!/^[1-9]\d*$/.test(nextNumber) || Number(nextNumber) % 10 !== 0) {
      showError("Operation Number must be a positive multiple of 10.");
      return;
    }
    const matchingIndex = value.operations.findIndex((entry, index) => index !== operationIndex
      && String(entry.operationNumber || "") === nextNumber);
    if (matchingIndex >= 0) {
      swapOperationPackages(operationIndex, matchingIndex);
      return;
    }
    const operations = value.operations.map((entry, index) => index === operationIndex
      ? { ...entry, operationNumber: nextNumber }
      : entry);
    operations.sort((left, right) => Number(left.operationNumber) - Number(right.operationNumber));
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const addOperation = () => onChange({
    ...value,
    planStatus: "DRAFT",
    operations: [...value.operations, {
      operationNumber: nextOperationNumber(value.operations),
      operationMasterId: "",
      operationDescription: "",
      sourceType: (masters.sources[0]?.sourceCode || "INHOUSE") as "INHOUSE" | "OUTSOURCE",
      machineTypeId: "",
      cycleTimeSeconds: "",
      clampingTimeSeconds: "",
      settingTimeHours: "",
      outsourceCostInr: "",
      processCostInr: "0.00",
      toolList: null,
      program: null,
      programNumber: "",
      documentApprovals: blankProcessDocumentApprovals(),
      instructionAttachments: [],
      inspectionPlan: null,
    }],
  });

  const focusAfterRowIsAdded = (selector: string) => {
    window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 0);
  };

  const addOperationOnFinalEnter = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (readOnly || event.key !== "Enter" || event.shiftKey || rowIndex !== value.operations.length - 1) return;
    event.preventDefault();
    addOperation();
    focusAfterRowIsAdded(`[data-process-operation-index="${rowIndex + 1}"]`);
  };

  const addCharacteristicOnFinalEnter = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (readOnly || activeIndex === null || !activeOperation?.inspectionPlan
      || event.key !== "Enter" || event.shiftKey || rowIndex !== activeOperation.inspectionPlan.characteristics.length - 1) return;
    event.preventDefault();
    const next = {
      ...activeOperation.inspectionPlan,
      planStatus: "READY" as const,
      characteristics: [...activeOperation.inspectionPlan.characteristics, blankCharacteristic()],
    };
    updateOperation(activeIndex, "inspectionPlan", next);
    focusAfterRowIsAdded(`[data-inspection-balloon-index="${rowIndex + 1}"]`);
  };

  const gridInputSelector = "input:not([type='hidden']), select, textarea";

  const isGridNavigable = (element: HTMLElement) => {
    if (element.matches(":disabled")) return false;
    if (element instanceof HTMLInputElement) {
      if (element.type === "hidden" || element.type === "file") return false;
      return element.type === "radio" || element.type === "checkbox" || !element.readOnly;
    }
    if (element instanceof HTMLTextAreaElement) return !element.readOnly;
    return element instanceof HTMLSelectElement;
  };

  const focusGridCell = (cell: HTMLTableCellElement | undefined, fromEnd = false) => {
    if (!cell) return false;
    const controls = Array.from(cell.querySelectorAll<HTMLElement>(gridInputSelector)).filter(isGridNavigable);
    const nextControl = fromEnd ? controls[controls.length - 1] : controls[0];
    if (!nextControl) return false;
    nextControl.focus();
    return true;
  };

  const moveGridFocus = (event: KeyboardEvent<HTMLTableElement>) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      || event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const currentControl = target.closest<HTMLElement>(gridInputSelector);
    const currentCell = currentControl?.closest("td");
    const currentRow = currentCell?.parentElement;
    if (!currentControl || !currentCell || !(currentRow instanceof HTMLTableRowElement)
      || !isGridNavigable(currentControl)) return;

    const cellIndex = currentCell.cellIndex;
    let moved = false;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const step = event.key === "ArrowLeft" ? -1 : 1;
      for (let index = cellIndex + step; index >= 0 && index < currentRow.cells.length; index += step) {
        if (focusGridCell(currentRow.cells[index], step < 0)) {
          moved = true;
          break;
        }
      }
    } else {
      const rows = Array.from((currentRow.parentElement as HTMLTableSectionElement | null)?.rows || []);
      const currentRowIndex = rows.indexOf(currentRow);
      const step = event.key === "ArrowUp" ? -1 : 1;
      for (let index = currentRowIndex + step; index >= 0 && index < rows.length; index += step) {
        if (focusGridCell(rows[index].cells[cellIndex])) {
          moved = true;
          break;
        }
      }
    }

    if (moved) event.preventDefault();
  };

  const cloneOperation = (rowIndex: number) => {
    const source = value.operations[rowIndex];
    if (!source) return;
    const sourceNumber = Number(source.operationNumber);
    if (!Number.isSafeInteger(sourceNumber) || sourceNumber < 10 || sourceNumber % 10 !== 0) {
      showError("Operation numbers must be positive multiples of 10 before cloning.");
      return;
    }

    // A clone takes the next ten-number slot. If that slot is occupied, shift
    // only the consecutive occupied slots forward, keeping each operation's
    // entire package (IP, Tool List, program and instructions) together.
    const clonedOperationNumber = sourceNumber + 10;
    const occupiedNumbers = new Set(value.operations
      .filter((_, index) => index !== rowIndex)
      .map((operation) => Number(operation.operationNumber)));
    const numbersToShift = new Set<number>();
    let numberToCheck = clonedOperationNumber;
    while (occupiedNumbers.has(numberToCheck)) {
      numbersToShift.add(numberToCheck);
      numberToCheck += 10;
    }

    const cloned: ProcessOperationRow = {
      ...source,
      processOperationId: undefined,
      processDefinitionId: undefined,
      processDefinitionCode: undefined,
      sharedVariantCount: 1,
      operationNumber: String(clonedOperationNumber),
      documentApprovals: blankProcessDocumentApprovals(),
      // A cloned operation is a separate process definition. Its instructions
      // must be selected again rather than appearing as files belonging to it.
      instructionAttachments: [],
      inspectionPlan: source.inspectionPlan ? {
        ...source.inspectionPlan,
        inspectionPlanId: undefined,
        planStatus: "DRAFT",
        approvalStatus: "DRAFT",
        characteristics: source.inspectionPlan.characteristics.map((characteristic) => ({
          ...characteristic,
          inspectionCharacteristicId: undefined,
        })),
      } : null,
    };
    const operations = value.operations.map((operation, index) => (
      index !== rowIndex && numbersToShift.has(Number(operation.operationNumber))
        ? { ...operation, operationNumber: String(Number(operation.operationNumber) + 10) }
        : operation
    ));
    operations.splice(rowIndex + 1, 0, cloned);
    operations.sort((left, right) => Number(left.operationNumber) - Number(right.operationNumber));
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess(numbersToShift.size
      ? `Cloned as Operation ${clonedOperationNumber}. Later operations were moved forward by 10.`
      : `Cloned as Operation ${clonedOperationNumber}.`);
  };

  const configure = (index: number) => {
    if (!value.operations[index].inspectionPlan) {
      if (readOnly) return;
      updateOperation(index, "inspectionPlan", {
        planStatus: "DRAFT", approvalStatus: "DRAFT", cmmRequired: false, measurementUnit: "MM", toleranceStandardId: "", characteristics: [blankCharacteristic()],
      });
    }
    setActiveIndex(index);
  };

  const openToolList = (index: number) => {
    const currentToolList = value.operations[index]?.toolList;
    setActiveIndex(null);
    setActiveProgramIndex(null);
    setActiveWorkInstructionIndex(null);
    setToolListTab("TOOLS");
    setToolListSaveNotice(null);
    setToolListMaterialDraft(currentToolList?.material?.trim() || printContext.materialSpecification);
    setActiveToolListIndex(index);
  };

  const openProgram = (index: number) => {
    const operation = value.operations[index];
    if (!operation) return;
    const current = operation.program || blankProgram(operation.programNumber);
    setActiveIndex(null);
    setActiveToolListIndex(null);
    setActiveWorkInstructionIndex(null);
    setActiveProgramIndex(index);
    setProgramSaveNotice(null);
    setProgramDraft({
      ...current,
      revisionHistory: [...current.revisionHistory],
    });
  };

  const openWorkInstructions = (index: number) => {
    setActiveIndex(null);
    setActiveToolListIndex(null);
    setActiveProgramIndex(null);
    setWorkInstructionSaveNotice(null);
    setActiveWorkInstructionIndex(index);
  };

  const persistProgramUpdate = async (
    update: PendingProgramUpdate,
    createRevision: boolean,
  ) => {
    if (activeProgramIndex === null) return;
    const { current, programNumber, programText, nextRevision } = update;
    const revisionNumber = createRevision ? nextRevision : current.revisionNumber;
    const changedBy = user?.empName || user?.empCode || "Current user";
    const changedOn = new Date().toISOString();
    const nextProgram: ProgramForm = {
      programNumber,
      programText,
      revisionNumber,
      revisionHistory: createRevision
        ? [...current.revisionHistory, { revisionNumber, changedBy, changedOn }]
        : current.revisionHistory,
    };
    const operations = value.operations.map((operation, index) => index === activeProgramIndex
      ? { ...operation, program: nextProgram, programNumber,
        documentApprovals: { ...operation.documentApprovals, program: false } }
      : operation);
    const nextPlan = { ...value, operations, planStatus: "DRAFT" as const };
    setProgramSaveNotice(null);
    onChange(nextPlan);
    setProgramDraft(nextProgram);
    setPendingProgramUpdate(null);
    // Program changes do not alter Part or work-instruction attachments. Keep
    // an unrelated pending attachment from blocking the Program save itself.
    const saved = await onSaveInspection(nextPlan, {
      skipPartAttachments: true,
      skipWorkInstructionAttachments: true,
      documentOnly: true,
    });
    if (saved) {
      const message = createRevision
        ? `Program updated and saved as Revision ${revisionNumber}.`
        : `Program updated and saved without creating a new revision (Rev ${revisionNumber}).`;
      setProgramSaveNotice({ tone: "success", message });
      showSuccess(message);
    } else {
      setProgramSaveNotice({
        tone: "error",
        message: "Program was not saved. Complete the required Part details and try again.",
      });
    }
  };

  const saveProgram = async () => {
    if (activeProgramIndex === null || !programDraft) return;
    const programNumber = programDraft.programNumber.trim();
    const programText = programDraft.programText.trim();
    if (!programNumber) {
      const message = "Program Number is required.";
      setProgramSaveNotice({ tone: "error", message });
      showError(message);
      return;
    }
    if (!programText) {
      const message = "Enter the Program text before saving.";
      setProgramSaveNotice({ tone: "error", message });
      showError(message);
      return;
    }

    const current = value.operations[activeProgramIndex]?.program || null;
    const changed = !current
      || current.programNumber !== programNumber
      || current.programText !== programText;
    if (!changed) {
      const message = "No Program changes to update.";
      setProgramSaveNotice({ tone: "error", message });
      showError(message);
      return;
    }

    const nextRevision = Math.max(
      Number(current?.revisionNumber || 0),
      ...((current?.revisionHistory || []).map((entry) => Number(entry.revisionNumber || 0)))
    ) + 1;
    const update: PendingProgramUpdate = {
      current: current || blankProgram(),
      programNumber,
      programText,
      nextRevision,
    };
    if (current?.revisionNumber) {
      setPendingProgramUpdate(update);
      return;
    }
    await persistProgramUpdate(update, true);
  };

  const approveProgram = () => {
    if (activeProgramIndex === null) return;
    const operation = value.operations[activeProgramIndex];
    if (!canApproveDocuments || !operation?.processDefinitionId) {
      showError("Save / update the Part before approving its Program.");
      return;
    }
    if (!operation?.program?.revisionNumber || !operation.program.programNumber.trim() || !operation.program.programText.trim()) {
      showError("Save a Program Number and Program text before approving the Program.");
      return;
    }
    const operations = value.operations.map((entry, index) => index === activeProgramIndex
      ? { ...entry, documentApprovals: { ...entry.documentApprovals, program: true } }
      : entry);
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess("Program approved. Click Update to save the Part.");
  };

  const addInstructionFiles = (operationIndex: number, fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setWorkInstructionSaveNotice(null);
    const operations = value.operations.map((operation, index) => index === operationIndex ? {
      ...operation,
      documentApprovals: { ...operation.documentApprovals, workInstructions: false },
      instructionAttachments: [
        ...operation.instructionAttachments,
        ...files.map((file) => ({
          attachmentType: "WORK_INSTRUCTION" as const,
          attachmentName: file.name,
          file,
          fileName: file.name,
        })),
      ],
    } : operation);
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const removeInstructionAttachment = async (operationIndex: number, attachmentIndex: number) => {
    const operation = value.operations[operationIndex];
    const attachment = operation?.instructionAttachments[attachmentIndex];
    if (!operation || !attachment) return;
    if (!await confirmAction({
      title: "Delete work instruction?",
      message: `${attachment.fileName || attachment.attachmentName || "This file"} will be removed from this operation.`,
      confirmLabel: "Delete instruction",
      cancelLabel: "Cancel",
    })) return;
    try {
      if (attachment.attachmentId && operation.processDefinitionId) {
        await attachmentApi.remove("PART_PROCESS_DEFINITION", operation.processDefinitionId, attachment.attachmentId);
      }
      const operations = value.operations.map((entry, index) => index === operationIndex ? {
        ...entry,
        documentApprovals: { ...entry.documentApprovals, workInstructions: false },
        instructionAttachments: entry.instructionAttachments.filter((_, indexToKeep) => indexToKeep !== attachmentIndex),
      } : entry);
      onChange({ ...value, operations, planStatus: "DRAFT" });
      showSuccess("Work instruction removed.");
      setWorkInstructionSaveNotice(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to remove the work instruction.");
    }
  };

  const updateToolList = (operationIndex: number, nextToolList: ToolListForm) => {
    setToolListSaveNotice(null);
    const operations = value.operations.map((operation, index) => index === operationIndex
      ? { ...operation, toolList: nextToolList, documentApprovals: { ...operation.documentApprovals, toolList: false } }
      : operation);
    onChange({ ...value, operations, planStatus: "DRAFT" });
  };

  const importToolList = async (file: File | null) => {
    if (!file || activeToolListIndex === null || !activeToolListOperation) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      showError("Choose a Tool List Excel file (.xlsx or .xls).");
      return;
    }

    setImportingToolList(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const normalise = (entry: unknown) => String(entry ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
      const text = (sheet: any, address: string) => {
        const cell = sheet?.[address];
        return cell ? String(XLSX.utils.format_cell(cell) ?? cell.v ?? "").trim() : "";
      };
      const date = (sheet: any, address: string) => {
        const cell = sheet?.[address];
        if (!cell) return "";
        if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
          const parsed = XLSX.SSF.parse_date_code(cell.v);
          if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
        const value = text(sheet, address);
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        return "";
      };
      const sheetNamed = (name: string) => workbook.SheetNames.find((entry) => normalise(entry) === normalise(name));
      const toolSheetName = sheetNamed("TOOL LIST") || workbook.SheetNames.find((entry) => normalise(entry).includes("toollist"));
      const costSheetName = sheetNamed("COST PER COMPONENT") || workbook.SheetNames.find((entry) => normalise(entry).includes("costpercomponent"));
      if (!toolSheetName && !costSheetName) {
        throw new Error("The workbook needs a TOOL LIST or COST PER COMPONENT worksheet.");
      }

      const current = activeToolListOperation.toolList || blankToolList();
      let next: ToolListForm = { ...current, toolRows: [...current.toolRows], costRows: [...current.costRows] };
      let importedTools = 0;
      let importedCosts = 0;

      if (toolSheetName) {
        const sheet = workbook.Sheets[toolSheetName];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
        const rowWith = (column: number, expected: string) => {
          for (let row = range.s.r; row <= range.e.r; row += 1) {
            if (normalise(text(sheet, XLSX.utils.encode_cell({ r: row, c: column }))) === expected) return row;
          }
          return -1;
        };
        const toolHeaderRow = rowWith(0, "sino");
        const footerRow = rowWith(0, "preparedby");
        if (toolHeaderRow >= 0) {
          next = {
            ...next,
            documentDate: date(sheet, "T1") || next.documentDate,
            fixtureNumber: text(sheet, "I3") || next.fixtureNumber,
            material: text(sheet, "M3") || next.material,
            preparedBy: text(sheet, "A30") || next.preparedBy,
            checkedBy: text(sheet, "D30") || next.checkedBy,
            approvedBy: text(sheet, "G30") || next.approvedBy,
            lastRevisionDate: date(sheet, "I30") || next.lastRevisionDate,
            signature: text(sheet, "L30") || next.signature,
            remarks: text(sheet, "N30") || next.remarks,
          };
          const toolRows: ToolListToolRow[] = [];
          const lastDataRow = footerRow >= 0 ? footerRow : range.e.r + 1;
          for (let row = toolHeaderRow + 2; row < lastDataRow; row += 1) {
            const cell = (column: number) => text(sheet, XLSX.utils.encode_cell({ r: row, c: column }));
            const importedRow: ToolListToolRow = {
              toolDiameter: cell(1), toolName: cell(2), rpm: cell(5), feed: cell(6), holderName: cell(7),
              holderLength: cell(8), colletSize: cell(9), toolInsertSpecification: cell(12), toolMake: cell(13),
              toolNumber: cell(14), toolClampingDetail: "", heightOffset: cell(15), toolFluteLength: cell(17),
              toolOverhangDetails: cell(18), toolLife: cell(19),
            };
            if (Object.values(importedRow).some((entry) => entry.trim())) toolRows.push(importedRow);
          }
          if (toolRows.length) {
            next = { ...next, toolRows };
            importedTools = toolRows.length;
          }
        }
      }

      if (costSheetName) {
        const sheet = workbook.Sheets[costSheetName];
        const rows = XLSX.utils.sheet_to_json<SpreadsheetCell[]>(sheet, {
          header: 1, defval: "", raw: false, blankrows: false,
        }) as SpreadsheetCell[][];
        const headerRowIndex = rows.findIndex((row) => {
          const headers = row.map(normalise);
          return headers.some((header) => header === "tooldia" || header === "tooldiameter")
            && headers.includes("toolname")
            && headers.some((header) => header === "insertortoolrate");
        });
        if (headerRowIndex >= 0) {
          const headers = rows[headerRowIndex].map(normalise);
          const column = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
          const toolDiameter = column("tooldia", "tooldiameter");
          const toolName = column("toolname");
          const insertSpecification = column("insretspecification", "insertspecification");
          const insertOrToolRate = column("insertortoolrate");
          const numberOfEdges = column("numberofedge", "numberofedges");
          const numberOfPockets = column("numberofpocket", "numberofpockets");
          const toolLifePerEdge = column("toollifeperedge");
          const lifeOfOverallEdge = column("lifeofoveralledge");
          const valueAt = (row: SpreadsheetCell[], index: number) => index < 0 ? "" : spreadsheetText(row[index]);
          const costRows = rows.slice(headerRowIndex + 1).map((row) => ({
            toolDiameter: valueAt(row, toolDiameter), toolName: valueAt(row, toolName),
            insertSpecification: valueAt(row, insertSpecification), insertOrToolRate: valueAt(row, insertOrToolRate),
            numberOfEdges: valueAt(row, numberOfEdges), numberOfPockets: valueAt(row, numberOfPockets),
            toolLifePerEdge: valueAt(row, toolLifePerEdge), lifeOfOverallEdge: valueAt(row, lifeOfOverallEdge),
          })).filter((row) => Object.values(row).some((entry) => entry.trim()));
          if (costRows.length) {
            next = { ...next, costRows };
            importedCosts = costRows.length;
          }
        }
      }

      if (!importedTools && !importedCosts) {
        throw new Error("No Tool List rows were found. Use the approved Tool List workbook format and keep its column headings.");
      }
      setToolListMaterialDraft(next.material);
      updateToolList(activeToolListIndex, next);
      showSuccess(`${importedTools ? `${importedTools} tool${importedTools === 1 ? "" : "s"}` : "No tools"}${importedTools && importedCosts ? " and " : ""}${importedCosts ? `${importedCosts} cost row${importedCosts === 1 ? "" : "s"}` : ""} imported. Review and save the Tool List.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to import the Tool List Excel file.");
    } finally {
      setImportingToolList(false);
    }
  };

  const saveToolList = async () => {
    if (!activeToolListOperation || !hasToolListContent(activeToolListOperation.toolList)) {
      setToolListSaveNotice({ tone: "error", message: "Add Tool List details before saving." });
      return;
    }
    setToolListSaveNotice(null);
    const saved = await onSaveInspection(undefined, {
      skipPartAttachments: true,
      skipWorkInstructionAttachments: true,
      documentOnly: true,
    });
    setToolListSaveNotice(saved
      ? { tone: "success", message: "Tool List saved successfully." }
      : { tone: "error", message: "Tool List was not saved. Correct the Part details and try again." });
  };

  const saveWorkInstructions = async () => {
    if (!activeWorkInstructionOperation?.instructionAttachments.length) {
      setWorkInstructionSaveNotice({ tone: "error", message: "Attach at least one Work Instruction before saving." });
      return;
    }
    setWorkInstructionSaveNotice(null);
    const saved = await onSaveInspection(undefined, {
      skipPartAttachments: true,
      documentOnly: true,
    });
    setWorkInstructionSaveNotice(saved
      ? { tone: "success", message: "Work Instruction attachment(s) saved successfully." }
      : { tone: "error", message: "Work Instructions were not saved. Correct the error shown on the page and try again." });
  };

  const approveToolList = () => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    if (!canApproveDocuments || !activeToolListOperation.processDefinitionId) {
      showError("Save / update the Part before approving its Tool List.");
      return;
    }
    if (!hasToolListContent(activeToolListOperation.toolList)) {
      showError("Complete the Tool List before approving it.");
      return;
    }
    const operations = value.operations.map((operation, index) => index === activeToolListIndex
      ? { ...operation, documentApprovals: { ...operation.documentApprovals, toolList: true } }
      : operation);
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess("Tool List approved. Click Update to save the Part.");
  };

  const approveWorkInstructions = () => {
    if (activeWorkInstructionIndex === null) return;
    const operation = value.operations[activeWorkInstructionIndex];
    if (!canApproveDocuments || !operation?.processDefinitionId) {
      showError("Save / update the Part before approving its Work Instructions.");
      return;
    }
    if (!operation?.instructionAttachments.length) {
      showError("Attach at least one Work Instruction before approving it.");
      return;
    }
    const operations = value.operations.map((entry, index) => index === activeWorkInstructionIndex
      ? { ...entry, documentApprovals: { ...entry.documentApprovals, workInstructions: true } }
      : entry);
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess("Work Instructions approved. Click Update to save the Part.");
  };

  const approveInspectionPlan = () => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!canApproveDocuments || !operation?.processDefinitionId) {
      showError("Save / update the Part before approving its Inspection Plan.");
      return;
    }
    if (!operation?.inspectionPlan || !inspectionPlanReady(operation.inspectionPlan.characteristics)) {
      showError("Add at least one Inspection Plan characteristic before approving it.");
      return;
    }
    const operations = value.operations.map((entry, index) => index === activeIndex
      ? { ...entry, inspectionPlan: { ...entry.inspectionPlan!, planStatus: "READY" as const, approvalStatus: "APPROVED" as const } }
      : entry);
    onChange({ ...value, operations, planStatus: "DRAFT" });
    showSuccess("Inspection Plan approved. Click Update to save the Part.");
  };

  const updateToolListHeader = (field: Exclude<keyof ToolListForm, "toolRows" | "costRows">, fieldValue: string) => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    updateToolList(activeToolListIndex, { ...(activeToolListOperation.toolList || blankToolList()), [field]: fieldValue });
  };

  const updateToolListRow = (rowIndex: number, field: keyof ToolListToolRow, fieldValue: string) => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    const toolList = activeToolListOperation.toolList || blankToolList();
    updateToolList(activeToolListIndex, {
      ...toolList,
      toolRows: toolList.toolRows.map((row, index) => index === rowIndex ? { ...row, [field]: fieldValue } : row),
    });
  };

  const updateToolListCostRow = (rowIndex: number, field: keyof ToolListCostRow, fieldValue: string) => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    const toolList = activeToolListOperation.toolList || blankToolList();
    updateToolList(activeToolListIndex, {
      ...toolList,
      costRows: toolList.costRows.map((row, index) => index === rowIndex ? { ...row, [field]: fieldValue } : row),
    });
  };

  const addToolListRow = () => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    const toolList = activeToolListOperation.toolList || blankToolList();
    updateToolList(activeToolListIndex, { ...toolList, toolRows: [...toolList.toolRows, blankToolListToolRow()] });
  };

  const addToolListCostRow = () => {
    if (activeToolListIndex === null || !activeToolListOperation) return;
    const toolList = activeToolListOperation.toolList || blankToolList();
    updateToolList(activeToolListIndex, { ...toolList, costRows: [...toolList.costRows, blankToolListCostRow()] });
  };

  const matchingToleranceGrade = (row: InspectionCharacteristicRow, measurementUnit: "MM" | "INCH" = "MM") => {
    if (measurementUnit === "INCH") return undefined;
    const gradeText = row.toleranceGradeText.trim().toUpperCase();
    const dimension = optionalNumeric(row.specifiedDimension);
    if (!gradeText || dimension === null) return undefined;
    return masters.toleranceGrades.find((entry) =>
      entry.gradeCode.trim().toUpperCase() === gradeText
      && (Number(entry.basicSizeFrom) === 0 ? dimension >= 0 : dimension > Number(entry.basicSizeFrom))
      && dimension <= Number(entry.basicSizeTo));
  };

  const matchingToleranceStandardBand = (row: InspectionCharacteristicRow, toleranceStandardId: string, measurementUnit: "MM" | "INCH" = "MM") => {
    if (measurementUnit === "INCH" || row.toleranceGradeText.trim() || row.toleranceGradeId) return undefined;
    const hasManualTolerance = row.toleranceMode === "MANUAL"
      && (optionalNumeric(row.toleranceMinus) !== null || optionalNumeric(row.tolerancePlus) !== null);
    if (hasManualTolerance) return undefined;
    const dimension = optionalNumeric(row.specifiedDimension);
    const selectedToleranceStandardId = Number(toleranceStandardId);
    if (dimension === null || !selectedToleranceStandardId) return undefined;
    return masters.toleranceStandardBands.find((band) => {
      if (Number(band.toleranceStandardId) !== selectedToleranceStandardId || band.characteristicType !== "LINEAR_DIMENSIONS") return false;
      const minimum = band.nominalFrom === null ? null : Number(band.nominalFrom);
      const maximum = band.nominalTo === null ? null : Number(band.nominalTo);
      const aboveMinimum = minimum === null || (band.minimumInclusive === "Y" ? dimension >= minimum : dimension > minimum);
      const belowMaximum = maximum === null || (band.maximumInclusive === "Y" ? dimension <= maximum : dimension < maximum);
      return aboveMinimum && belowMaximum;
    });
  };

  const calculateCharacteristicTolerance = (row: InspectionCharacteristicRow, inspectionPlan: NonNullable<ProcessOperationRow["inspectionPlan"]>) => {
    const measurementUnit = inspectionPlan.measurementUnit === "INCH" ? "INCH" : "MM";
    const dimension = optionalNumeric(row.specifiedDimension);
    const grade = matchingToleranceGrade(row, measurementUnit);
    const hasManualTolerance = row.toleranceMode === "MANUAL"
      && (optionalNumeric(row.toleranceMinus) !== null || optionalNumeric(row.tolerancePlus) !== null);
    const standardBand = grade || hasManualTolerance ? undefined
      : matchingToleranceStandardBand(row, inspectionPlan.toleranceStandardId, measurementUnit);
    const standardHasNumericTolerance = standardBand?.toleranceMinusMm !== null && standardBand?.toleranceMinusMm !== undefined
      && standardBand?.tolerancePlusMm !== null && standardBand?.tolerancePlusMm !== undefined;

    if (standardBand && standardHasNumericTolerance && dimension !== null) {
      const toleranceMinus = Math.abs(Number(standardBand.toleranceMinusMm));
      const tolerancePlus = Number(standardBand.tolerancePlusMm);
      return { ...row, toleranceMode: "STANDARD" as const, toleranceStandardId: inspectionPlan.toleranceStandardId,
        toleranceGradeId: "", toleranceGradeText: "", toleranceMinus: String(toleranceMinus), tolerancePlus: String(tolerancePlus),
        lsl: (dimension - toleranceMinus).toFixed(4), usl: (dimension + tolerancePlus).toFixed(4) };
    }
    if (grade && dimension !== null) {
      return { ...row, toleranceMode: "GRADE" as const, toleranceStandardId: "", toleranceGradeId: String(grade.toleranceGradeId),
        toleranceMinus: String(Math.abs(Number(grade.lowerDeviationMicrons)) / 1000),
        tolerancePlus: String(Number(grade.upperDeviationMicrons) / 1000),
        lsl: (dimension + Number(grade.lowerDeviationMicrons) / 1000).toFixed(4),
        usl: (dimension + Number(grade.upperDeviationMicrons) / 1000).toFixed(4) };
    }
    if (measurementUnit === "MM" && inspectionPlan.toleranceStandardId && !row.toleranceGradeText.trim()
      && !row.toleranceGradeId && !hasManualTolerance) {
      return { ...row, toleranceMode: "STANDARD" as const, toleranceStandardId: inspectionPlan.toleranceStandardId,
        toleranceGradeId: "", toleranceMinus: "", tolerancePlus: "", lsl: "", usl: "" };
    }
    const toleranceMinus = optionalNumeric(row.toleranceMinus);
    const tolerancePlus = optionalNumeric(row.tolerancePlus);
    return { ...row, toleranceMode: "MANUAL" as const, toleranceStandardId: "", toleranceGradeId: "",
      lsl: dimension !== null && toleranceMinus !== null ? (dimension - toleranceMinus).toFixed(4) : "",
      usl: dimension !== null && tolerancePlus !== null ? (dimension + tolerancePlus).toFixed(4) : "" };
  };

  const updateInspectionMeasurementUnit = (measurementUnit: "MM" | "INCH") => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;
    const currentUnit = operation.inspectionPlan.measurementUnit === "INCH" ? "INCH" : "MM";
    if (currentUnit === measurementUnit) return;
    const characteristics = operation.inspectionPlan.characteristics.map((row) => ({
      ...row,
      specifiedDimension: convertMeasurementValue(row.specifiedDimension, currentUnit, measurementUnit),
      toleranceMinus: convertMeasurementValue(row.toleranceMinus, currentUnit, measurementUnit),
      tolerancePlus: convertMeasurementValue(row.tolerancePlus, currentUnit, measurementUnit),
      lsl: convertMeasurementValue(row.lsl, currentUnit, measurementUnit),
      usl: convertMeasurementValue(row.usl, currentUnit, measurementUnit),
      toleranceMode: "MANUAL" as const,
      toleranceGradeId: "",
      toleranceGradeText: "",
      toleranceStandardId: "",
    }));
    const nextInspectionPlan = {
      ...operation.inspectionPlan,
      measurementUnit,
      toleranceStandardId: "",
      planStatus: inspectionPlanReady(characteristics) ? "READY" : "DRAFT" as const,
      characteristics,
    };
    updateOperation(activeIndex, "inspectionPlan", nextInspectionPlan);
  };

  const updateInspectionToleranceStandard = (toleranceStandardId: string) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;
    const nextPlan = { ...operation.inspectionPlan, toleranceStandardId,
      planStatus: inspectionPlanReady(operation.inspectionPlan.characteristics) ? "READY" as const : "DRAFT" as const };
    const characteristics = nextPlan.characteristics.map((row) => calculateCharacteristicTolerance({ ...row, toleranceStandardId: "" }, nextPlan));
    updateOperation(activeIndex, "inspectionPlan", { ...nextPlan, characteristics });
  };

  const updateCmmRequired = (cmmRequired: boolean) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan || operation.inspectionPlan.cmmRequired === cmmRequired) return;

    updateOperation(activeIndex, "inspectionPlan", {
      ...operation.inspectionPlan,
      cmmRequired,
      planStatus: inspectionPlanReady(operation.inspectionPlan.characteristics) ? "READY" : "DRAFT",
    });
  };

  const operationName = (operation: ProcessOperationRow) => masters.operations
    .find((entry) => String(entry.operationMasterId) === operation.operationMasterId)?.operationName
    || operation.operationDescription
    || "Operation";

  const characteristicLabel = (row: InspectionCharacteristicRow) => masters.characteristics
    .find((entry) => String(entry.characteristicMasterId) === row.characteristicMasterId)?.characteristicName
    || row.characteristicText
    || row.characteristicSearch
    || "";

  const instrumentLabel = (instrumentMasterId: string) => masters.instruments
    .find((entry) => String(entry.instrumentMasterId) === instrumentMasterId)?.instrumentName
    || "";

  const toleranceStandardLabel = (toleranceStandardId: string) => masters.toleranceStandards
    .find((entry) => String(entry.toleranceStandardId) === toleranceStandardId)?.standardName
    || "";

  const importInspectionPlan = async (file: File | null) => {
    if (!file || activeIndex === null || !activeOperation?.inspectionPlan) return;
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      showError("Choose an Inspection Plan Excel file (.xlsx or .xls).");
      return;
    }

    setImportingInspectionPlan(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "inspection plan")
        || workbook.SheetNames[0];
      if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetCell[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      }) as SpreadsheetCell[][];
      const headerRowIndex = rows.findIndex((cells) => {
        const headers = cells.map(canonicalSpreadsheetText);
        return headers.includes("sno") && headers.includes("characteristic");
      });
      if (headerRowIndex < 0) {
        throw new Error("This is not an Inspection Plan export. Download the template with Export Excel and use that file.");
      }

      const headers = rows[headerRowIndex].map(canonicalSpreadsheetText);
      const columnIndex = new Map<string, number>();
      const missing = inspectionPlanImportColumns.flatMap(([key, header]) => {
        const index = headers.findIndex((value) => value === header || value.startsWith(header));
        if (index >= 0) {
          columnIndex.set(key, index);
          return [];
        }
        return key === "patrolInspectionQa" ? [] : [key];
      });
      if (missing.length) {
        throw new Error("The Excel file is missing one or more Inspection Plan columns. Export a new template and keep all headers unchanged.");
      }

      let measurementUnit = activeOperation.inspectionPlan.measurementUnit;
      let cmmRequired = activeOperation.inspectionPlan.cmmRequired;
      let toleranceStandardId = String(activeOperation.inspectionPlan.toleranceStandardId || "");
      for (const metadataRow of rows.slice(0, headerRowIndex)) {
        const metadataHeaders = metadataRow.map(canonicalSpreadsheetText);
        const unitIndex = metadataHeaders.indexOf("measurementunit");
        if (unitIndex >= 0) {
          const unit = canonicalSpreadsheetText(metadataRow[unitIndex + 1]);
          if (unit === "mm" || unit === "millimetre" || unit === "millimeter") measurementUnit = "MM";
          else if (unit === "in" || unit === "inch" || unit === "inches") measurementUnit = "INCH";
          else if (unit) throw new Error("Measurement Unit in the Excel file must be mm or inch.");
        }
        const cmmIndex = metadataHeaders.indexOf("cmmrequired");
        if (cmmIndex >= 0) {
          const cmmValue = spreadsheetBoolean(metadataRow[cmmIndex + 1]);
          if (cmmValue === null) throw new Error("CMM Required in the Excel file must be Yes or No.");
          cmmRequired = cmmValue;
        }
        const standardIndex = metadataHeaders.indexOf("tolerancestandard");
        if (standardIndex >= 0) {
          const standardInput = spreadsheetText(metadataRow[standardIndex + 1]);
          const standard = standardInput ? masters.toleranceStandards.find((entry) => {
            const target = canonicalSpreadsheetText(standardInput);
            return canonicalSpreadsheetText(entry.standardName) === target || canonicalSpreadsheetText(entry.standardCode) === target;
          }) : undefined;
          if (standardInput && !standard) throw new Error(`Tolerance Standard "${standardInput}" is not available in the active master.`);
          toleranceStandardId = standard ? String(standard.toleranceStandardId) : "";
        }
      }

      if (measurementUnit === "INCH" && toleranceStandardId) {
        throw new Error("Tolerance Standards can be used only for mm Inspection Plans.");
      }

      const dataRows = rows.slice(headerRowIndex + 1).filter((cells) =>
        inspectionPlanImportColumns.some(([key]) => spreadsheetText(cells[columnIndex.get(key)!])));
      if (!dataRows.length) throw new Error("The Inspection Plan export does not contain any characteristic rows.");

      const errors: string[] = [];
      const lookupText = (value: SpreadsheetCell) => canonicalSpreadsheetText(value);
      const byValueOrLabel = <T extends { value: string; label: string }>(items: T[], value: SpreadsheetCell) => {
        const target = lookupText(value);
        return items.find((entry) => lookupText(entry.value) === target || lookupText(entry.label) === target);
      };
      const getCell = (cells: SpreadsheetCell[], key: string) => {
        const index = columnIndex.get(key);
        return index === undefined ? "" : cells[index];
      };
      const legacyStandardIds = new Set<string>();
      const characteristics = dataRows.map((cells, index) => {
        const excelRow = headerRowIndex + index + 2;
        const characteristicInput = spreadsheetText(getCell(cells, "characteristic"));
        if (!characteristicInput) errors.push(`Row ${excelRow}: Characteristic is required.`);
        const characteristic = masters.characteristics.find((entry) => {
          const target = lookupText(characteristicInput);
          return lookupText(entry.characteristicName) === target || lookupText(entry.characteristicCode) === target;
        });
        const instrumentInput = spreadsheetText(getCell(cells, "instrument"));
        const instrument = instrumentInput ? masters.instruments.find((entry) => {
          const target = lookupText(instrumentInput);
          return lookupText(entry.instrumentName) === target || lookupText(entry.instrumentCode) === target;
        }) : undefined;
        if (instrumentInput && !instrument) errors.push(`Row ${excelRow}: Instrument / Gauge \"${instrumentInput}\" is not active in Instrument Master.`);
        const sampleSizeInput = getCell(cells, "sampleSize");
        const sampleSize = spreadsheetText(sampleSizeInput) ? byValueOrLabel(masters.sampleSizes, sampleSizeInput) : undefined;
        if (spreadsheetText(sampleSizeInput) && !sampleSize) errors.push(`Row ${excelRow}: Sample Size is not available in the active master.`);
        const frequencyInput = getCell(cells, "inspectionFrequency");
        const inspectionFrequency = spreadsheetText(frequencyInput) ? byValueOrLabel(masters.frequencies, frequencyInput) : undefined;
        if (spreadsheetText(frequencyInput) && !inspectionFrequency) errors.push(`Row ${excelRow}: Inspection Frequency is not available in the active master.`);
        const toleranceStandardColumn = headers.findIndex((value) => value === "tolerancestandard" || value.startsWith("tolerancestandard"));
        const toleranceStandardInput = toleranceStandardColumn >= 0 ? spreadsheetText(cells[toleranceStandardColumn]) : "";
        const toleranceStandard = toleranceStandardInput ? masters.toleranceStandards.find((entry) => {
          const target = lookupText(toleranceStandardInput);
          return lookupText(entry.standardName) === target || lookupText(entry.standardCode) === target;
        }) : undefined;
        if (toleranceStandardInput && !toleranceStandard) errors.push(`Row ${excelRow}: Tolerance Standard \"${toleranceStandardInput}\" is not available in the active master.`);
        if (toleranceStandard && measurementUnit === "INCH") errors.push(`Row ${excelRow}: Tolerance Standards can be used only for mm Inspection Plans.`);
        if (toleranceStandard) legacyStandardIds.add(String(toleranceStandard.toleranceStandardId));
        const specifiedDimension = importedNumber(getCell(cells, "specifiedDimension"), "Specified Dimension", excelRow, errors);
        const toleranceMinus = importedNumber(getCell(cells, "toleranceMinus"), "Tol−", excelRow, errors, true);
        const tolerancePlus = importedNumber(getCell(cells, "tolerancePlus"), "Tol+", excelRow, errors, true);
        const lsl = importedNumber(getCell(cells, "lsl"), "LSL", excelRow, errors);
        const usl = importedNumber(getCell(cells, "usl"), "USL", excelRow, errors);
        const toleranceGradeText = spreadsheetText(getCell(cells, "toleranceGrade"));
        const dimension = optionalNumeric(specifiedDimension);
        const toleranceGrade = measurementUnit === "MM" && toleranceGradeText && dimension !== null
          ? masters.toleranceGrades.find((entry) => lookupText(entry.gradeCode) === lookupText(toleranceGradeText)
            && (Number(entry.basicSizeFrom) === 0 ? dimension >= 0 : dimension > Number(entry.basicSizeFrom))
            && dimension <= Number(entry.basicSizeTo))
          : undefined;
        const scCcIdentification = spreadsheetBoolean(getCell(cells, "scCc")) ?? false;
        const patrolInspectionQaRequired = spreadsheetBoolean(getCell(cells, "patrolInspectionQa")) ?? false;
        const periodicOperatorRequired = spreadsheetBoolean(getCell(cells, "periodicOperator")) ?? false;
        const finalInspectionRequired = spreadsheetBoolean(getCell(cells, "finalInspection")) ?? false;
        return {
          balloonNumber: spreadsheetText(getCell(cells, "balloonNumber")),
          characteristicMasterId: characteristic ? String(characteristic.characteristicMasterId) : "",
          characteristicText: characteristic ? "" : characteristicInput,
          characteristicSearch: characteristic?.characteristicName || characteristicInput,
          specifiedDimension,
          toleranceMode: toleranceGrade ? "GRADE" as const : "MANUAL" as const,
          toleranceGradeId: toleranceGrade ? String(toleranceGrade.toleranceGradeId) : "",
          toleranceGradeText,
          toleranceStandardId: "",
          toleranceMinus,
          tolerancePlus,
          lsl,
          usl,
          drawingGrid: spreadsheetText(getCell(cells, "drawingGrid")),
          instrumentMasterId: instrument ? String(instrument.instrumentMasterId) : "",
          sampleSize: sampleSize?.value || "",
          inspectionFrequency: inspectionFrequency?.value || "",
          scCcIdentification,
          patrolInspectionQaRequired,
          periodicOperatorRequired,
          finalInspectionRequired,
        } satisfies InspectionCharacteristicRow;
      });
      if (errors.length) {
        const detail = errors.slice(0, 6).join(" ");
        throw new Error(`${detail}${errors.length > 6 ? ` ${errors.length - 6} more issue(s) found.` : ""}`);
      }

      if (!toleranceStandardId && legacyStandardIds.size === 1) toleranceStandardId = Array.from(legacyStandardIds)[0];
      if (legacyStandardIds.size > 1) throw new Error("The old Excel file contains more than one Tolerance Standard. Select one plan-level Tolerance Standard and export a new template.");

      const baseInspectionPlan = {
        ...activeOperation.inspectionPlan,
        cmmRequired,
        measurementUnit,
        toleranceStandardId,
        planStatus: inspectionPlanReady(characteristics) ? "READY" as const : "DRAFT" as const,
        characteristics: [],
      };
      const inspectionPlan = { ...baseInspectionPlan,
        characteristics: characteristics.map((row) => calculateCharacteristicTolerance(row, baseInspectionPlan)) };
      const operations = value.operations.map((operation, index) => index === activeIndex
        ? { ...operation, inspectionPlan }
        : operation);
      onChange({ ...value, operations, planStatus: "DRAFT" });
      showSuccess(`${characteristics.length} Inspection Plan characteristic${characteristics.length === 1 ? "" : "s"} imported. Review and save the plan.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to import the Inspection Plan Excel file.");
    } finally {
      setImportingInspectionPlan(false);
    }
  };

  const exportInspectionPlan = async () => {
    if (!activeOperation?.inspectionPlan) return;

    const inspectionPlan = activeOperation.inspectionPlan;
    const unit = inspectionPlan.measurementUnit === "INCH" ? "in" : "mm";
    const rows = inspectionPlan.characteristics.map((row, index) => [
      index + 1,
      row.balloonNumber,
      characteristicLabel(row),
      row.specifiedDimension,
      row.toleranceGradeText,
      row.toleranceMinus,
      row.tolerancePlus,
      row.lsl,
      row.usl,
      row.drawingGrid,
      instrumentLabel(row.instrumentMasterId),
      row.sampleSize,
      row.inspectionFrequency,
      row.scCcIdentification ? "Yes" : "No",
      row.patrolInspectionQaRequired ? "Yes" : "No",
      row.periodicOperatorRequired ? "Yes" : "No",
      row.finalInspectionRequired ? "Yes" : "No",
    ]);
    const headings = [
      "S.No.", "Balloon No.", "Characteristic", `Specified Dimension (${unit})`, "Tolerance Grade",
      `Tol− (${unit})`, `Tol+ (${unit})`, `LSL (${unit})`, `USL (${unit})`, "Drawing Grid",
      "Instrument / Gauge", "Sample Size", "Inspection Frequency", "SC / CC", "Patrol Inspection QA",
      "Periodic Inspection Operator", "Final Inspection",
    ];

    setExportingInspectionPlan(true);
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["INSPECTION PLAN"],
        ["Operation No.", activeOperation.operationNumber],
        ["Operation", operationName(activeOperation)],
        ["Tolerance Standard", toleranceStandardLabel(inspectionPlan.toleranceStandardId), "Measurement Unit", unit, "CMM Required", inspectionPlan.cmmRequired ? "Yes" : "No"],
        [],
        headings,
        ...rows,
      ]);
      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headings.length - 1 } }];
      worksheet["!cols"] = [
        { wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 13 },
        { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 25 }, { wch: 14 },
        { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 26 }, { wch: 18 },
      ];
      worksheet["!autofilter"] = { ref: `A6:Q${Math.max(6, rows.length + 6)}` };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inspection Plan");
      const operationNumber = String(activeOperation.operationNumber || "operation").replace(/[^a-z0-9_-]+/gi, "-");
      XLSX.writeFile(workbook, `inspection-plan-${operationNumber}-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
      showSuccess("Inspection Plan Excel downloaded.");
    } catch {
      showError("Unable to create the Inspection Plan Excel file.");
    } finally {
      setExportingInspectionPlan(false);
    }
  };

  const printInspectionPlan = (printType: InspectionPrintType) => {
    if (!activeOperation?.inspectionPlan) return;

    const selectedPrintType = inspectionPrintTypes.find((entry) => entry.value === printType);
    if (!selectedPrintType) return;

    const escapeHtml = (value: unknown) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const inspectionPlan = activeOperation.inspectionPlan;
    const unit = inspectionPlan.measurementUnit === "INCH" ? "in" : "mm";
    const characteristics = inspectionPlan.characteristics.filter((row) => selectedPrintType.matches(row)
      && (inspectionPlan.cmmRequired || !isCmmInstrument(masters.instruments.find((instrument) =>
        String(instrument.instrumentMasterId) === row.instrumentMasterId))));
    if (!characteristics.length) {
      showError(`No printable characteristics are marked for ${selectedPrintType.label}.`);
      return;
    }
    const printWindow = window.open("", "_blank", "width=1280,height=900");
    if (!printWindow) {
      showError("Unable to open the print window. Allow pop-ups for this site and try again.");
      return;
    }

    const readableKind = printContext.partKind.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const date = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date());

    if (printType === "FINAL") {
      const finalTableRows = characteristics.map((row) => `<tr class="${row.scCcIdentification ? "special-characteristic" : ""}">
        <td class="serial">${inspectionPlan.characteristics.indexOf(row) + 1}</td>
        <td class="special-value">${escapeHtml(characteristicLabel(row)) || "—"}</td>
        <td class="special-value">${escapeHtml(row.specifiedDimension) || "—"}</td>
        <td class="special-value">${escapeHtml(row.lsl) || "—"}</td>
        <td class="special-value">${escapeHtml(row.usl) || "—"}</td>
        <td>${escapeHtml(row.balloonNumber) || "—"}</td>
        <td>${escapeHtml(row.drawingGrid) || "—"}</td>
        <td>${escapeHtml(instrumentLabel(row.instrumentMasterId)) || "—"}</td>
        <td></td><td class="final-observed"></td><td class="final-observed"></td><td class="final-observed"></td>
      </tr>`).join("");

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><title>Final Inspection IP - ${escapeHtml(activeOperation.operationNumber)}</title><style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; } body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .document { border: 1px solid #1f2937; }.company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
        .final-metadata { display: grid; grid-template-columns: 1.4fr .7fr 1.5fr .8fr 1.2fr; border-top: 1px solid #1f2937; }.final-metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }.final-metadata div:nth-child(5n) { border-right: 0; }.final-metadata .operation { grid-column: span 3; }.final-metadata .dispatch { grid-column: span 2; }.final-metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.final-metadata span { font-size: 9px; font-weight: 700; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }th { background: #f8fafc; font-size: 7px; text-align: center; }thead { display: table-header-group; }tr { break-inside: avoid; }.serial { text-align: center; }.final-observed { height: 25px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }
        .final-note { padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; }.final-status { display: grid; grid-template-columns: 1.3fr 1.2fr repeat(3, .65fr); border-left: 1px solid #1f2937; }.final-status div { min-height: 29px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.final-status .wide { grid-column: span 2; }.final-status .full { grid-column: span 5; }.final-status .detail { font-weight: 400; }
      </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>Final Inspection Report</h1><section class="final-metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml([printContext.drawingNumber, printContext.drawingRevisionNumber].filter(Boolean).join(" / ")) || "—"}</span></div><div><strong>Kind</strong><span>${escapeHtml(readableKind) || "—"}</span></div><div><strong>Part Name</strong><span>${escapeHtml(printContext.partName) || "—"}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(printContext.drawingCode) || "—"}</span></div><div><strong>Customer</strong><span>${escapeHtml(printContext.customerName) || "—"}</span></div><div class="operation"><strong>Opn. No & Description</strong><span>${escapeHtml([activeOperation.operationNumber, operationName(activeOperation)].filter(Boolean).join(" & ")) || "—"}</span></div><div class="dispatch"><strong>Atech DC/NO & Date</strong><span>${escapeHtml(date)}</span></div></section><table><colgroup><col style="width:3%"/><col style="width:16%"/><col style="width:12%"/><col style="width:8%"/><col style="width:8%"/><col style="width:6%"/><col style="width:6%"/><col style="width:12%"/><col style="width:7%"/><col style="width:7.333%"/><col style="width:7.333%"/><col style="width:7.333%"/></colgroup><thead><tr><th rowspan="2">S.No.</th><th rowspan="2">Description</th><th rowspan="2">Specified Dimension (${unit})</th><th colspan="2">Specification (${unit})</th><th rowspan="2">Balloon S.No.</th><th rowspan="2">Drg Grid</th><th rowspan="2">Instrument / Gauge</th><th rowspan="2">Remarks</th><th colspan="3">Observed</th></tr><tr><th>LSL</th><th>USL</th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${finalTableRows}</tbody></table><div class="final-note">AC - Accepted, RW - Rework, RJ - Rejection, DE - Deviation, CAC - Conditionally Accepted &nbsp;&nbsp; | &nbsp;&nbsp; Grey shaded values are Special Characteristics (SC/CC).</div><section class="final-status"><div class="wide">Component Status</div><div>1</div><div>2</div><div>3</div><div class="wide">Supplied Qty:</div><div class="wide">Accepted Qty:</div><div>Inspected By / Date:</div><div>Inspection status:</div><div>Inspection status:</div><div class="wide">Machining Rej Qty:</div><div class="wide">Material Rej Qty:</div><div>Approved By / Date:</div><div></div><div></div><div class="full">Sampling Plan: <span class="detail">1–100 Nos: 2 samples; 101–500 Nos: 3 samples; above 500 Nos: 5 samples.</span></div><div class="full">Remarks:</div></section></main></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    if (printType === "PATROL" || printType === "PERIODIC") {
      const inspectionStageLabel = printType === "PATROL" ? "Patrol Inspection" : "Periodic Inspection";
      const sampleSizeLabel = (sampleSize: string) => masters.sampleSizes
        .find((entry) => entry.value === sampleSize)?.label || sampleSize || "Not specified";
      const frequencyLabel = (frequency: string) => masters.frequencies
        .find((entry) => entry.value === frequency)?.label || frequency || "Not specified";
      const observationCount = (sampleSize: string, sampleLabel: string) => {
        const sampleCount = Number(sampleSize) || Number(sampleLabel);
        return Number.isFinite(sampleCount) && sampleCount > 0
          ? Math.min(Math.floor(sampleCount), 15)
          : 15;
      };
      const inspectionInterval = (frequency: string, label: string) => {
        const value = `${frequency} ${label}`.toUpperCase();
        if (/EVERY_PART|EVERY\s+PART|100\s*%/.test(value)) return 1;
        const match = value.match(/(?:EVERY[_\s-]*|1\s*\/\s*)(\d+)/);
        return match ? Math.max(Number(match[1]), 1) : 1;
      };
      const groups = new Map<string, {
        rows: InspectionCharacteristicRow[];
        sampleLabel: string;
        frequencyLabel: string;
        observationCount: number;
        interval: number;
      }>();
      characteristics.forEach((row) => {
        const sampleLabel = sampleSizeLabel(row.sampleSize);
        const frequency = frequencyLabel(row.inspectionFrequency);
        const key = `${row.sampleSize}::${row.inspectionFrequency}`;
        const existing = groups.get(key);
        if (existing) {
          existing.rows.push(row);
          return;
        }
        groups.set(key, {
          rows: [row],
          sampleLabel,
          frequencyLabel: frequency,
          observationCount: observationCount(row.sampleSize, sampleLabel),
          interval: inspectionInterval(row.inspectionFrequency, frequency),
        });
      });
      const patrolSections = Array.from(groups.values()).map((group) => {
        const observedNumbers = Array.from({ length: group.observationCount }, (_, index) => 1 + (index * group.interval));
        const observedWidth = (47 / group.observationCount).toFixed(3);
        const groupRows = group.rows.map((row) => `<tr class="${row.scCcIdentification ? "special-characteristic" : ""}">
          <td class="serial">${inspectionPlan.characteristics.indexOf(row) + 1}</td>
          <td class="special-value">${escapeHtml(characteristicLabel(row)) || "—"}</td>
          <td class="special-value">${escapeHtml(row.specifiedDimension) || "—"}</td>
          <td class="special-value">${escapeHtml(row.lsl) || "—"}</td>
          <td class="special-value">${escapeHtml(row.usl) || "—"}</td>
          <td>${escapeHtml(instrumentLabel(row.instrumentMasterId)) || "—"}</td>
          ${observedNumbers.map(() => '<td class="patrol-observed"></td>').join("")}
        </tr>`).join("");
        return `<section class="patrol-section"><header><strong>${inspectionStageLabel}: ${escapeHtml(group.sampleLabel)} / ${escapeHtml(group.frequencyLabel)}</strong><span>Observed Reading</span></header><table class="patrol-table"><colgroup><col style="width:3%"/><col style="width:15%"/><col style="width:9%"/><col style="width:8%"/><col style="width:8%"/><col style="width:10%"/>${observedNumbers.map(() => `<col style="width:${observedWidth}%"/>`).join("")}</colgroup><thead><tr><th>S.No.</th><th>Description</th><th>Basic Size (${unit})</th><th>Tol Min</th><th>Tol Max</th><th>Instrument / Gauge</th>${observedNumbers.map((number) => `<th>${number}</th>`).join("")}</tr></thead><tbody>${groupRows}</tbody></table></section>`;
      }).join("");

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(inspectionStageLabel)} IP - ${escapeHtml(activeOperation.operationNumber)}</title><style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; } body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .document { border: 1px solid #1f2937; }.company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
        .metadata { display: grid; grid-template-columns: 1.4fr .75fr 1.65fr .85fr; border-top: 1px solid #1f2937; }.metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }.metadata div:nth-child(4n) { border-right: 0; }.metadata .wide { grid-column: span 2; }.metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.metadata span { font-size: 9px; font-weight: 700; }
        .patrol-section { margin-top: 8px; break-inside: avoid; }.patrol-section > header { display: flex; justify-content: space-between; padding: 4px 6px; border: 1px solid #1f2937; border-bottom: 0; background: #f1f5f9; font-size: 9px; }.patrol-section > header span { font-weight: 700; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }th { background: #f8fafc; font-size: 7px; text-align: center; }thead { display: table-header-group; }tr { break-inside: avoid; }.serial { text-align: center; }.patrol-observed { height: 27px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }
        .patrol-time, .patrol-note { min-height: 25px; padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; font-weight: 700; }.patrol-note { min-height: 42px; }.patrol-note span { font-weight: 400; }.patrol-sign-off { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; border-left: 1px solid #1f2937; }.patrol-sign-off div { min-height: 28px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.patrol-sign-off .wide { grid-column: span 2; }.patrol-sign-off .full { grid-column: span 4; }
      </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>Operator Inspection Report</h1><section class="metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml([printContext.drawingNumber, printContext.drawingRevisionNumber].filter(Boolean).join(" / ")) || "—"}</span></div><div><strong>Kind</strong><span>${escapeHtml(readableKind) || "—"}</span></div><div><strong>Part Name</strong><span>${escapeHtml(printContext.partName) || "—"}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(printContext.drawingCode) || "—"}</span></div><div class="wide"><strong>Opn. No & Description</strong><span>${escapeHtml([activeOperation.operationNumber, operationName(activeOperation)].filter(Boolean).join(" & ")) || "—"}</span></div><div><strong>Customer</strong><span>${escapeHtml(printContext.customerName) || "—"}</span></div><div><strong>Date</strong><span>${escapeHtml(date)}</span></div></section>${patrolSections}<div class="patrol-time">Time:</div><div class="patrol-note">Special Instructions: <span>Grey shaded values are Special Characteristics (SC/CC).</span></div><section class="patrol-sign-off"><div class="wide">Machine No &amp; Name:</div><div>Shift-1 Details</div><div>Remarks</div><div class="wide">Operator Name:</div><div>Shift-2 Details</div><div>Remarks</div><div class="wide">Part Serial No. Start &amp; End:</div><div>Shift-3 Details</div><div>Remarks</div><div class="wide">Quantity Produced / Accepted:</div><div>QA Verified By:</div><div>Sign:</div><div class="full">Remarks:</div></section></main></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }
    const tableRows = characteristics.map((row, index) => `<tr class="${row.scCcIdentification ? "special-characteristic" : ""}">
      <td class="serial">${index + 1}</td><td>${escapeHtml(row.inspectionFrequency) || "—"}</td><td class="special-value">${escapeHtml(characteristicLabel(row)) || "—"}</td>
      <td class="special-value">${escapeHtml(row.specifiedDimension) || "—"}</td><td class="special-value">${escapeHtml(row.lsl) || "—"}</td><td class="special-value">${escapeHtml(row.usl) || "—"}</td>
      <td>${escapeHtml(row.balloonNumber) || "—"}</td><td>${escapeHtml(row.drawingGrid) || "—"}</td>
      <td>${escapeHtml(instrumentLabel(row.instrumentMasterId)) || "—"}</td><td></td>
      <td class="observed"></td><td class="observed"></td><td class="observed"></td><td class="observed"></td><td class="observed"></td><td class="observed"></td>
    </tr>`).join("");

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(selectedPrintType.label)} - ${escapeHtml(activeOperation.operationNumber)}</title><style>
      @page { size: landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
      .document { border: 1px solid #1f2937; }
      .company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }
      h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
      .metadata { display: grid; grid-template-columns: 1.4fr .75fr 1.65fr .85fr; border-top: 1px solid #1f2937; }
      .metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }
      .metadata div:nth-child(4n) { border-right: 0; }.metadata .wide { grid-column: span 2; }
      .metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.metadata span { font-size: 9px; font-weight: 700; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; } th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #f1f5f9; font-size: 7px; text-align: center; } thead { display: table-header-group; } tr { break-inside: avoid; }
      .serial { text-align: center; }.observed { height: 26px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }.small-note { padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; }
      .sign-off { display: grid; grid-template-columns: repeat(4, 1fr); border-left: 1px solid #1f2937; }.sign-off div { min-height: 31px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.sign-off .wide { grid-column: span 2; }.sign-off .remarks { grid-column: span 4; min-height: 42px; }
    </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>${escapeHtml(selectedPrintType.reportTitle)}</h1><section class="metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml([printContext.drawingNumber, printContext.drawingRevisionNumber].filter(Boolean).join(" / ")) || "—"}</span></div><div><strong>Kind</strong><span>${escapeHtml(readableKind) || "—"}</span></div><div><strong>Part Name</strong><span>${escapeHtml(printContext.partName) || "—"}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(printContext.drawingCode) || "—"}</span></div><div class="wide"><strong>Customer</strong><span>${escapeHtml(printContext.customerName) || "—"}</span></div><div><strong>Opn. No & Description</strong><span>${escapeHtml([activeOperation.operationNumber, operationName(activeOperation)].filter(Boolean).join(" & ")) || "—"}</span></div><div><strong>Date</strong><span>${escapeHtml(date)}</span></div></section><table><colgroup><col style="width:3%"/><col style="width:7%"/><col style="width:9%"/><col style="width:11%"/><col style="width:4.5%"/><col style="width:4.5%"/><col style="width:5%"/><col style="width:5%"/><col style="width:10%"/><col style="width:5%"/><col style="width:7.5%"/><col style="width:7.5%"/><col style="width:7.5%"/><col style="width:7.5%"/><col style="width:7.5%"/><col style="width:7.5%"/></colgroup><thead><tr><th rowspan="2">S.No.</th><th rowspan="2">Inspection<br/>Frequency</th><th rowspan="2">Description</th><th rowspan="2">Specified Dimension (${unit})</th><th colspan="2">Specification (${unit})</th><th rowspan="2">Balloon S.No.</th><th rowspan="2">Drg Grid</th><th rowspan="2">Instrument / Gauge</th><th rowspan="2">Remarks</th><th colspan="6">Observed</th></tr><tr><th>LSL</th><th>USL</th><th></th><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody>${tableRows}</tbody></table><div class="small-note">AC - Accepted, RW - Rework, RJ - Rejection, DE - Deviation, CAC - Conditionally Accepted &nbsp;&nbsp; | &nbsp;&nbsp; Grey shade: Special Characteristic</div><section class="sign-off"><div class="wide">M/c Id &amp; Name:</div><div>Work Order No:</div><div>Inspected By:</div><div class="wide">Setter Name:</div><div class="wide">Date / Shift / Time:</div><div class="remarks">Remarks:</div></section></main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const updateCharacteristic = (rowIndex: number, field: keyof InspectionCharacteristicRow, fieldValue: any) => {
    if (activeIndex === null) return;
    const operation = value.operations[activeIndex];
    if (!operation.inspectionPlan) return;
    const characteristics = operation.inspectionPlan.characteristics.map((row, index) => {
      if (index !== rowIndex) return row;
      const next = { ...row, [field]: fieldValue,
        ...(["toleranceMinus", "tolerancePlus"].includes(String(field)) && row.toleranceMode === "STANDARD"
          ? { toleranceMode: "MANUAL" as const, toleranceStandardId: "" }
          : {}) };
      if (["specifiedDimension", "toleranceGradeText", "toleranceMinus", "tolerancePlus"].includes(String(field))) {
        return calculateCharacteristicTolerance(next, operation.inspectionPlan!);
      }
      return next;
    });
    const inspectionPlan = {
      ...operation.inspectionPlan,
      planStatus: inspectionPlanReady(characteristics) ? "READY" as const : "DRAFT" as const,
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
      planStatus: inspectionPlanReady(characteristics) ? "READY" as const : "DRAFT" as const,
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
  const activeToolListOperation = activeToolListIndex === null ? null : value.operations[activeToolListIndex];
  const activeProgramOperation = activeProgramIndex === null ? null : value.operations[activeProgramIndex];
  const activeWorkInstructionOperation = activeWorkInstructionIndex === null ? null : value.operations[activeWorkInstructionIndex];
  const activeToolList = activeToolListOperation?.toolList || blankToolList();
  const activeToolListMachine = masters.machineTypes.find((entry) => String(entry.machineTypeId) === activeToolListOperation?.machineTypeId);
  const costPerComponent = (row: ToolListCostRow) => {
    const rate = Number(row.insertOrToolRate);
    const pockets = Number(row.numberOfPockets);
    const overallLife = Number(row.lifeOfOverallEdge);
    return Number.isFinite(rate) && Number.isFinite(pockets) && Number.isFinite(overallLife) && overallLife > 0
      ? ((rate * pockets) / overallLife).toFixed(2)
      : "—";
  };
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

    <div className="part-process-table-wrap"><table className="part-process-table" onKeyDownCapture={moveGridFocus}>
      <thead><tr><th className="process-clone-column" aria-label="Clone process row"/><th>Op. No.</th><th>Operation Name</th><th>Description</th><th>Program</th><th>Source</th><th>Machine Type</th><th>Cycle Time (Sec)</th><th>Clamping (Sec)</th><th>Setting (Hrs)</th><th>Process Cost</th><th>Tool List</th><th>Inspection Plan</th><th>Work Instructions</th><th/></tr></thead>
      <tbody>
        {!value.operations.length && <tr><td colSpan={15} className="part-process-empty">No process added. Click Add Process to begin.</td></tr>}
        {value.operations.map((row, index) => {
          return <tr key={row.processOperationId ?? `process-${index}`}>
            <td data-label="Clone" className="process-clone-column">{!readOnly && <button type="button" className="process-operation-clone-button" title={`Clone process row ${index + 1}`} aria-label={`Clone process row ${index + 1}`} onClick={() => cloneOperation(index)}><CopyPlus size={15}/></button>}</td>
            <td data-label="Op. No."><div className="process-operation-number">
              {(() => {
                const draftKey = operationNumberDraftKey(row, index);
                return <input className="small" inputMode="numeric" pattern="[0-9]*" value={operationNumberDrafts[draftKey] ?? row.operationNumber} readOnly={readOnly}
                  aria-label={`Operation number for process row ${index + 1}`}
                  onChange={(event) => setOperationNumberDrafts((drafts) => ({ ...drafts, [draftKey]: event.target.value }))}
                  onBlur={(event) => commitOperationNumber(index, draftKey, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitOperationNumber(index, draftKey, event.currentTarget.value);
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setOperationNumberDrafts((drafts) => {
                        const { [draftKey]: _draft, ...remainingDrafts } = drafts;
                        return remainingDrafts;
                      });
                      event.currentTarget.value = String(row.operationNumber || "");
                      event.currentTarget.blur();
                    }
                  }}/>;
              })()}
              {!readOnly && value.operations.length > 1 && <label className="process-operation-swap" title="Swap this entire operation with another operation number"><ArrowLeftRight size={13}/><select value="" aria-label={`Swap operation ${row.operationNumber} with another operation`} onChange={(event) => {
                const targetIndex = Number(event.target.value);
                if (Number.isInteger(targetIndex) && targetIndex >= 0) swapOperationPackages(index, targetIndex);
              }}><option value="">Swap…</option>{value.operations.map((entry, targetIndex) => targetIndex !== index && <option key={entry.processOperationId ?? entry.processDefinitionId ?? `operation-${targetIndex}`} value={targetIndex}>Op. {entry.operationNumber}</option>)}</select></label>}
            </div></td>
            <td data-label="Operation Name"><select data-process-operation-index={index} value={row.operationMasterId} disabled={readOnly} onChange={(e) => {
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
            <td data-label="Program"><div className="operation-sequence-control"><button type="button" className={`inspection-configure program-configure ${row.documentApprovals?.program ? "ready" : ""}`} onClick={() => openProgram(index)}><FileCode2 size={15}/>{row.documentApprovals?.program ? "Approved" : row.program?.revisionNumber ? `Rev ${row.program.revisionNumber}` : "Configure"}</button></div></td>
            <td data-label="Source"><select value={row.sourceType} disabled title="Source is controlled by Operation Name Master"><option value="">Select source</option>{masters.sources.map((source) => <option key={source.sourceCode} value={source.sourceCode}>{source.sourceName}</option>)}</select></td>
            <td data-label="Machine Type">{!isOutsource(row) ? <select value={row.machineTypeId} disabled={readOnly} onChange={(e) => updateOperation(index, "machineTypeId", e.target.value)}><option value="">Select Machine Type</option>{masters.machineTypes.map((entry) => <option key={entry.machineTypeId} value={entry.machineTypeId}>{entry.machineTypeCode} - {entry.machineTypeName} (INR {Number(entry.hourlyCostInr || 0).toFixed(2)}/hr)</option>)}</select> : <input value="Not applicable" disabled/>}</td>
            <td data-label="Cycle Time (Sec)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" value={row.cycleTimeSeconds} onChange={(e) => updateOperation(index, "cycleTimeSeconds", e.target.value)}/></td>
            <td data-label="Clamping (Sec)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" value={row.clampingTimeSeconds} onChange={(e) => updateOperation(index, "clampingTimeSeconds", e.target.value)}/></td>
            <td data-label="Setting (Hrs)"><input disabled={isOutsource(row)} readOnly={readOnly} type="number" min="0" step="0.01" value={row.settingTimeHours} onChange={(e) => updateOperation(index, "settingTimeHours", e.target.value)} onKeyDown={(event) => !isOutsource(row) && addOperationOnFinalEnter(event, index)}/></td>
            <td data-label="Process Cost">{isOutsource(row) ? <input type="number" min="0" step="0.01" value={row.outsourceCostInr} readOnly={readOnly} onChange={(e) => updateOperation(index, "outsourceCostInr", e.target.value)} onKeyDown={(event) => addOperationOnFinalEnter(event, index)} placeholder="Enter outsource cost"/> : <strong>{money(calculatedCost(row))}</strong>}</td>
            <td data-label="Tool List"><div className="operation-sequence-control"><button type="button" className={`inspection-configure tool-list-configure ${row.documentApprovals?.toolList ? "ready" : ""}`} onClick={() => openToolList(index)}><FileSpreadsheet size={15}/>{row.documentApprovals?.toolList ? "Approved" : row.toolList ? "Configured" : "Configure"}</button></div></td>
            <td data-label="Inspection Plan"><div className="operation-sequence-control"><button type="button" disabled={readOnly && !row.inspectionPlan} className={`inspection-configure ${row.inspectionPlan?.approvalStatus === "APPROVED" ? "ready" : row.inspectionPlan?.planStatus.toLowerCase() || ""}`} onClick={() => configure(index)}><ClipboardCheck size={15}/>{row.inspectionPlan?.approvalStatus === "APPROVED" ? "Approved" : row.inspectionPlan ? row.inspectionPlan.planStatus : "Not Configured"}</button></div></td>
            <td data-label="Work Instructions"><div className="operation-sequence-control"><button type="button" className={`inspection-configure ${row.documentApprovals?.workInstructions ? "ready" : ""}`} onClick={() => openWorkInstructions(index)}><FileText size={15}/>{row.documentApprovals?.workInstructions ? "Approved" : row.instructionAttachments.length ? `${row.instructionAttachments.length} file(s)` : "Configure"}</button></div></td>
            <td data-label="Actions">{!readOnly && <button type="button" className="marketing-delete-line-button" onClick={() => onChange({ ...value, operations: value.operations.filter((_, i) => i !== index), planStatus: "DRAFT" })}><Trash2 size={15}/></button>}</td>
          </tr>;
        })}
      </tbody>
      {!!value.operations.length && <tfoot><tr className="part-process-total-row">
        <td className="part-process-total-message" colSpan={10}>{!allProcessesReady && <small>Approve the Program, Tool List, Work Instructions and Inspection Plan for every operation before approval.</small>}</td>
        <td className="part-process-total-label">Total Process Cost</td>
        <td className="part-process-total-value"><strong>{money(value.operations.reduce((sum, row) => sum + calculatedCost(row), 0))}</strong></td>
        <td colSpan={3}>{!readOnly && <button type="button" className="primary-action-button" disabled={!processPlanCanBeApproved} title={!processPlanCanBeApproved ? "Save / update the Part before approval" : allProcessesReady ? "Approve & Release Process Plan" : "Show the incomplete approval items"} onClick={() => void approveProcessPlan()}>Approve & Release Process Plan</button>}</td>
      </tr></tfoot>}
    </table></div>

    {activeProgramOperation && activeProgramIndex !== null && programDraft && <div className="inspection-page-overlay" role="dialog" aria-modal="true" aria-label={`Program - Operation ${activeProgramOperation.operationNumber}`}>
      <section className="inspection-page program-page">
        <header><div><FileCode2 size={19}/><div><h3>Program - Operation {activeProgramOperation.operationNumber}</h3><p>{operationName(activeProgramOperation)}</p></div></div><button type="button" aria-label="Close Program" onClick={() => { setActiveProgramIndex(null); setProgramDraft(null); setProgramSaveNotice(null); }}><X size={18}/></button></header>
        <main className="program-modal-content">
          <fieldset disabled={readOnly} className="program-readonly-fieldset">
            <section className="program-document">
              <div className="program-document-title"><FileCode2 size={24}/><div><h4>Program Screen</h4><p>Maintain the NC program as free text. Each changed save creates the next revision.</p></div></div>
              {programSaveNotice && <div className={`document-save-notice ${programSaveNotice.tone}`} role={programSaveNotice.tone === "error" ? "alert" : "status"}>{programSaveNotice.message}</div>}
              <div className="program-metadata">
                <label><span>Part No.</span><input value={printContext.partNumber} readOnly/></label>
                <label><span>Part Name</span><input value={printContext.partName} readOnly/></label>
                <label><span>Date</span><input value={new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())} readOnly/></label>
                <label><span>Program No.</span><input value={programDraft.programNumber} onChange={(event) => { setProgramSaveNotice(null); setProgramDraft({ ...programDraft, programNumber: event.target.value }); }} placeholder="Enter program number"/></label>
                <label><span>Operation No.</span><input value={activeProgramOperation.operationNumber} readOnly/></label>
                <label className="program-revision-field"><span>Rev</span><input value={programDraft.revisionNumber ? String(programDraft.revisionNumber) : "New"} readOnly/></label>
              </div>
              <label className="program-text-field"><span>Program</span><textarea value={programDraft.programText} onChange={(event) => { setProgramSaveNotice(null); setProgramDraft({ ...programDraft, programText: event.target.value }); }} placeholder="Enter program text..." spellCheck={false}/></label>
              <section className="program-revision-history"><h5>Revision History</h5>{programDraft.revisionHistory.length ? <table><thead><tr><th>Revision No.</th><th>Person Done</th><th>Date &amp; Time</th></tr></thead><tbody>{programDraft.revisionHistory.map((entry, index) => <tr key={`${entry.revisionNumber}-${entry.changedOn}-${index}`}><td>Rev {entry.revisionNumber}</td><td>{entry.changedBy}</td><td>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.changedOn))}</td></tr>)}</tbody></table> : <p>No revision has been saved yet.</p>}</section>
            </section>
          </fieldset>
        </main>
        {pendingProgramUpdate && <div className="program-revision-choice-overlay" role="presentation">
          <section className="program-revision-choice" role="dialog" aria-modal="true" aria-labelledby="program-revision-choice-title">
            <header><FileCode2 size={20}/><div><h4 id="program-revision-choice-title">Create Program revision?</h4><p>Choose whether this update needs a new revision number.</p></div></header>
            <main><strong>Current revision: Rev {pendingProgramUpdate.current.revisionNumber}</strong><span>Create Rev {pendingProgramUpdate.nextRevision} to record this change in revision history.</span></main>
            <footer><button type="button" className="secondary-action-button" disabled={saving} onClick={() => void persistProgramUpdate(pendingProgramUpdate, false)}>Not Required</button><button type="button" className="primary-action-button" disabled={saving} onClick={() => void persistProgramUpdate(pendingProgramUpdate, true)}>Create Rev {pendingProgramUpdate.nextRevision}</button><button type="button" className="secondary-action-button" disabled={saving} onClick={() => setPendingProgramUpdate(null)}>Cancel</button></footer>
          </section>
        </div>}
        <footer>{!readOnly && <><button type="button" className="inspection-status-action ready" disabled={saving} onClick={() => void saveProgram()}><Save size={15}/>{saving ? "Saving Program..." : programDraft.revisionNumber ? "Update Program" : "Save Program"}</button><button type="button" className={`inspection-status-action ${activeProgramOperation.documentApprovals?.program ? "ready" : ""}`} title={!canApproveDocuments || !activeProgramOperation.processDefinitionId ? "Save / update the Part before approval" : undefined} onClick={approveProgram} disabled={!canApproveDocuments || !activeProgramOperation.processDefinitionId || activeProgramOperation.documentApprovals?.program}><ClipboardCheck size={15}/>{activeProgramOperation.documentApprovals?.program ? "Program Approved" : "Approve Program"}</button></>}<button type="button" className="secondary-action-button" onClick={() => { setActiveProgramIndex(null); setProgramDraft(null); setProgramSaveNotice(null); }}>Close</button></footer>
      </section>
    </div>}

    {activeToolListOperation && activeToolListIndex !== null && <div className="inspection-page-overlay" role="dialog" aria-modal="true" aria-label={`Tool List - Operation ${activeToolListOperation.operationNumber}`}>
      <section className="inspection-page tool-list-page">
        <header><div><FileSpreadsheet size={19}/><div><h3>Tool List - Operation {activeToolListOperation.operationNumber}</h3><p>{operationName(activeToolListOperation)}{activeToolListOperation.programNumber ? ` · Program: ${activeToolListOperation.programNumber}` : ""}</p></div></div><button type="button" aria-label="Close Tool List" onClick={() => { setActiveToolListIndex(null); setToolListMaterialDraft(null); setToolListSaveNotice(null); }}><X size={18}/></button></header>
        <main className="tool-list-modal-content">
          <fieldset disabled={readOnly} className="tool-list-readonly-fieldset">
            <section className="tool-list-document">
              <div className="tool-list-document-title"><FileSpreadsheet size={24}/><div><h4>Tool List</h4><p>Enter the same operation, tool and cost fields from the approved Tool List format.</p></div></div>
              {toolListSaveNotice && <div className={`document-save-notice ${toolListSaveNotice.tone}`} role={toolListSaveNotice.tone === "error" ? "alert" : "status"}>{toolListSaveNotice.message}</div>}
              <div className="tool-list-metadata">
                <label><span>Drg No.</span><input value={printContext.drawingNumber} readOnly/></label>
                <label><span>Drawing Code</span><input value={printContext.drawingCode} readOnly/></label>
                <label><span>Program Number</span><input value={activeToolListOperation.programNumber} readOnly/></label>
                <label><span>Machine</span><input value={activeToolListMachine ? `${activeToolListMachine.machineTypeCode} - ${activeToolListMachine.machineTypeName}` : ""} readOnly/></label>
                <label><span>Customer</span><input value={printContext.customerName} readOnly/></label>
                <label><span>Cycle Time</span><input value={activeToolListOperation.cycleTimeSeconds ? `${activeToolListOperation.cycleTimeSeconds} sec` : ""} readOnly/></label>
                <label><span>Name</span><input value={printContext.partName} readOnly/></label>
                <label><span>Operation No.</span><input value={activeToolListOperation.operationNumber} readOnly/></label>
                <label><span>Fixture Number</span><input value={activeToolList.fixtureNumber} onChange={(event) => updateToolListHeader("fixtureNumber", event.target.value)}/></label>
                <label><span>Material</span><input value={toolListMaterialDraft ?? activeToolList.material} onChange={(event) => { setToolListMaterialDraft(event.target.value); updateToolListHeader("material", event.target.value); }} placeholder="Enter material specification"/></label>
                <label><span>Number of Tools</span><input value={String(activeToolList.toolRows.length)} readOnly/></label>
                <label><span>Clamping Time</span><input value={activeToolListOperation.clampingTimeSeconds ? `${activeToolListOperation.clampingTimeSeconds} sec` : ""} readOnly/></label>
                <label><span>Date</span><input type="date" value={activeToolList.documentDate} onChange={(event) => updateToolListHeader("documentDate", event.target.value)}/></label>
              </div>
              <div className="tool-list-modal-toolbar"><div role="tablist" aria-label="Tool List sections"><button type="button" role="tab" aria-selected={toolListTab === "TOOLS"} className={toolListTab === "TOOLS" ? "active" : ""} onClick={() => setToolListTab("TOOLS")}>Tool List</button><button type="button" role="tab" aria-selected={toolListTab === "COSTS"} className={toolListTab === "COSTS" ? "active" : ""} onClick={() => setToolListTab("COSTS")}>Cost per Component</button></div>{!readOnly && <div className="tool-list-modal-actions"><input ref={toolListImportInputRef} type="file" hidden accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                void importToolList(file);
              }}/><button type="button" className="secondary-action-button" title="Import tools and cost rows from the approved Tool List workbook" disabled={saving || importingToolList} onClick={() => toolListImportInputRef.current?.click()}><Upload size={15}/>{importingToolList ? "Importing..." : "Import Excel"}</button><button type="button" className="marketing-add-line-button" onClick={toolListTab === "TOOLS" ? addToolListRow : addToolListCostRow}><Plus size={15}/>{toolListTab === "TOOLS" ? "Add Tool" : "Add Cost Row"}</button></div>}</div>
              {toolListTab === "TOOLS" ? <div className="tool-list-grid-wrap"><table className="tool-list-grid"><thead><tr><th>S.No.</th><th>Tool Ø</th><th>Tool Name</th><th>RPM</th><th>Feed</th><th>Holder Name</th><th>Holder Length</th><th>Collet Size</th><th>Tool / Insert Spec</th><th>Make</th><th>Tool Number</th><th>Tool Clamping Detail</th><th>Height Offset</th><th>Tool Flute Length</th><th>Tool Overhang Details</th><th>Tool Life</th><th/></tr></thead><tbody>{activeToolList.toolRows.length ? activeToolList.toolRows.map((tool, rowIndex) => <tr key={`tool-${rowIndex}`}><td>{rowIndex + 1}</td><td><input value={tool.toolDiameter} onChange={(event) => updateToolListRow(rowIndex, "toolDiameter", event.target.value)}/></td><td><input value={tool.toolName} onChange={(event) => updateToolListRow(rowIndex, "toolName", event.target.value)}/></td><td><input value={tool.rpm} onChange={(event) => updateToolListRow(rowIndex, "rpm", event.target.value)}/></td><td><input value={tool.feed} onChange={(event) => updateToolListRow(rowIndex, "feed", event.target.value)}/></td><td><input value={tool.holderName} onChange={(event) => updateToolListRow(rowIndex, "holderName", event.target.value)}/></td><td><input value={tool.holderLength} onChange={(event) => updateToolListRow(rowIndex, "holderLength", event.target.value)}/></td><td><input value={tool.colletSize} onChange={(event) => updateToolListRow(rowIndex, "colletSize", event.target.value)}/></td><td><input value={tool.toolInsertSpecification} onChange={(event) => updateToolListRow(rowIndex, "toolInsertSpecification", event.target.value)}/></td><td><input value={tool.toolMake} onChange={(event) => updateToolListRow(rowIndex, "toolMake", event.target.value)}/></td><td><input value={tool.toolNumber} onChange={(event) => updateToolListRow(rowIndex, "toolNumber", event.target.value)}/></td><td><input value={tool.toolClampingDetail} onChange={(event) => updateToolListRow(rowIndex, "toolClampingDetail", event.target.value)}/></td><td><input value={tool.heightOffset} onChange={(event) => updateToolListRow(rowIndex, "heightOffset", event.target.value)}/></td><td><input value={tool.toolFluteLength} onChange={(event) => updateToolListRow(rowIndex, "toolFluteLength", event.target.value)}/></td><td><input value={tool.toolOverhangDetails} onChange={(event) => updateToolListRow(rowIndex, "toolOverhangDetails", event.target.value)}/></td><td><input value={tool.toolLife} onChange={(event) => updateToolListRow(rowIndex, "toolLife", event.target.value)}/></td><td>{!readOnly && <button type="button" className="marketing-delete-line-button" aria-label={`Delete tool row ${rowIndex + 1}`} onClick={() => updateToolList(activeToolListIndex, { ...activeToolList, toolRows: activeToolList.toolRows.filter((_, index) => index !== rowIndex) })}><Trash2 size={15}/></button>}</td></tr>) : <tr><td colSpan={17} className="tool-list-empty-row">No tools added. Select Add Tool to begin.</td></tr>}</tbody></table></div> : <div className="tool-list-grid-wrap"><table className="tool-list-grid tool-list-cost-grid"><thead><tr><th>S.No.</th><th>Tool Dia</th><th>Tool Name</th><th>Insert Specification</th><th>Insert or Tool Rate</th><th>Number of Edge</th><th>Number of Pocket</th><th>Tool Life per Edge</th><th>Life of Overall Edge</th><th>Cost per Component</th><th/></tr></thead><tbody>{activeToolList.costRows.length ? activeToolList.costRows.map((cost, rowIndex) => <tr key={`cost-${rowIndex}`}><td>{rowIndex + 1}</td><td><input value={cost.toolDiameter} onChange={(event) => updateToolListCostRow(rowIndex, "toolDiameter", event.target.value)}/></td><td><input value={cost.toolName} onChange={(event) => updateToolListCostRow(rowIndex, "toolName", event.target.value)}/></td><td><input value={cost.insertSpecification} onChange={(event) => updateToolListCostRow(rowIndex, "insertSpecification", event.target.value)}/></td><td><input inputMode="decimal" value={cost.insertOrToolRate} onChange={(event) => updateToolListCostRow(rowIndex, "insertOrToolRate", event.target.value)}/></td><td><input inputMode="numeric" value={cost.numberOfEdges} onChange={(event) => updateToolListCostRow(rowIndex, "numberOfEdges", event.target.value)}/></td><td><input inputMode="numeric" value={cost.numberOfPockets} onChange={(event) => updateToolListCostRow(rowIndex, "numberOfPockets", event.target.value)}/></td><td><input inputMode="numeric" value={cost.toolLifePerEdge} onChange={(event) => updateToolListCostRow(rowIndex, "toolLifePerEdge", event.target.value)}/></td><td><input inputMode="numeric" value={cost.lifeOfOverallEdge} onChange={(event) => updateToolListCostRow(rowIndex, "lifeOfOverallEdge", event.target.value)}/></td><td className="tool-list-calculated-cost">{costPerComponent(cost)}</td><td>{!readOnly && <button type="button" className="marketing-delete-line-button" aria-label={`Delete cost row ${rowIndex + 1}`} onClick={() => updateToolList(activeToolListIndex, { ...activeToolList, costRows: activeToolList.costRows.filter((_, index) => index !== rowIndex) })}><Trash2 size={15}/></button>}</td></tr>) : <tr><td colSpan={11} className="tool-list-empty-row">No cost rows added. Select Add Cost Row to begin.</td></tr>}</tbody></table></div>}
              <div className="tool-list-sign-off"><label><span>Prepared By</span><input value={activeToolList.preparedBy} onChange={(event) => updateToolListHeader("preparedBy", event.target.value)}/></label><label><span>Checked By</span><input value={activeToolList.checkedBy} onChange={(event) => updateToolListHeader("checkedBy", event.target.value)}/></label><label><span>Approved By</span><input value={activeToolList.approvedBy} onChange={(event) => updateToolListHeader("approvedBy", event.target.value)}/></label><label><span>Last Rev Date</span><input type="date" value={activeToolList.lastRevisionDate} onChange={(event) => updateToolListHeader("lastRevisionDate", event.target.value)}/></label><label><span>Signature</span><input value={activeToolList.signature} onChange={(event) => updateToolListHeader("signature", event.target.value)}/></label><label className="tool-list-remarks"><span>Remarks</span><textarea value={activeToolList.remarks} onChange={(event) => updateToolListHeader("remarks", event.target.value)}/></label></div>
            </section>
          </fieldset>
        </main>
        <footer>{!readOnly && <><button type="button" className="inspection-status-action ready" disabled={saving} onClick={() => void saveToolList()}><Save size={15}/>{saving ? "Saving Tool List..." : "Save Tool List"}</button><button type="button" className={`inspection-status-action ${activeToolListOperation.documentApprovals?.toolList ? "ready" : ""}`} title={!canApproveDocuments || !activeToolListOperation.processDefinitionId ? "Save / update the Part before approval" : undefined} onClick={approveToolList} disabled={!canApproveDocuments || !activeToolListOperation.processDefinitionId || activeToolListOperation.documentApprovals?.toolList}><ClipboardCheck size={15}/>{activeToolListOperation.documentApprovals?.toolList ? "Tool List Approved" : "Approve Tool List"}</button></>}<button type="button" className="secondary-action-button" onClick={() => { setActiveToolListIndex(null); setToolListMaterialDraft(null); setToolListSaveNotice(null); }}>Close</button></footer>
      </section>
    </div>}

    {activeWorkInstructionOperation && activeWorkInstructionIndex !== null && <div className="inspection-page-overlay" role="dialog" aria-modal="true" aria-label={`Work Instructions - Operation ${activeWorkInstructionOperation.operationNumber}`}>
      <section className="inspection-page work-instructions-page">
        <header><div><FileText size={19}/><div><h3>Work Instructions - Operation {activeWorkInstructionOperation.operationNumber}</h3><p>{operationName(activeWorkInstructionOperation)}</p></div></div><button type="button" aria-label="Close Work Instructions" onClick={() => { setActiveWorkInstructionIndex(null); setWorkInstructionSaveNotice(null); }}><X size={18}/></button></header>
        <main className="work-instructions-modal-content"><fieldset disabled={readOnly} className="tool-list-readonly-fieldset"><section className="work-instructions-document"><div className="tool-list-document-title"><FileText size={24}/><div><h4>Work Instructions</h4><p>Attach the controlled instructions for this operation, then save and approve the document.</p></div></div>{workInstructionSaveNotice && <div className={`document-save-notice ${workInstructionSaveNotice.tone}`} role={workInstructionSaveNotice.tone === "error" ? "alert" : "status"}>{workInstructionSaveNotice.message}</div>}{!readOnly && <label className="process-instruction-upload work-instruction-upload"><Upload size={15}/>Add files<input type="file" multiple onChange={(event) => { addInstructionFiles(activeWorkInstructionIndex, event.currentTarget.files); event.currentTarget.value = ""; }}/></label>}{activeWorkInstructionOperation.instructionAttachments.length ? <ul className="work-instruction-file-list">{activeWorkInstructionOperation.instructionAttachments.map((attachment, attachmentIndex) => <li key={attachment.attachmentId ?? `${attachment.fileName || attachment.attachmentName}-${attachmentIndex}`}>{attachment.fileUrl ? <a href={attachmentFileUrl(attachment.fileUrl)} target="_blank" rel="noreferrer">{attachment.fileName || attachment.attachmentName}</a> : <span>{attachment.fileName || attachment.attachmentName}</span>}{!readOnly && <button type="button" className="process-instruction-remove" onClick={() => void removeInstructionAttachment(activeWorkInstructionIndex, attachmentIndex)} aria-label={`Remove work instruction ${attachment.fileName || attachment.attachmentName}`}><X size={13}/></button>}</li>)}</ul> : <p className="work-instruction-empty">No Work Instructions attached yet.</p>}</section></fieldset></main>
        <footer>{!readOnly && <><button type="button" className="inspection-status-action ready" disabled={saving} onClick={() => void saveWorkInstructions()}><Save size={15}/>{saving ? "Saving Work Instructions..." : "Save Work Instructions"}</button><button type="button" className={`inspection-status-action ${activeWorkInstructionOperation.documentApprovals?.workInstructions ? "ready" : ""}`} title={!canApproveDocuments || !activeWorkInstructionOperation.processDefinitionId ? "Save / update the Part before approval" : undefined} onClick={approveWorkInstructions} disabled={!canApproveDocuments || !activeWorkInstructionOperation.processDefinitionId || activeWorkInstructionOperation.documentApprovals?.workInstructions}><ClipboardCheck size={15}/>{activeWorkInstructionOperation.documentApprovals?.workInstructions ? "Work Instructions Approved" : "Approve Work Instructions"}</button></>}<button type="button" className="secondary-action-button" onClick={() => { setActiveWorkInstructionIndex(null); setWorkInstructionSaveNotice(null); }}>Close</button></footer>
      </section>
    </div>}

    {activeOperation?.inspectionPlan && <div className="inspection-page-overlay" role="dialog" aria-modal="true" aria-label={`Inspection Plan - Operation ${activeOperation.operationNumber}`}>
      <section className="inspection-page">
        <header><div><ClipboardCheck size={19}/><div><h3>Inspection Plan - Operation {activeOperation.operationNumber}</h3><p>{operationName(activeOperation)}{activeOperation.programNumber ? ` · Program: ${activeOperation.programNumber}` : ""}</p></div></div><button type="button" aria-label="Close Inspection Plan" onClick={() => setActiveIndex(null)}><X size={18}/></button></header>
        {activeOperation.programNumber && <div className="inspection-operation-resources"><span><strong>Program No.</strong>{activeOperation.programNumber}</span></div>}
        <fieldset disabled={readOnly} className="inspection-readonly-fieldset">
        <div className="inspection-modal-toolbar"><div className="inspection-toolbar-actions"><div className="inspection-standard-entry inspection-standard-toolbar"><div className="inspection-standard-field"><strong>Tol Standard</strong><select disabled={activeOperation.inspectionPlan.measurementUnit === "INCH"} value={activeOperation.inspectionPlan.toleranceStandardId} onChange={(event) => updateInspectionToleranceStandard(event.target.value)}><option value="">No common standard</option>{masters.toleranceStandards.map((entry) => <option key={entry.toleranceStandardId} value={entry.toleranceStandardId}>{entry.standardName}</option>)}</select></div><small>{activeOperation.inspectionPlan.measurementUnit === "INCH" ? "Standards apply to mm plans only" : "Used when a row has no tolerance grade"}</small></div><div className="inspection-unit-control" role="group" aria-label="Inspection measurement unit"><strong>Unit</strong><label><input type="radio" name={`inspection-unit-${activeIndex}`} checked={activeOperation.inspectionPlan.measurementUnit !== "INCH"} onChange={() => updateInspectionMeasurementUnit("MM")}/>mm</label><label><input type="radio" name={`inspection-unit-${activeIndex}`} checked={activeOperation.inspectionPlan.measurementUnit === "INCH"} onChange={() => updateInspectionMeasurementUnit("INCH")}/>inch</label></div><div className="inspection-cmm-control" role="group" aria-label="CMM"><strong>CMM</strong><label><input type="radio" name={`cmm-${activeIndex}`} checked={activeOperation.inspectionPlan.cmmRequired} onChange={() => updateCmmRequired(true)}/>On</label><label><input type="radio" name={`cmm-${activeIndex}`} checked={!activeOperation.inspectionPlan.cmmRequired} onChange={() => updateCmmRequired(false)}/>Off</label></div><button type="button" className="marketing-add-line-button" onClick={() => {
          const next = { ...activeOperation.inspectionPlan!, planStatus: "READY" as const, characteristics: [...activeOperation.inspectionPlan!.characteristics, blankCharacteristic()] };
          updateOperation(activeIndex!, "inspectionPlan", next);
        }}><Plus size={15}/>Add Characteristic</button>{!readOnly && <><input ref={inspectionImportInputRef} type="file" hidden accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = "";
          void importInspectionPlan(file);
        }}/><button type="button" className="secondary-action-button" title="Use an Inspection Plan file downloaded with Export Excel" disabled={saving || importingInspectionPlan} onClick={() => inspectionImportInputRef.current?.click()}><Upload size={15}/>{importingInspectionPlan ? "Importing..." : "Import Excel"}</button></>}</div></div>

        <datalist id="inspection-characteristic-options">{masters.characteristics.map((entry) => <option key={entry.characteristicMasterId} value={entry.characteristicName}>{entry.characteristicCode}</option>)}</datalist>
        <datalist id="inspection-tolerance-grade-options">{toleranceGradeCodes.map((gradeCode) => <option key={gradeCode} value={gradeCode}/>)}</datalist>

        <div className="inspection-grid-wrap"><table className="inspection-grid" onKeyDownCapture={moveGridFocus}>
          <thead><tr><th>S.No.</th><th className="inspection-balloon-column">Balloon No.</th><th>Characteristic</th><th>Specified Dimension ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>Tol Grade</th><th>Tol− ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>Tol+ ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>LSL ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>USL ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>Drg Grid</th><th>Instrument / Gauge</th><th>Sample Size</th><th>Inspection Frequency</th><th>SC / CC</th><th>Patrol Inspection QA</th><th className="inspection-periodic-column">Periodic Inspection Operator</th><th>Final</th><th/></tr></thead>
          <tbody>{activeOperation.inspectionPlan.characteristics.map((row, index) => {
            const isInchPlan = activeOperation.inspectionPlan.measurementUnit === "INCH";
            const matchedGrade = matchingToleranceGrade(row, isInchPlan ? "INCH" : "MM");
            const matchedStandardBand = matchingToleranceStandardBand(row, activeOperation.inspectionPlan!.toleranceStandardId, isInchPlan ? "INCH" : "MM");
            const standardHasNumericTolerance = matchedStandardBand?.toleranceMinusMm !== null && matchedStandardBand?.toleranceMinusMm !== undefined
              && matchedStandardBand?.tolerancePlusMm !== null && matchedStandardBand?.tolerancePlusMm !== undefined;
            return <tr key={row.inspectionCharacteristicId ?? `characteristic-${index}`}>
              <td><button type="button" className="inspection-serial-clone-button" title={`Clone inspection row ${index + 1}`} aria-label={`Clone inspection row ${index + 1}`} onClick={() => cloneCharacteristic(index)}><span>{index + 1}</span><CopyPlus size={13}/></button></td>
              <td className="inspection-balloon-column"><input data-inspection-balloon-index={index} value={row.balloonNumber} onChange={(e) => updateCharacteristic(index, "balloonNumber", e.target.value)}/></td>
              <td><div className="inspection-search-picker"><input list="inspection-characteristic-options" value={row.characteristicSearch} onChange={(e) => updateCharacteristicSearch(index, e.target.value)} placeholder="Search or enter characteristic"/><small className={row.characteristicMasterId ? "matched" : row.characteristicText ? "manual" : ""}>{row.characteristicMasterId ? "Master matched" : row.characteristicText ? "Free text characteristic" : "Search or type a characteristic"}</small></div></td>
              <td><input type="number" step="0.0001" value={row.specifiedDimension} onChange={(e) => updateCharacteristic(index, "specifiedDimension", e.target.value)}/></td>
              <td><div className="inspection-grade-entry"><input disabled={isInchPlan} list="inspection-tolerance-grade-options" value={row.toleranceGradeText} onChange={(e) => updateCharacteristic(index, "toleranceGradeText", e.target.value)} placeholder={isInchPlan ? "Not used for inch" : "Type grade"}/><small className={matchedGrade ? "matched" : "manual"}>{isInchPlan ? "Enter inch tolerance manually" : matchedGrade ? "Grade matched" : standardHasNumericTolerance ? `${matchedStandardBand?.rangeLabel}: ${matchedStandardBand?.toleranceDisplay}` : "Manual / common standard"}</small></div></td>
              <td><input readOnly={Boolean(matchedGrade)} type="number" min="0" step="0.0001" value={row.toleranceMinus} onChange={(e) => updateCharacteristic(index, "toleranceMinus", e.target.value)}/></td>
              <td><input readOnly={Boolean(matchedGrade)} type="number" min="0" step="0.0001" value={row.tolerancePlus} onChange={(e) => updateCharacteristic(index, "tolerancePlus", e.target.value)}/></td>
              <td><input readOnly value={row.lsl}/></td>
              <td><input readOnly value={row.usl}/></td>
              <td><input value={row.drawingGrid} onChange={(e) => updateCharacteristic(index, "drawingGrid", e.target.value)}/></td>
              <td><select value={row.instrumentMasterId} onChange={(e) => updateCharacteristic(index, "instrumentMasterId", e.target.value)}><option value="">Select</option>{masters.instruments.map((entry) => <option key={entry.instrumentMasterId} value={entry.instrumentMasterId}>{entry.instrumentName}</option>)}</select></td>
              <td><select value={row.sampleSize} onChange={(e) => updateCharacteristic(index, "sampleSize", e.target.value)}><option value="">Select</option>{masters.sampleSizes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
              <td><select value={row.inspectionFrequency} onChange={(e) => updateCharacteristic(index, "inspectionFrequency", e.target.value)}><option value="">Select</option>{masters.frequencies.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></td>
              <td><input type="radio" checked={row.scCcIdentification} aria-label={`Toggle SC / CC for inspection row ${index + 1}`} onClick={() => updateCharacteristic(index, "scCcIdentification", !row.scCcIdentification)} onKeyDown={(event) => {
                if (event.key === " " || event.code === "Space") {
                  event.preventDefault();
                  updateCharacteristic(index, "scCcIdentification", !row.scCcIdentification);
                }
              }} readOnly/></td>
              <td><input type="radio" checked={row.patrolInspectionQaRequired} aria-label={`Toggle Patrol Inspection QA for inspection row ${index + 1}`} onClick={() => updateCharacteristic(index, "patrolInspectionQaRequired", !row.patrolInspectionQaRequired)} onKeyDown={(event) => {
                if (event.key === " " || event.code === "Space") {
                  event.preventDefault();
                  updateCharacteristic(index, "patrolInspectionQaRequired", !row.patrolInspectionQaRequired);
                }
              }} readOnly/></td>
              <td className="inspection-periodic-column"><input type="radio" checked={row.periodicOperatorRequired} aria-label={`Toggle periodic inspection operator for inspection row ${index + 1}`} onClick={() => updateCharacteristic(index, "periodicOperatorRequired", !row.periodicOperatorRequired)} onKeyDown={(event) => {
                if (event.key === " " || event.code === "Space") {
                  event.preventDefault();
                  updateCharacteristic(index, "periodicOperatorRequired", !row.periodicOperatorRequired);
                }
              }} readOnly/></td>
              <td><input type="radio" checked={row.finalInspectionRequired} aria-label={`Toggle final inspection for inspection row ${index + 1}`} onClick={() => updateCharacteristic(index, "finalInspectionRequired", !row.finalInspectionRequired)} onKeyDown={(event) => {
                if (event.key === " " || event.code === "Space") {
                  event.preventDefault();
                  updateCharacteristic(index, "finalInspectionRequired", !row.finalInspectionRequired);
                  return;
                }
                addCharacteristicOnFinalEnter(event, index);
              }} readOnly/></td>
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
        <article className="inspection-print-document" aria-hidden="true">
          <header><h1>Inspection Plan</h1><dl><div><dt>Operation No.</dt><dd>{activeOperation.operationNumber || "—"}</dd></div><div><dt>Operation</dt><dd>{operationName(activeOperation)}</dd></div><div><dt>Tolerance Standard</dt><dd>{toleranceStandardLabel(activeOperation.inspectionPlan.toleranceStandardId) || "—"}</dd></div><div><dt>Measurement Unit</dt><dd>{activeOperation.inspectionPlan.measurementUnit === "INCH" ? "Inch" : "mm"}</dd></div><div><dt>CMM Required</dt><dd>{activeOperation.inspectionPlan.cmmRequired ? "Yes" : "No"}</dd></div></dl></header>
          <table><thead><tr><th>S.No.</th><th>Balloon No.</th><th>Characteristic</th><th>Specified Dimension ({activeOperation.inspectionPlan.measurementUnit === "INCH" ? "in" : "mm"})</th><th>Tol Grade</th><th>Tol−</th><th>Tol+</th><th>LSL</th><th>USL</th><th>Drg Grid</th><th>Instrument / Gauge</th><th>Sample Size</th><th>Inspection Frequency</th><th>SC / CC</th><th>Patrol Inspection QA</th><th>Periodic Operator</th><th>Final</th></tr></thead><tbody>{activeOperation.inspectionPlan.characteristics.map((row, index) => <tr key={`print-${row.inspectionCharacteristicId ?? index}`}><td>{index + 1}</td><td>{row.balloonNumber || "—"}</td><td>{characteristicLabel(row) || "—"}</td><td>{row.specifiedDimension || "—"}</td><td>{row.toleranceGradeText || "—"}</td><td>{row.toleranceMinus || "—"}</td><td>{row.tolerancePlus || "—"}</td><td>{row.lsl || "—"}</td><td>{row.usl || "—"}</td><td>{row.drawingGrid || "—"}</td><td>{instrumentLabel(row.instrumentMasterId) || "—"}</td><td>{row.sampleSize || "—"}</td><td>{row.inspectionFrequency || "—"}</td><td>{row.scCcIdentification ? "Yes" : "No"}</td><td>{row.patrolInspectionQaRequired ? "Yes" : "No"}</td><td>{row.periodicOperatorRequired ? "Yes" : "No"}</td><td>{row.finalInspectionRequired ? "Yes" : "No"}</td></tr>)}</tbody></table>
        </article>
        <footer>{!readOnly && <button type="button" className="inspection-delete-plan" onClick={() => {
          updateOperation(activeIndex!, "inspectionPlan", null);
          setActiveIndex(null);
        }}><Trash2 size={14}/>Delete Inspection Plan</button>}{!readOnly && <button type="button" className={`inspection-status-action ${activeOperation.inspectionPlan.approvalStatus === "APPROVED" ? "ready" : ""}`} title={!canApproveDocuments || !activeOperation.processDefinitionId ? "Save / update the Part before approval" : undefined} onClick={approveInspectionPlan} disabled={!canApproveDocuments || !activeOperation.processDefinitionId || activeOperation.inspectionPlan.approvalStatus === "APPROVED"}><ClipboardCheck size={15}/>{activeOperation.inspectionPlan.approvalStatus === "APPROVED" ? "Inspection Plan Approved" : "Approve Inspection Plan"}</button>}{!readOnly && <button type="button" disabled={saving} className={`inspection-status-action ${activeOperation.inspectionPlan.planStatus.toLowerCase()}`} onClick={async () => {
          if (await onSaveInspection()) setActiveIndex(null);
        }}>{saving ? "Saving..." : "Save Inspection Plan"}</button>}
        <button type="button" className="secondary-action-button" onClick={() => setPrintTypePickerOpen(true)}><Printer size={15}/>Print</button><button type="button" className="secondary-action-button" disabled={exportingInspectionPlan || importingInspectionPlan} onClick={() => void exportInspectionPlan()}><Download size={15}/>{exportingInspectionPlan ? "Exporting..." : "Export Excel"}</button><button type="button" className="secondary-action-button" onClick={() => setActiveIndex(null)}>Close</button></footer>
      </section>
      {printTypePickerOpen && <div className="inspection-print-choice-overlay" role="dialog" aria-modal="true" aria-labelledby="inspection-print-choice-title">
        <section className="inspection-print-choice">
          <header><div><Printer size={19}/><div><h3 id="inspection-print-choice-title">Choose Inspection Plan print</h3><p>Select the inspection document to print for Operation {activeOperation.operationNumber}.</p></div></div><button type="button" aria-label="Close print choices" onClick={() => setPrintTypePickerOpen(false)}><X size={18}/></button></header>
          <div className="inspection-print-choice-options">
            {inspectionPrintTypes.map((option) => <button type="button" key={option.value} onClick={() => {
              setPrintTypePickerOpen(false);
              printInspectionPlan(option.value);
            }}><strong>{option.label}</strong><span>{option.value === "SETUP" ? "All Inspection Plan characteristics" : `${option.label} characteristics only`}</span></button>)}
          </div>
          <footer><button type="button" className="secondary-action-button" onClick={() => setPrintTypePickerOpen(false)}>Cancel</button></footer>
        </section>
      </div>}
    </div>}
  </div>;
}
