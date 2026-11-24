import DateInput from "../../components/DateInput";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import {
  ArrowLeft,
  Box,
  Boxes,
  ExternalLink,
  GitBranch,
  Network,
  Package,
  PackageSearch,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { customerApi } from "../../api/customer.api";
import { attachmentApi, type StoredAttachment } from "../../api/attachment.api";
import { itemApi } from "../../api/item.api";
import { partApi } from "../../api/part.api";
import type { BomSearchOption, ProcessMasters } from "../../api/part.api";
import {
  blankProcessDocumentApprovals,
  blankProcessPlan,
  getProcessPlanApprovalIssues,
  processPlanApprovalIssueMessage,
  type ProgramForm,
  type ProcessInstructionAttachment,
  type ProcessPlanForm,
  type ProcessPlanSaveOptions,
  type ToolListForm,
} from "./PartProcessPlanEditor";
import PartProcessPlanVariantsEditor from "./PartProcessPlanVariantsEditor";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerFormPage.css";
import "./PartFormPage.css";
type PartAttachmentType =
  | "CUSTOMER_DRAWING"
  | "CUSTOMER_STANDARD"
  | "PART_MODEL"
  | "BALLOONED_DRAWING"
  | "PATTERN_DIE_DRAWING"
  | "OTHER";

type PartAttachment = {
  attachmentId?: number;
  attachmentType: PartAttachmentType;
  attachmentName: string;
  file: File | null;
  fileName?: string;
  fileUrl?: string;
};

const toolListText = (value: unknown) => value === null || value === undefined ? "" : String(value);

function normalizeToolList(input: unknown): ToolListForm | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const fields = (row: unknown, keys: string[]) => {
    const sourceRow = row && typeof row === "object" && !Array.isArray(row)
      ? row as Record<string, unknown>
      : {};
    return Object.fromEntries(keys.map((key) => [key, toolListText(sourceRow[key])]));
  };

  return {
    documentDate: toolListText(source.documentDate),
    fixtureNumber: toolListText(source.fixtureNumber),
    material: toolListText(source.material),
    preparedBy: toolListText(source.preparedBy),
    checkedBy: toolListText(source.checkedBy),
    approvedBy: toolListText(source.approvedBy),
    lastRevisionDate: toolListText(source.lastRevisionDate),
    signature: toolListText(source.signature),
    remarks: toolListText(source.remarks),
    toolRows: Array.isArray(source.toolRows) ? source.toolRows.map((row) => fields(row, [
      "toolDiameter", "toolName", "rpm", "feed", "holderName", "holderLength", "colletSize",
      "toolInsertSpecification", "toolMake", "toolNumber", "toolClampingDetail",
      "heightOffset", "toolFluteLength", "toolOverhangDetails", "toolLife",
    ]) as ToolListForm["toolRows"][number]) : [],
    costRows: Array.isArray(source.costRows) ? source.costRows.map((row) => fields(row, [
      "toolDiameter", "toolName", "insertSpecification", "insertOrToolRate", "numberOfEdges",
      "numberOfPockets", "toolLifePerEdge", "lifeOfOverallEdge",
    ]) as ToolListForm["costRows"][number]) : [],
  };
}

function normalizeProgram(input: unknown, legacyProgramNumber: unknown): ProgramForm | null {
  const fallbackProgramNumber = toolListText(legacyProgramNumber);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallbackProgramNumber ? {
      programNumber: fallbackProgramNumber,
      programText: "",
      revisionNumber: 0,
      revisionHistory: [],
    } : null;
  }
  const source = input as Record<string, unknown>;
  const revisions = Array.isArray(source.revisionHistory) ? source.revisionHistory.map((entry) => {
    const revision = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {};
    return {
      revisionNumber: Number(revision.revisionNumber || 0),
      changedBy: toolListText(revision.changedBy),
      changedOn: toolListText(revision.changedOn),
    };
  }).filter((entry) => entry.revisionNumber > 0) : [];
  return {
    programNumber: toolListText(source.programNumber) || fallbackProgramNumber,
    programText: toolListText(source.programText),
    revisionNumber: Number(source.revisionNumber || 0),
    revisionHistory: revisions,
  };
}

function normalizeDocumentApprovals(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return {
    program: source.program === true,
    toolList: source.toolList === true,
    workInstructions: source.workInstructions === true,
  };
}

type PartFormData = {
  customerId: string;
  customerCode: string;
  customerName: string;

  partCategory: string;
  partName: string;
  partNumber: string;

  drawingNumber: string;
  drawingRevisionNumber: string;
  drawingRevisionDate: string;

  drawingCodeMode: string;
  drawingCode: string;

  materialSpecification: string;
  materialId: string;
  gradeId: string;

  partWeight: string;
  unitOfMeasurement: string;
  uomId: string;

  partStatus: string;
  revisionSourcePartId: string;
  bomReleaseStatus: string;
  projectName: string;

  createBillOfMaterial: boolean;
  createProcessFlow: boolean;
  createInspectionPlan: boolean;

  attachments: PartAttachment[];
};

type CustomerOption = {
  customerId: number;
  customerCode: string;
  customerName: string;
};

const partAttachmentTypeOptions: Array<{ value: PartAttachmentType; label: string }> = [
  { value: "CUSTOMER_DRAWING", label: "Customer Drawing" },
  { value: "CUSTOMER_STANDARD", label: "Customer Standard" },
  { value: "PART_MODEL", label: "Part Model (STEP/STP only)" },
  { value: "BALLOONED_DRAWING", label: "Ballooned Drawing" },
  { value: "PATTERN_DIE_DRAWING", label: "Pattern / Die Drawing" },
  { value: "OTHER", label: "Other" },
];

const isStepFile = (fileName: string) => /\.(step|stp)$/i.test(fileName);

type RevisionCloneForm = {
  partNumber: string;
  drawingNumber: string;
  drawingRevisionNumber: string;
  drawingRevisionDate: string;
};

type BomComponent = BomSearchOption & {
  bomComponentId?: number;
  quantity: string;
};

type BomHierarchyNode = {
  componentType: "PART" | "ITEM";
  componentId: number;
  componentCode: string;
  componentDescription: string;
  uomCode: string;
  quantity: number;
  children: BomHierarchyNode[];
};

type HierarchyMasterDetail = {
  detailType: "PART" | "ITEM";
  entityId: number;
  code: string;
  description: string;
  status: string;
  partCategory: string;
  drawingNumber: string;
  drawingRevisionNumber: string;
  materialAndGrade: string;
  unitOfMeasurement: string;
  itemGroup: string;
  itemType: string;
  inspectionRequired: string;
};

function readableCode(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function BomHierarchyBranch({
  node,
  onOpenDetail,
}: {
  node: BomHierarchyNode;
  onOpenDetail: (node: BomHierarchyNode) => void;
}) {
  const NodeIcon = node.children.length ? Boxes : node.componentType === "PART" ? Box : Package;
  return (
    <li>
      <div className="part-bom-hierarchy-node">
        <span className="part-bom-hierarchy-detail">
          <NodeIcon size={16}/>
          {node.componentId > 0 ? (
            <button
              type="button"
              className="part-bom-hierarchy-link"
              onClick={() => onOpenDetail(node)}
              aria-label={`View ${node.componentType.toLowerCase()} details for ${node.componentCode}`}
            >
              <span className="part-bom-hierarchy-link-title">
                {node.componentCode}<ExternalLink size={13}/>
              </span>
              <small>{node.componentDescription}</small>
            </button>
          ) : (
            <span><strong>{node.componentCode}</strong><small>{node.componentDescription}</small></span>
          )}
        </span>
      </div>
      {!!node.children.length && (
        <ul>{node.children.map((child) => (
          <BomHierarchyBranch
            key={`${child.componentType}-${child.componentId}`}
            node={child}
            onOpenDetail={onOpenDetail}
          />
        ))}</ul>
      )}
    </li>
  );
}

function createAttachment(): PartAttachment {
  return {
    attachmentType: "CUSTOMER_DRAWING",
    attachmentName: "",
    file: null,
  };
}

function storedAttachments(attachments: StoredAttachment[]): PartAttachment[] {
  return attachments.length
    ? attachments.map((attachment) => ({
        attachmentId: Number(attachment.attachmentId),
        attachmentType: attachment.attachmentType as PartAttachmentType,
        attachmentName: attachment.attachmentName || "",
        file: null,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
      }))
    : [createAttachment()];
}

function storedInstructionAttachments(attachments: StoredAttachment[]): ProcessInstructionAttachment[] {
  return attachments
    .filter((attachment) => attachment.attachmentType === "WORK_INSTRUCTION")
    .map((attachment) => ({
      attachmentId: Number(attachment.attachmentId),
      attachmentType: "WORK_INSTRUCTION",
      attachmentName: attachment.attachmentName || attachment.fileName,
      file: null,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
    }));
}

async function hydrateProcessInstructionAttachments(processPlans: ProcessPlanForm[]) {
  const definitionIds = [...new Set(processPlans.flatMap((plan) => plan.operations
    .map((operation) => Number(operation.processDefinitionId || 0))
    .filter(Boolean)))];
  if (!definitionIds.length) return processPlans;
  const responses = await Promise.all(definitionIds.map(async (definitionId) => ({
    definitionId,
    response: await attachmentApi.list("PART_PROCESS_DEFINITION", definitionId),
  })));
  const attachmentsByDefinition = new Map(responses.map(({ definitionId, response }) => {
    const attachments = Array.isArray(response?.data) ? response.data : [];
    return [definitionId, storedInstructionAttachments(attachments)];
  }));
  return processPlans.map((plan) => ({
    ...plan,
    operations: plan.operations.map((operation) => {
      const attachments = attachmentsByDefinition.get(Number(operation.processDefinitionId || 0));
      return {
        ...operation,
        instructionAttachments: attachments || [],
      };
    }),
  }));
}

function carryProcessInstructionAttachments(sourcePlans: ProcessPlanForm[], savedPlans: ProcessPlanForm[]) {
  return savedPlans.map((savedPlan, planIndex) => {
    const sourcePlan = sourcePlans.find((plan) => plan.processPlanId && plan.processPlanId === savedPlan.processPlanId)
      || sourcePlans[planIndex];
    return {
      ...savedPlan,
      operations: savedPlan.operations.map((savedOperation, operationIndex) => {
        const sourceOperation = sourcePlan?.operations.find((operation) => operation.processDefinitionId
          && operation.processDefinitionId === savedOperation.processDefinitionId)
          || sourcePlan?.operations[operationIndex];
        return {
          ...savedOperation,
          instructionAttachments: (sourceOperation?.instructionAttachments || []).map((attachment) => ({ ...attachment })),
        };
      }),
    };
  });
}

async function saveProcessInstructionAttachments(processPlans: ProcessPlanForm[]) {
  const uploads = new Map<string, Promise<StoredAttachment>>();
  const saveAttachment = async (operation: ProcessPlanForm["operations"][number], attachment: ProcessInstructionAttachment) => {
    if (!attachment.file) return attachment;
    const definitionId = Number(operation.processDefinitionId || 0);
    if (!definitionId) throw new Error("The process operation must be saved before its work instructions can be attached.");
    const uploadKey = [definitionId, attachment.file.name, attachment.file.size, attachment.file.lastModified, attachment.attachmentName].join(":");
    if (!uploads.has(uploadKey)) {
      uploads.set(uploadKey, attachmentApi.upload("PART_PROCESS_DEFINITION", definitionId, attachment.file, {
        attachmentType: "WORK_INSTRUCTION",
        attachmentName: attachment.attachmentName || attachment.file.name,
      }).then((response) => response.data as StoredAttachment));
    }
    const stored = await uploads.get(uploadKey)!;
    return {
      attachmentId: Number(stored.attachmentId),
      attachmentType: "WORK_INSTRUCTION" as const,
      attachmentName: stored.attachmentName || stored.fileName,
      file: null,
      fileName: stored.fileName,
      fileUrl: stored.fileUrl,
    };
  };
  return Promise.all(processPlans.map(async (plan) => ({
    ...plan,
    operations: await Promise.all(plan.operations.map(async (operation) => ({
      ...operation,
      instructionAttachments: await Promise.all(operation.instructionAttachments.map((attachment) => saveAttachment(operation, attachment))),
    }))),
  })));
}

const initialForm: PartFormData = {
  customerId: "",
  customerCode: "",
  customerName: "",

  partCategory: "",
  partName: "",
  partNumber: "",

  drawingNumber: "",
  drawingRevisionNumber: "",
  drawingRevisionDate: "",

  drawingCodeMode: "AUTO_GENERATED",
  drawingCode: "Auto Generated",

  materialSpecification: "",
  materialId: "",
  gradeId: "",

  partWeight: "",
  unitOfMeasurement: "",
  uomId: "",

  partStatus: "ACTIVE",
  revisionSourcePartId: "",
  bomReleaseStatus: "NOT_REQUIRED",
  projectName: "",

  createBillOfMaterial: false,
  createProcessFlow: false,
  createInspectionPlan: false,

  attachments: [createAttachment()],
};

const emptyProcessMasters:ProcessMasters = { operations:[],sources:[],machineTypes:[],characteristics:[],
  instruments:[],toleranceGrades:[],toleranceStandards:[],toleranceStandardBands:[],sampleSizes:[],frequencies:[] };

function mapProcessPlan(data:any):ProcessPlanForm {
  if (!data) return blankProcessPlan();
  const operations:ProcessPlanForm["operations"] = Array.isArray(data.operations) ? data.operations.map((row:any) => {
    const characteristics = Array.isArray(row.inspectionPlan?.characteristics) ? row.inspectionPlan.characteristics.map((entry:any) => ({
      inspectionCharacteristicId:Number(entry.inspectionCharacteristicId || 0) || undefined,
      balloonNumber:entry.balloonNumber ?? "",characteristicMasterId:String(entry.characteristicMasterId ?? ""),
      characteristicText:entry.characteristicText ?? "",
      characteristicSearch:entry.characteristicText || entry.characteristicName || "",
      specifiedDimension:String(entry.specifiedDimension ?? ""),toleranceMode:entry.toleranceMode ?? "MANUAL",
      toleranceGradeId:String(entry.toleranceGradeId ?? ""),toleranceGradeText:entry.toleranceGradeText ?? entry.toleranceGradeCode ?? "",
      toleranceStandardId:String(entry.toleranceStandardId ?? ""),
      toleranceMinus:String(entry.toleranceMinus ?? ""),
      tolerancePlus:String(entry.tolerancePlus ?? ""),lsl:String(entry.lsl ?? ""),usl:String(entry.usl ?? ""),
      drawingGrid:entry.drawingGrid ?? "",instrumentMasterId:String(entry.instrumentMasterId ?? ""),
      sampleSize:entry.sampleSize ?? "",inspectionFrequency:entry.inspectionFrequency ?? "",
      scCcIdentification:entry.scCcIdentification === "Y" || entry.scCcIdentification === true,
      patrolInspectionQaRequired:entry.patrolInspectionQaRequired === "Y" || entry.patrolInspectionQaRequired === true,
      periodicOperatorRequired:entry.periodicOperatorRequired === "Y" || entry.periodicOperatorRequired === true,
      finalInspectionRequired:entry.finalInspectionRequired === "Y" || entry.finalInspectionRequired === true,
    })) : [];
    const ready = characteristics.length > 0;
    const sourceType = row.sourceType === "OUTSOURCE" ? "OUTSOURCE" as const:"INHOUSE" as const;
    return {
      processOperationId:Number(row.processOperationId || 0) || undefined,
      processDefinitionId:Number(row.processDefinitionId || 0) || undefined,
      processDefinitionCode:row.processDefinitionCode ?? undefined,
      sharedVariantCount:Number(row.sharedVariantCount || 1),
      operationNumber:String(row.operationNumber ?? ""),operationMasterId:String(row.operationMasterId ?? ""),
      operationDescription:row.operationDescription ?? "",sourceType,
      machineTypeId:sourceType === "INHOUSE" ? String(row.machineTypeId ?? ""):"",
      cycleTimeSeconds:sourceType === "INHOUSE" ? String(row.cycleTimeSeconds ?? ""):"",
      clampingTimeSeconds:sourceType === "INHOUSE" ? String(row.clampingTimeSeconds ?? ""):"",
      settingTimeHours:sourceType === "INHOUSE" ? String(row.settingTimeHours ?? ""):"",
      outsourceCostInr:sourceType === "OUTSOURCE" ? String(row.outsourceCostInr ?? row.processCostInr ?? ""):"",
      processCostInr:String(row.processCostInr ?? "0"),
      toolList:normalizeToolList(row.toolList),program:normalizeProgram(row.program, row.programNumber),programNumber:row.program?.programNumber ?? row.programNumber ?? "",documentApprovals:row.documentApprovals ? normalizeDocumentApprovals(row.documentApprovals) : blankProcessDocumentApprovals(),instructionAttachments:[],inspectionPlan:row.inspectionPlan ? {
        inspectionPlanId:Number(row.inspectionPlan.inspectionPlanId || 0) || undefined,
        planStatus:ready ? "READY":"DRAFT",
        approvalStatus:row.inspectionPlan.approvalStatus === "APPROVED" ? "APPROVED" : "DRAFT",
        cmmRequired:row.inspectionPlan.cmmRequired === "Y" || row.inspectionPlan.cmmRequired === true,
        measurementUnit:row.inspectionPlan.measurementUnit === "INCH" ? "INCH" : "MM",
        toleranceStandardId:String(row.inspectionPlan.toleranceStandardId ?? ""),
        characteristics,
      }:null,
    };
  }) : [];
  return { processPlanId:Number(data.processPlanId || 0) || undefined,
    planCode:data.planCode ?? "",routeName:data.routeName ?? "Default Route",
    drawingRevisionNumber:data.drawingRevisionNumber ?? "",
    productionCapacityPerDay:String(data.productionCapacityPerDay ?? ""),
    planStatus:data.planStatus === "APPROVED" && operations.every((row) => row.inspectionPlan?.planStatus === "READY") ? "APPROVED":"DRAFT",
    isDefault:data.isDefault === "Y" || data.isDefault === true,
    activeFlag:data.activeFlag === "N" ? "N":"Y",
    operations };
}

function mapProcessPlans(data:any):ProcessPlanForm[] {
  if (Array.isArray(data?.processPlans) && data.processPlans.length) return data.processPlans.map(mapProcessPlan);
  return data?.processPlan ? [mapProcessPlan(data.processPlan)] : [];
}

export default function PartFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmAction, confirmDelete, showError, showSuccess } = useAppFeedback();
  const { id } = useParams();
  const partId = Number(id || 0);

  const isEditMode = partId > 0;
  const isViewMode = isEditMode && searchParams.get("mode") === "view";

  const [form, setForm] =
    useState<PartFormData>(initialForm);

  const [saving, setSaving] = useState<
    "DRAFT" | "SUBMIT" | null
  >(null);
  const [revisionClone, setRevisionClone] = useState<RevisionCloneForm | null>(null);
  const [revisionCloning, setRevisionCloning] = useState(false);
  const [bomReleasing, setBomReleasing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
  const customerOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bomComponents, setBomComponents] = useState<BomComponent[]>([]);
  const [processPlans,setProcessPlans] = useState<ProcessPlanForm[]>([]);
  const [processMasters,setProcessMasters] = useState<ProcessMasters>(emptyProcessMasters);
  const [bomSearch, setBomSearch] = useState("");
  const [bomOptions, setBomOptions] = useState<BomSearchOption[]>([]);
  const [selectedBomOption, setSelectedBomOption] = useState<BomSearchOption | null>(null);
  const [bomSearchOpen, setBomSearchOpen] = useState(false);
  const [bomSearchLoading, setBomSearchLoading] = useState(false);
  const [bomHierarchyOpen, setBomHierarchyOpen] = useState(false);
  const [bomHierarchyLoading, setBomHierarchyLoading] = useState(false);
  const [bomHierarchy, setBomHierarchy] = useState<BomHierarchyNode | null>(null);
  const [hierarchyDetail, setHierarchyDetail] = useState<HierarchyMasterDetail | null>(null);
  const [hierarchyDetailLoading, setHierarchyDetailLoading] = useState(false);
  const [hierarchyDetailError, setHierarchyDetailError] = useState("");
  const hierarchyDetailRequestId = useRef(0);
  const referenceData = useReferenceData([
    "RECORD_STATUS", "PART_CATEGORY", "DRAWING_CODE_MODE",
  ]);
  const unsaved = useUnsavedChanges({form,bomComponents,processPlans});
  const defaultActiveProcessPlan = processPlans.find((plan) =>
    plan.activeFlag === "Y" && plan.isDefault
  );
  const defaultProcessPlanReleased =
    defaultActiveProcessPlan?.planStatus === "APPROVED";
  const defaultProcessPlanApprovalIssues = getProcessPlanApprovalIssues(defaultActiveProcessPlan?.operations || []);
  const defaultProcessPlanReadyForRelease = defaultProcessPlanApprovalIssues.length === 0;

  useEffect(() => {
    let mounted = true;

    partApi.getProcessMasters().then((response) => {
      if (mounted) setProcessMasters(response?.data ?? emptyProcessMasters);
    }).catch((loadError) => { if (mounted) setError(apiMessage(loadError)); });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!partId) {
      setForm(initialForm);
      setCustomerSearch("");
      setActiveCustomerIndex(-1);
      setBomComponents([]);
      setProcessPlans([]);
      return;
    }

    let mounted = true;

    Promise.all([
      partApi.getById(partId),
      attachmentApi.list("PART", partId),
    ])
      .then(async ([response, attachmentResponse]) => {
        if (!mounted) return;
        const data = response?.data ?? {};
        const date = data.drawing_revision_date ?? data.drawingRevisionDate;

        const loadedBomComponents: BomComponent[] = Array.isArray(data.bomComponents)
          ? data.bomComponents.map((row: any) => ({
              bomComponentId: Number(row.bomComponentId),
              componentType: row.componentType,
              componentId: Number(row.componentId),
              componentCode: row.componentCode ?? "",
              componentDescription: row.componentDescription ?? "",
              uomId: row.uomId ? Number(row.uomId) : null,
              uomCode: row.uomCode ?? "-",
              quantity: String(row.quantity ?? ""),
            }))
          : [];
        setBomComponents(loadedBomComponents);
        const loadedProcessPlans = await hydrateProcessInstructionAttachments(mapProcessPlans(data));
        if (!mounted) return;
        setProcessPlans(loadedProcessPlans);
        setForm({
          customerId: String(data.customer_id ?? data.customerId ?? ""),
          customerCode: data.customer_code ?? data.customerCode ?? "",
          customerName: data.customer_name ?? data.customerName ?? "",
          partCategory: data.part_category ?? data.partCategory ?? "",
          partName: data.part_name ?? data.partName ?? "",
          partNumber: data.part_number ?? data.partNumber ?? "",
          drawingNumber: data.drawing_number ?? data.drawingNumber ?? "",
          drawingRevisionNumber:
            data.drawing_revision_number ?? data.drawingRevisionNumber ?? "",
          drawingRevisionDate: date ? String(date).slice(0, 10) : "",
          drawingCodeMode:
            data.drawing_code_mode ?? data.drawingCodeMode ?? "AUTO_GENERATED",
          drawingCode: data.drawing_code ?? data.drawingCode ?? "",
          materialSpecification:
            data.material_specification ?? data.materialSpecification ?? "",
          materialId: String(data.material_id ?? data.materialId ?? ""),
          gradeId: String(data.material_grade_id ?? data.materialGradeId ?? ""),
          partWeight: String(data.part_weight ?? data.partWeight ?? ""),
          unitOfMeasurement:
            data.unit_of_measurement ?? data.unitOfMeasurement ?? "KG",
          uomId: String(data.uom_id ?? data.uomId ?? ""),
          partStatus: data.part_status ?? data.partStatus ?? "ACTIVE",
          revisionSourcePartId: String(data.revision_source_part_id ?? data.revisionSourcePartId ?? ""),
          bomReleaseStatus: data.bom_release_status ?? data.bomReleaseStatus ?? "NOT_REQUIRED",
          projectName: data.project_name ?? data.projectName ?? "",
          createBillOfMaterial:
            String(data.bom_required ?? data.bomRequired ?? "").toUpperCase() === "Y"
            || loadedBomComponents.length > 0,
          createProcessFlow: loadedProcessPlans.length > 0,
          createInspectionPlan: loadedProcessPlans.some((plan) => plan.operations.some((row) => Boolean(row.inspectionPlan))),
          attachments: storedAttachments(Array.isArray(attachmentResponse?.data) ? attachmentResponse.data : []),
        });
        setCustomerSearch([data.customer_code ?? data.customerCode, data.customer_name ?? data.customerName].filter(Boolean).join(" - "));
      })
      .catch((loadError) => {
        if (mounted) setError(apiMessage(loadError));
      });

    return () => {
      mounted = false;
    };
  }, [partId]);

  useEffect(() => {
    const search = customerSearch.trim();
    const selectedLabel = [form.customerCode, form.customerName].filter(Boolean).join(" - ");
    if (isViewMode || search.length < 2 || (form.customerId && search === selectedLabel)) {
      setCustomerOptions([]);
      setActiveCustomerIndex(-1);
      setCustomerSearchLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setCustomerSearchLoading(true);
      customerApi.lookup(search)
        .then((response) => {
          if (active) {
            setCustomerOptions(Array.isArray(response?.data) ? response.data : []);
            setActiveCustomerIndex(-1);
          }
        })
        .catch((loadError) => {
          if (active) setError(apiMessage(loadError));
        })
        .finally(() => {
          if (active) setCustomerSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerSearch, form.customerCode, form.customerId, form.customerName, isViewMode]);

  useEffect(() => {
    if (activeCustomerIndex >= customerOptions.length) setActiveCustomerIndex(-1);
  }, [activeCustomerIndex, customerOptions.length]);

  useEffect(() => {
    if (activeCustomerIndex >= 0) {
      customerOptionRefs.current[activeCustomerIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeCustomerIndex, customerOptions]);

  useEffect(() => {
    const hasInspection=processPlans.some((plan) => plan.operations.some((row) => Boolean(row.inspectionPlan)));
    setForm((current) => current.createInspectionPlan === hasInspection ? current
      : {...current,createInspectionPlan:hasInspection});
  },[processPlans]);

  useEffect(() => {
    const search = bomSearch.trim();
    if (isViewMode || !form.createBillOfMaterial || !bomSearchOpen || search.length < 2) {
      if (search.length < 2) setBomOptions([]);
      setBomSearchLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setBomSearchLoading(true);
      partApi.searchBomOptions({ search, excludePartId: partId || undefined })
        .then((response) => setBomOptions(Array.isArray(response?.data) ? response.data : []))
        .catch((loadError) => setError(apiMessage(loadError)))
        .finally(() => setBomSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [bomSearch, bomSearchOpen, form.createBillOfMaterial, isViewMode, partId]);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const target = event.target;
    const { name } = target;

    const value =
      target instanceof HTMLInputElement &&
      target.type === "checkbox"
        ? target.checked
        : target.value;

    setForm((current) => name === "partCategory" && value === "ASSEMBLY"
      ? {
          ...current,
          partCategory: value,
          materialSpecification: "",
          materialId: "",
          gradeId: "",
        }
      : {
          ...current,
          [name]: value,
        });

    setError("");
    setMessage("");
  };

  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value);
    setCustomerSearchOpen(value.trim().length >= 2);
    setActiveCustomerIndex(-1);
    setForm((current) => current.customerId
      ? { ...current, customerId: "", customerCode: "", customerName: "" }
      : current);
    setError("");
  };

  const selectCustomer = (customer: CustomerOption) => {
    setForm((current) => ({
      ...current,
      customerId: String(customer.customerId),
      customerCode: customer.customerCode,
      customerName: customer.customerName,
    }));
    setCustomerSearch(`${customer.customerCode} - ${customer.customerName}`);
    setCustomerOptions([]);
    setCustomerSearchOpen(false);
    setActiveCustomerIndex(-1);
  };

  const handleCustomerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isViewMode) return;

    if (event.key === "Escape") {
      setCustomerSearchOpen(false);
      setActiveCustomerIndex(-1);
      return;
    }

    if (event.key === "Enter" && activeCustomerIndex >= 0 && customerOptions[activeCustomerIndex]) {
      event.preventDefault();
      selectCustomer(customerOptions[activeCustomerIndex]);
      return;
    }

    if (!customerSearch.trim() || customerSearch.trim().length < 2 || !["ArrowDown", "ArrowUp"].includes(event.key)) return;

    event.preventDefault();
    setCustomerSearchOpen(true);
    if (!customerOptions.length) return;

    setActiveCustomerIndex((current) => {
      if (current < 0) return event.key === "ArrowDown" ? 0 : customerOptions.length - 1;
      return event.key === "ArrowDown"
        ? (current + 1) % customerOptions.length
        : (current - 1 + customerOptions.length) % customerOptions.length;
    });
  };

  const handleDrawingModeChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const drawingCodeMode = event.target.value;

    setForm((current) => ({
      ...current,
      drawingCodeMode,
      drawingCode:
        drawingCodeMode === "AUTO_GENERATED"
          ? "Auto Generated"
          : "",
    }));
  };

  const addAttachment = () => {
    setForm((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        createAttachment(),
      ],
    }));
  };

  const updateAttachment = (
    index: number,
    field:
      | "attachmentType"
      | "attachmentName"
      | "file",
    value: string | File | null
  ) => {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.map(
        (attachment, attachmentIndex) =>
          attachmentIndex === index
            ? {
                ...attachment,
                [field]: value,
              }
            : attachment
      ),
    }));
  };

  const updateAttachmentType = (index: number, attachmentType: PartAttachmentType) => {
    const attachment = form.attachments[index];
    const fileName = attachment?.file?.name || attachment?.fileName || "";
    if (attachmentType === "PART_MODEL" && fileName && !isStepFile(fileName)) {
      setError("Part Model accepts only STEP or STP files. Select a STEP/STP file before changing the document type.");
      return;
    }
    updateAttachment(index, "attachmentType", attachmentType);
  };

  const selectAttachmentFile = (index: number, file: File | null) => {
    const attachment = form.attachments[index];
    if (file && attachment?.attachmentType === "PART_MODEL" && !isStepFile(file.name)) {
      setError("Part Model accepts only STEP or STP files.");
      return;
    }
    updateAttachment(index, "file", file);
  };

  const removeAttachment = async (index: number) => {
    if (form.attachments.length === 1) return;

    const confirmed = await confirmDelete({
      title: "Delete attachment?",
      message:
        "This attachment row and its selected file will be removed from the form.",
      confirmLabel: "Delete attachment",
    });
    if (!confirmed) return;

    const attachment = form.attachments[index];
    if (attachment?.attachmentId) {
      try {
        await attachmentApi.remove("PART", partId, attachment.attachmentId);
      } catch (removeError) {
        setError(apiMessage(removeError));
        return;
      }
    }

    setForm((current) => ({
      ...current,
      attachments:
        current.attachments.length === 1
          ? current.attachments
          : current.attachments.filter(
              (_, attachmentIndex) =>
                attachmentIndex !== index
            ),
    }));
  };

  const selectBomOption = (option: BomSearchOption) => {
    setSelectedBomOption(option);
    setBomSearch(`${option.componentCode} - ${option.componentDescription}`);
    setBomSearchOpen(false);
  };

  const attachBomOption = () => {
    if (!selectedBomOption) return;
    const duplicate = bomComponents.some((row) =>
      row.componentType === selectedBomOption.componentType &&
      row.componentId === selectedBomOption.componentId
    );
    if (duplicate) {
      setError("This Part or Item is already attached to the Bill of Material.");
      return;
    }
    setBomComponents((rows) => [...rows, { ...selectedBomOption, quantity: "1" }]);
    setSelectedBomOption(null);
    setBomSearch("");
    setBomOptions([]);
    setError("");
  };

  const updateBomQuantity = (index: number, quantity: string) => {
    setBomComponents((rows) => rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, quantity } : row
    ));
  };

  const removeBomComponent = async (index: number) => {
    const component = bomComponents[index];
    const confirmed = await confirmDelete({
      title: "Delete BOM attachment?",
      message: `${component.componentCode} - ${component.componentDescription} will be removed from this Bill of Material.`,
      confirmLabel: "Delete attachment",
    });
    if (confirmed) setBomComponents((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  };

  const buildHierarchyPreview = (savedHierarchy: BomHierarchyNode | null = null): BomHierarchyNode => {
    const savedChildren = new Map(
      (savedHierarchy?.children ?? []).map((child) => [
        `${child.componentType}-${child.componentId}`, child,
      ])
    );
    return {
      componentType: "PART",
      componentId: partId || 0,
      componentCode: form.partNumber || "Unsaved Part",
      componentDescription: form.partName || "New Part",
      uomCode: form.unitOfMeasurement || "",
      quantity: 1,
      children: bomComponents.map((component) => ({
        componentType: component.componentType,
        componentId: component.componentId,
        componentCode: component.componentCode,
        componentDescription: component.componentDescription,
        uomCode: component.uomCode,
        quantity: Number(component.quantity) || 0,
        children: savedChildren.get(
          `${component.componentType}-${component.componentId}`
        )?.children ?? [],
      })),
    };
  };

  const openBomHierarchy = async () => {
    setHierarchyDetail(null);
    setHierarchyDetailError("");
    setBomHierarchyOpen(true);
    setBomHierarchyLoading(true);
    try {
      let savedHierarchy: BomHierarchyNode | null = null;
      if (partId) {
        const response = await partApi.getBomHierarchy(partId);
        savedHierarchy = response?.data ?? null;
      }
      setBomHierarchy(buildHierarchyPreview(savedHierarchy));
    } catch (loadError) {
      setBomHierarchy(buildHierarchyPreview());
      setError(apiMessage(loadError));
    } finally {
      setBomHierarchyLoading(false);
    }
  };

  const openHierarchyDetail = async (node: BomHierarchyNode) => {
    const requestId = ++hierarchyDetailRequestId.current;

    setHierarchyDetail({
      detailType: node.componentType,
      entityId: node.componentId,
      code: node.componentCode,
      description: node.componentDescription,
      status: "",
      partCategory: "",
      drawingNumber: "",
      drawingRevisionNumber: "",
      materialAndGrade: "",
      unitOfMeasurement: "",
      itemGroup: "",
      itemType: "",
      inspectionRequired: "",
    });
    setHierarchyDetailError("");
    setHierarchyDetailLoading(true);

    try {
      const response = node.componentType === "PART"
        ? await partApi.getById(node.componentId)
        : await itemApi.getById(node.componentId);
      if (requestId !== hierarchyDetailRequestId.current) return;
      const data = response?.data ?? {};
      if (node.componentType === "PART") {
        const materialId = Number(data.material_id ?? data.materialId ?? 0);
        const gradeId = Number(data.material_grade_id ?? data.materialGradeId ?? 0);
        const uomId = Number(data.uom_id ?? data.uomId ?? 0);
        const material = referenceData.materials.find((row) => row.materialId === materialId);
        const grade = referenceData.grades.find((row) => row.materialGradeId === gradeId);
        const uom = referenceData.uoms.find((row) => row.uomId === uomId);

        setHierarchyDetail({
          detailType: "PART",
          entityId: Number(data.part_id ?? data.partId ?? node.componentId),
          code: data.part_number ?? data.partNumber ?? node.componentCode,
          description: data.part_name ?? data.partName ?? node.componentDescription,
          status: data.part_status ?? data.partStatus ?? "",
          partCategory: data.part_category ?? data.partCategory ?? "",
          drawingNumber: data.drawing_number ?? data.drawingNumber ?? "",
          drawingRevisionNumber:
            data.drawing_revision_number ?? data.drawingRevisionNumber ?? "",
          materialAndGrade: [material?.materialName, grade?.gradeCode || grade?.gradeName]
            .filter(Boolean)
            .join(" - "),
          unitOfMeasurement:
            uom?.uomCode ?? data.unit_of_measurement ?? data.unitOfMeasurement ?? "",
          itemGroup: "",
          itemType: "",
          inspectionRequired: "",
        });
      } else {
        setHierarchyDetail({
          detailType: "ITEM",
          entityId: Number(data.item_id ?? data.itemId ?? node.componentId),
          code: data.item_code ?? data.itemCode ?? node.componentCode,
          description:
            data.item_description ?? data.itemDescription ?? node.componentDescription,
          status: data.item_status ?? data.itemStatus ?? "",
          partCategory: "",
          drawingNumber: "",
          drawingRevisionNumber: "",
          materialAndGrade:
            data.material_grade_name ?? data.materialGradeName ??
            data.material_name ?? data.materialName ?? "",
          unitOfMeasurement: data.uom_code ?? data.uomCode ?? "",
          itemGroup: [data.group_code ?? data.groupCode, data.group_name ?? data.groupName]
            .filter(Boolean)
            .join(" - "),
          itemType: data.type_name ?? data.typeName ?? "",
          inspectionRequired:
            (data.inspection_required ?? data.inspectionRequired) === "Y" ? "Yes" : "No",
        });
      }
    } catch (loadError) {
      if (requestId === hierarchyDetailRequestId.current) {
        setHierarchyDetailError(apiMessage(loadError));
      }
    } finally {
      if (requestId === hierarchyDetailRequestId.current) {
        setHierarchyDetailLoading(false);
      }
    }
  };

  const closeHierarchyDetail = () => {
    hierarchyDetailRequestId.current += 1;
    setHierarchyDetail(null);
    setHierarchyDetailLoading(false);
    setHierarchyDetailError("");
  };

  const closeBomHierarchy = () => {
    closeHierarchyDetail();
    setBomHierarchyOpen(false);
  };

  const openFullDetail = (detail: HierarchyMasterDetail) => {
    const path = detail.detailType === "PART" ? "parts" : "items";
    window.open(
      `${window.location.origin}/masters/${path}/${detail.entityId}?mode=view`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const validate = (
    action: "DRAFT" | "SUBMIT"
  ) => {
    if (action === "DRAFT") return true;

    if (!form.partName.trim()) {
      setError("Part name is required.");
      return false;
    }

    if (!form.customerId) {
      setError("Customer is required.");
      return false;
    }

    if (!form.partCategory) {
      setError("Part category is required.");
      return false;
    }

    if (!form.partNumber.trim()) {
      setError("Part number is required.");
      return false;
    }

    if (
      form.drawingCodeMode === "MANUAL" &&
      !form.drawingCode.trim()
    ) {
      setError("Drawing code is required.");
      return false;
    }

    if (form.createBillOfMaterial && bomComponents.some((row) =>
      !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0
    )) {
      setError("Every Bill of Material quantity must be greater than zero.");
      return false;
    }

    return true;
  };

  const openRevisionClone = () => {
    setRevisionClone({
      partNumber: `${form.partNumber}-REV`,
      drawingNumber: form.drawingNumber,
      drawingRevisionNumber: form.drawingRevisionNumber,
      drawingRevisionDate: form.drawingRevisionDate,
    });
    setError("");
  };

  const createRevisionClone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!revisionClone || !partId) return;
    if (!revisionClone.partNumber.trim()) {
      setError("New Part Number is required for a drawing revision.");
      return;
    }
    if (!revisionClone.drawingRevisionNumber.trim()) {
      setError("New Drawing Revision Number is required.");
      return;
    }
    const drawingCode = form.drawingCode.trim()
      || revisionClone.drawingNumber.trim()
      || form.partNumber.trim();
    if (!await confirmAction({
      title: "Create drawing revision?",
      message: `Create revision ${revisionClone.drawingRevisionNumber.trim()} for drawing code ${drawingCode}? The current Part will become inactive after the revision is created.`,
      confirmLabel: "Create Revision",
      cancelLabel: "Cancel",
    })) return;
    try {
      setRevisionCloning(true);
      setError("");
      const response = await partApi.cloneForRevision(partId, {
        partNumber: revisionClone.partNumber.trim(),
        drawingNumber: revisionClone.drawingNumber.trim() || null,
        drawingRevisionNumber: revisionClone.drawingRevisionNumber.trim(),
        drawingRevisionDate: revisionClone.drawingRevisionDate || null,
      });
      const newPartId = Number(response?.data?.part_id ?? response?.data?.partId ?? 0);
      if (!newPartId) throw new Error("Drawing revision was created but its Part ID was not returned.");
      setRevisionClone(null);
      showSuccess("Drawing revision created. The original Part is now inactive.");
      navigate(`/masters/parts/${newPartId}?mode=edit`, { replace: true });
    } catch (cloneError) {
      setError(apiMessage(cloneError));
    } finally {
      setRevisionCloning(false);
    }
  };

  const releaseRevisionBom = async () => {
    if (!partId) return;
    try {
      setBomReleasing(true);
      setError("");
      const response = await partApi.releaseRevisionBom(partId);
      const data = response?.data ?? {};
      setForm((current) => ({
        ...current,
        partStatus: data.part_status ?? data.partStatus ?? current.partStatus,
        bomReleaseStatus: data.bom_release_status ?? data.bomReleaseStatus ?? "RELEASED",
      }));
      showSuccess(response?.message ?? "Bill of Material approved and released.");
    } catch (releaseError) {
      setError(apiMessage(releaseError));
    } finally {
      setBomReleasing(false);
    }
  };

  const releaseDefaultProcessPlan = async () => {
    const planIndex = processPlans.findIndex((plan) =>
      plan.activeFlag === "Y" && plan.isDefault
    );
    if (planIndex < 0) {
      setError("Add an active default Process Plan before releasing it.");
      return;
    }
    if (!defaultProcessPlanReadyForRelease) {
      showError(processPlanApprovalIssueMessage(defaultProcessPlanApprovalIssues));
      return;
    }
    if (!await confirmAction({
      title: "Approve & Release Process Plan?",
      message: "Every operation has an approved Program, Tool List, Work Instructions and Inspection Plan. Click Update to save the release.",
      confirmLabel: "Approve & Release",
    })) return;

    setProcessPlans((current) => current.map((plan, index) =>
      index === planIndex ? { ...plan, planStatus: "APPROVED" } : plan
    ));
    showSuccess("Process Plan approved. Click Update to save the release.");
  };

  const savePart = async (
    action: "DRAFT" | "SUBMIT",
    processPlansOverride?: ProcessPlanForm[],
    saveOptions: ProcessPlanSaveOptions = {}
  ) => {
    if (isViewMode) return false;

    const documentOnly = Boolean(saveOptions.documentOnly);
    if (documentOnly && !isEditMode) {
      setError("Save the Part before updating its Program, Tool List or Work Instructions.");
      return false;
    }

    if (!validate(action)) {
      return false;
    }

    try {
      setSaving(action);
      setError("");
      setMessage("");
      const plansToSave = processPlansOverride ?? processPlans;
      const skipPartAttachments = Boolean(saveOptions.skipAttachments || saveOptions.skipPartAttachments);
      const skipWorkInstructionAttachments = Boolean(saveOptions.skipAttachments || saveOptions.skipWorkInstructionAttachments);

      const payload = {
        action,
        documentOnly,
        customerId: Number(form.customerId),
        partCategory: form.partCategory,
        partName: form.partName.trim(),
        partNumber: form.partNumber.trim(),
        drawingNumber: form.drawingNumber.trim() || null,
        drawingRevisionNumber: form.drawingRevisionNumber.trim() || null,
        drawingRevisionDate: form.drawingRevisionDate || null,
        drawingCodeMode: form.drawingCodeMode,
        drawingCode:
          form.drawingCodeMode === "AUTO_GENERATED"
            ? null
            : form.drawingCode.trim() || null,
        materialSpecification:
          form.partCategory === "ASSEMBLY"
            ? null
            : form.materialSpecification.trim() || null,
        materialId: form.partCategory === "ASSEMBLY" || !form.materialId
          ? null
          : Number(form.materialId),
        materialGradeId: form.partCategory === "ASSEMBLY" || !form.gradeId
          ? null
          : Number(form.gradeId),
        partWeight: form.partWeight ? Number(form.partWeight) : null,
        unitOfMeasurement: form.unitOfMeasurement || null,
        uomId: form.uomId ? Number(form.uomId) : null,
        projectName: form.projectName.trim() || null,
        bomRequired: form.createBillOfMaterial,
        bomComponents: form.createBillOfMaterial
          ? bomComponents.map((row) => ({
              componentType: row.componentType,
              componentId: row.componentId,
              quantity: Number(row.quantity),
            }))
          : [],
        processPlans: form.createProcessFlow ? plansToSave.map((processPlan) => ({
          ...processPlan,drawingRevisionNumber:form.drawingRevisionNumber || null,
          productionCapacityPerDay:processPlan.productionCapacityPerDay || null,
          operations:processPlan.operations.map(({ instructionAttachments: _instructionAttachments, ...row }) => ({...row,
            workInstructionCount: _instructionAttachments.length,
            operationNumber:Number(row.operationNumber),operationMasterId:Number(row.operationMasterId),
            machineTypeId:row.machineTypeId ? Number(row.machineTypeId):null,
            cycleTimeSeconds:row.cycleTimeSeconds || null,clampingTimeSeconds:row.clampingTimeSeconds || null,
            settingTimeHours:row.settingTimeHours || null,
            outsourceCostInr:row.outsourceCostInr || null,
            inspectionPlan:row.inspectionPlan ? {...row.inspectionPlan,
              toleranceStandardId:row.inspectionPlan.toleranceStandardId ? Number(row.inspectionPlan.toleranceStandardId):null,
              characteristics:row.inspectionPlan.characteristics.map((entry) => ({...entry,
                characteristicMasterId:entry.characteristicMasterId ? Number(entry.characteristicMasterId):null,
                characteristicText:entry.characteristicMasterId ? null:entry.characteristicText.trim() || null,
                toleranceGradeId:entry.toleranceGradeId ? Number(entry.toleranceGradeId):null,
                toleranceStandardId:entry.toleranceStandardId ? Number(entry.toleranceStandardId):null,
                instrumentMasterId:entry.instrumentMasterId ? Number(entry.instrumentMasterId):null,
              }))}:null,
          })),
        })) : [],
      };

      const response = isEditMode
        ? await partApi.update(partId, payload)
        : await partApi.create(payload);
      const responseProcessPlans = response?.data ? mapProcessPlans(response.data) : plansToSave;
      const savedProcessPlans = carryProcessInstructionAttachments(plansToSave, responseProcessPlans);
      const savedId = Number(
        response?.data?.part_id ?? response?.data?.partId ?? partId
      );

      if (!savedId) throw new Error("Part was saved but its identifier was not returned.");

      const savedStatus = response?.data?.part_status ?? response?.data?.partStatus ?? form.partStatus;
      if (savedId && isEditMode && ["ACTIVE", "INACTIVE"].includes(form.partStatus) && savedStatus !== form.partStatus) {
        await partApi.changeStatus(
          savedId,
          form.partStatus as "ACTIVE" | "INACTIVE"
        );
      }

      const savedAttachments = skipPartAttachments ? [] : await Promise.all(form.attachments.map(async (attachment) => {
        if (attachment.attachmentId && attachment.file) {
          const uploaded = await attachmentApi.upload("PART", savedId, attachment.file, attachment);
          await attachmentApi.remove("PART", savedId, attachment.attachmentId);
          return uploaded.data as StoredAttachment;
        }
        if (attachment.attachmentId) {
          const updated = await attachmentApi.update("PART", savedId, attachment.attachmentId, attachment);
          return updated.data as StoredAttachment;
        }
        if (attachment.file) {
          const uploaded = await attachmentApi.upload("PART", savedId, attachment.file, attachment);
          return uploaded.data as StoredAttachment;
        }
        return null;
      }));
      const nextAttachments = skipPartAttachments
        ? form.attachments
        : storedAttachments(savedAttachments.filter((attachment): attachment is StoredAttachment => Boolean(attachment)));
      const persistedProcessPlans = skipWorkInstructionAttachments
        ? savedProcessPlans
        : await saveProcessInstructionAttachments(savedProcessPlans);
      setProcessPlans(persistedProcessPlans);
      const nextForm = {
        ...form,
        attachments: nextAttachments,
        partStatus: savedStatus,
        bomReleaseStatus: response?.data?.bom_release_status ?? response?.data?.bomReleaseStatus ?? form.bomReleaseStatus,
      };
      setForm((current) => ({ ...current, ...nextForm }));

      unsaved.markSavedValue({ form: nextForm, bomComponents, processPlans: persistedProcessPlans });
      // React state has not re-rendered yet when a newly created Part redirects
      // to its edit URL. Reset the current guard snapshot too, so that redirect
      // is recognised as a completed save instead of an attempt to discard work.
      unsaved.markSaved();
      setMessage(response?.message ?? "Part saved successfully.");

      if (action === "SUBMIT") {
        window.setTimeout(() => {
          navigate("/masters/parts");
        }, 700);
      } else if (!isEditMode && savedId) {
        navigate(`/masters/parts/${savedId}`, { replace: true });
      }
      return true;
    } catch (saveError) {
      setError(apiMessage(saveError));
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    void savePart("SUBMIT");
  };

  return (
    <div className="page-container master-form-page customer-form-compact">
      <section className="master-form-page-header">
        <div className="master-form-title-group">
          <PackageSearch size={22} />
          <h1>
            {isViewMode
              ? "View Part"
              : isEditMode
              ? "Edit Part"
              : "Create Part"}
          </h1>
        </div>

        <div className="master-form-actions">
          {isEditMode && form.partStatus === "ACTIVE" && (
            <button
              type="button"
              className="secondary-action-button"
              onClick={openRevisionClone}
            >
              <GitBranch size={16} />
              New Drawing Revision
            </button>
          )}
          {!!bomComponents.length && (
            <button
              type="button"
              className="part-bom-hierarchy-trigger"
              onClick={() => void openBomHierarchy()}
              aria-label="View Part Hierarchy"
              title="View Part Hierarchy"
            >
              <Network size={18}/>
            </button>
          )}
          <button
            type="button"
            className="customer-cancel-link"
            onClick={() =>
              navigate("/masters/parts")
            }
          >
            <ArrowLeft size={15} />
            {isViewMode ? "Back" : "Cancel"}
          </button>

          {!isViewMode && <button
            type="button"
            className="secondary-action-button draft"
            disabled={saving !== null}
            onClick={() =>
              void savePart("DRAFT")
            }
          >
            <Save size={17} />

            {saving === "DRAFT"
              ? "Saving..."
              : "Save Draft"}
          </button>}

          {!isViewMode && <button
            type="submit"
            form="part-master-form"
            className="primary-action-button"
            disabled={saving !== null}
          >
            <Send size={17} />

            {saving === "SUBMIT"
              ? "Saving..."
              : isEditMode
                ? "Update"
                : "Submit"}
          </button>}
        </div>
      </section>

      {error && (
        <Alert type="error" message={error} />
      )}

      {message && (
        <Alert type="success" message={message} />
      )}

      {form.partStatus === "DRAWING_UNDER_REVISION" && (
        <div className="part-revision-warning" role="alert">
          <GitBranch size={18} />
          <div>
            <strong>Drawing under revision - contact QA department.</strong>
            <span>This Part cannot be used in transactions until its BOM and default Process Plan are released.</span>
          </div>
        </div>
      )}

      <form
        id="part-master-form"
        className={`master-entry-form${isViewMode ? " part-master-view-mode" : ""}`}
        onSubmit={handleSubmit}
      >
        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Customer and Part Information</h2>

              <p>
                Select customer and enter part
                identification details.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field span-2 part-customer-picker">
              <span>
                Customer
                <b>*</b>
              </span>

              <input
                value={customerSearch}
                onChange={(event) => handleCustomerSearch(event.target.value)}
                onFocus={() => {
                  setCustomerSearchOpen(customerSearch.trim().length >= 2);
                  setActiveCustomerIndex(-1);
                }}
                onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 120)}
                onKeyDown={handleCustomerKeyDown}
                readOnly={isViewMode}
                placeholder="Type at least 2 letters to search customers"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={customerSearchOpen}
                aria-controls="part-customer-options"
                aria-activedescendant={activeCustomerIndex >= 0 ? `part-customer-option-${customerOptions[activeCustomerIndex]?.customerId}` : undefined}
              />

              {customerSearchOpen && customerSearch.trim().length >= 2 && (
                <div id="part-customer-options" className="part-customer-options" role="listbox">
                  {customerSearchLoading ? <p>Searching customers…</p>
                    : customerOptions.length ? customerOptions.map((customer, index) => (
                      <button
                        key={customer.customerId}
                        id={`part-customer-option-${customer.customerId}`}
                        ref={(element) => { customerOptionRefs.current[index] = element; }}
                        type="button"
                        role="option"
                        className={index === activeCustomerIndex ? "is-active" : undefined}
                        aria-selected={index === activeCustomerIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => setActiveCustomerIndex(index)}
                        onClick={() => selectCustomer(customer)}
                      >
                        <strong>{customer.customerCode}</strong>
                        <span>{customer.customerName}</span>
                      </button>
                    )) : <p>No active customers found.</p>}
                </div>
              )}
            </label>

            <label className="master-field">
              <span>Customer Code</span>

              <input
                value={form.customerCode}
                readOnly
                className="readonly"
              />
            </label>

            <label className="master-field">
              <span>Part Status</span>

              <select
                name="partStatus"
                value={form.partStatus}
                onChange={handleChange}
                disabled={isViewMode || form.partStatus === "DRAWING_UNDER_REVISION"}
              >
                {form.partStatus === "DRAWING_UNDER_REVISION" && (
                  <option value="DRAWING_UNDER_REVISION">Drawing Under Revision</option>
                )}
                {referenceData.options("RECORD_STATUS").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="master-field">
              <span>
                Part Category
                <b>*</b>
              </span>

              <select
                name="partCategory"
                value={form.partCategory}
                onChange={handleChange}
                disabled={isViewMode}
              >
                <option value="">
                  Select category
                </option>

                {referenceData.options("PART_CATEGORY").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="master-field span-2">
              <span>
                Part Name
                <b>*</b>
              </span>

              <input
                name="partName"
                value={form.partName}
                onChange={handleChange}
                readOnly={isViewMode}
                placeholder="Enter part name"
              />
            </label>

            <label className="master-field">
              <span>
                Part Number
                <b>*</b>
              </span>

              <input
                name="partNumber"
                value={form.partNumber}
                onChange={handleChange}
                readOnly={isViewMode}
                placeholder="Enter part number"
              />
            </label>

            <label className="master-field span-2">
              <span>Project Name</span>

              <input
                name="projectName"
                value={form.projectName}
                onChange={handleChange}
                readOnly={isViewMode}
                placeholder="Enter project name"
              />
            </label>
          </div>

        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Drawing Details</h2>

              <p>
                Drawing number, revision and drawing
                code information.
              </p>
            </div>
          </div>

          <div className="master-form-grid part-drawing-details-grid">
            <label className="master-field">
              <span>Drawing Number</span>

              <input
                name="drawingNumber"
                value={form.drawingNumber}
                onChange={handleChange}
                readOnly={isViewMode}
              />
            </label>

            <label className="master-field">
              <span>Drawing Revision Number</span>

              <input
                name="drawingRevisionNumber"
                value={form.drawingRevisionNumber}
                onChange={handleChange}
                readOnly={isViewMode}
              />
            </label>

            <label className="master-field">
              <span>Drawing Revision Date</span>

              <DateInput
                type="date"
                name="drawingRevisionDate"
                value={form.drawingRevisionDate}
                onChange={handleChange}
                readOnly={isViewMode}
              />
            </label>

            <label className="master-field">
              <span>Drawing Code Mode</span>

              <select
                name="drawingCodeMode"
                value={form.drawingCodeMode}
                onChange={handleDrawingModeChange}
                disabled={isViewMode}
              >
                {referenceData.options("DRAWING_CODE_MODE").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="master-field span-2">
              <span>Drawing Code</span>

              <input
                name="drawingCode"
                value={form.drawingCode}
                onChange={handleChange}
                readOnly={
                  isViewMode || form.drawingCodeMode ===
                  "AUTO_GENERATED"
                }
                className={
                  isViewMode || form.drawingCodeMode ===
                  "AUTO_GENERATED"
                    ? "readonly"
                    : ""
                }
              />
            </label>
          </div>
        </section>

        <section className="master-form-section part-attachments-section">
            <aside className="part-drawing-attachments-panel" aria-label="Part attachments">
              <header>
                <div>
                  <h3>Attachments</h3>
                  <p>Drawings and supporting files</p>
                </div>
                {!isViewMode && <button
                  type="button"
                  className="marketing-add-line-button"
                  onClick={addAttachment}
                >
                  <Plus size={15} /> Add
                </button>}
              </header>

              <div className="part-attachment-list">
                {form.attachments.map((attachment, index) => (
                  <div className="part-attachment-row" key={`${index}-${attachment.attachmentId ?? "new"}`}>
                    <span className="part-attachment-index">{index + 1}</span>
                    <div className="part-attachment-fields">
                      <select
                        value={attachment.attachmentType}
                        disabled={isViewMode}
                        onChange={(event) => updateAttachmentType(index, event.target.value as PartAttachmentType)}
                      >
                        {partAttachmentTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        value={attachment.attachmentName}
                        readOnly={isViewMode}
                        onChange={(event) => updateAttachment(index, "attachmentName", event.target.value)}
                        placeholder="Document name (optional)"
                      />
                      {!isViewMode && (
                        <label className="part-attachment-file-picker">
                          <input
                            type="file"
                            accept={attachment.attachmentType === "PART_MODEL" ? ".step,.stp" : ".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.step,.stp,.doc,.docx,.xls,.xlsx"}
                            onChange={(event) => selectAttachmentFile(index, event.target.files?.[0] ?? null)}
                          />
                          <span>{attachment.file?.name || (attachment.fileName ? "Replace file" : "Choose file")}</span>
                        </label>
                      )}
                    </div>
                    {attachment.fileUrl && (
                      <a className="part-attachment-file-link" href={attachment.fileUrl} target="_blank" rel="noreferrer" title={attachment.fileName || "Open attached file"}>
                        <ExternalLink size={14} />
                        <span>{attachment.fileName || "Open file"}</span>
                      </a>
                    )}
                    {!isViewMode && (
                      <button
                        type="button"
                        className="marketing-delete-line-button part-attachment-delete"
                        disabled={form.attachments.length === 1}
                        onClick={() => void removeAttachment(index)}
                        aria-label={`Delete attachment ${index + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Related Master Creation</h2>

              <p>
                Choose additional technical masters to
                create for this part.
              </p>
            </div>
          </div>

          <div className="master-option-grid">
            <label className="master-checkbox-card">
              <input
                type="checkbox"
                name="createBillOfMaterial"
                checked={form.createBillOfMaterial}
                onChange={handleChange}
                disabled={isViewMode}
              />

              <div>
                <strong>
                  Create Bill of Material
                </strong>

                <span>
                  Prepare component and raw material
                  structure.
                </span>
              </div>
            </label>

            <label className="master-checkbox-card">
              <input
                type="checkbox"
                name="createProcessFlow"
                checked={form.createProcessFlow}
                onChange={handleChange}
                disabled={isViewMode}
              />

              <div>
                <strong>
                  Create Process Flow
                </strong>

                <span>
                  Configure manufacturing process
                  sequence.
                </span>
              </div>
            </label>

            <label className="master-checkbox-card">
              <input
                type="checkbox"
                name="createInspectionPlan"
                checked={form.createProcessFlow && form.createInspectionPlan}
                disabled
                aria-readonly="true"
              />

              <div>
                <strong>
                  Create Inspection Plan
                </strong>

                <span>
                  Configure quality inspection
                  parameters.
                </span>
              </div>
            </label>
          </div>

          {form.createProcessFlow && <PartProcessPlanVariantsEditor value={processPlans}
            onChange={setProcessPlans} masters={processMasters} saving={saving !== null}
            canApproveDocuments={isEditMode}
            printContext={{
              drawingNumber: form.drawingNumber,
              drawingRevisionNumber: form.drawingRevisionNumber,
              partKind: form.partCategory,
              partName: form.partName,
              partNumber: form.partNumber,
              drawingCode: form.drawingCode,
              customerName: form.customerName,
              materialSpecification: form.materialSpecification,
            }}
            onSaveInspection={(nextProcessPlans, saveOptions) => savePart("DRAFT", nextProcessPlans, saveOptions)} readOnly={isViewMode}/>} 

          {isEditMode && form.partStatus === "DRAWING_UNDER_REVISION" && form.createProcessFlow && (
            <section className="part-revision-release-panel">
              <div>
                <span className={`part-revision-release-status ${defaultProcessPlanReleased ? "released" : "draft"}`}>
                  <ShieldCheck size={16} />
                  Process Plan {defaultProcessPlanReleased ? "Released" : "Draft"}
                </span>
                <p>
                  {defaultProcessPlanReleased
                    ? "The active default Process Plan is approved. Click Update to retain this release."
                    : "Complete the Program, Tool List, Work Instructions and Inspection Plan, then approve and release the active default Process Plan."}
                </p>
              </div>
              {!isViewMode && !defaultProcessPlanReleased && (
                <button
                  type="button"
                  className="primary-action-button"
                  title={defaultProcessPlanReadyForRelease
                    ? "Approve & Release Process Plan"
                    : "Show the incomplete approval items"}
                  onClick={() => void releaseDefaultProcessPlan()}
                >
                  <ShieldCheck size={16} />
                  Approve & Release Process Plan
                </button>
              )}
            </section>
          )}

          {form.createBillOfMaterial && (
            <div className="part-bom-attachment-panel">
              {!isViewMode && <div className="part-bom-toolbar">
                <div className="part-bom-search-field">
                  <label htmlFor="part-bom-search">Bill of Material Attachment</label>
                  <div className="part-bom-search-wrap">
                    <PackageSearch size={16} />
                    <input
                      id="part-bom-search"
                      value={bomSearch}
                      onChange={(event) => {
                        const search = event.target.value;
                        setBomSearch(search);
                        setSelectedBomOption(null);
                        setBomOptions([]);
                        setBomSearchOpen(search.trim().length >= 2);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setBomSearchOpen(false);
                        }
                      }}
                      placeholder="Search by part number, item number or description..."
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={bomSearchOpen && bomSearch.trim().length >= 2}
                      aria-controls="part-bom-search-results"
                    />
                    {bomSearchOpen && bomSearch.trim().length >= 2 && (
                      <div id="part-bom-search-results" className="part-bom-search-results" role="listbox">
                        {bomSearchLoading && <div className="part-bom-search-message">Searching...</div>}
                        {!bomSearchLoading && !bomOptions.length && (
                          <div className="part-bom-search-message">No matching Part or Item found.</div>
                        )}
                        {!bomSearchLoading && bomOptions.map((option) => (
                          <button
                            type="button"
                            key={`${option.componentType}-${option.componentId}`}
                            onClick={() => selectBomOption(option)}
                          >
                            <span><strong>{option.componentCode}</strong><small>{option.componentDescription}</small></span>
                            <em>{option.uomCode || "-"}</em>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="marketing-add-line-button"
                  disabled={!selectedBomOption}
                  onClick={attachBomOption}
                >
                  <Plus size={16} />Attach
                </button>
              </div>}

              <div className="part-bom-table-wrap">
                <table className="part-bom-table">
                  <thead><tr><th>Part Detail (Part Number, Description)</th><th>UOM</th><th>Quantity</th>{!isViewMode && <th>Action</th>}</tr></thead>
                  <tbody>
                    {!bomComponents.length && (
                      <tr><td colSpan={isViewMode ? 3 : 4} className="part-bom-empty">No Part or Item attached.</td></tr>
                    )}
                    {bomComponents.map((component, index) => (
                      <tr key={`${component.componentType}-${component.componentId}`}>
                        <td><strong>{component.componentCode}</strong><small>{component.componentDescription}</small></td>
                        <td>{component.uomCode || "-"}</td>
                        <td><input type="number" min="0.001" step="0.001" value={component.quantity}
                          readOnly={isViewMode}
                          onChange={(event) => updateBomQuantity(index, event.target.value)} /></td>
                        {!isViewMode && <td><button type="button" className="marketing-delete-line-button"
                          onClick={() => void removeBomComponent(index)} aria-label={`Delete ${component.componentCode}`}>
                          <Trash2 size={16}/></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isEditMode && form.partStatus === "DRAWING_UNDER_REVISION" && (
            <section className="part-revision-release-panel">
              <div>
                <span className={`part-revision-release-status ${form.bomReleaseStatus.toLowerCase()}`}>
                  <ShieldCheck size={16} />
                  BOM {form.bomReleaseStatus === "RELEASED" ? "Released" : form.bomReleaseStatus === "NOT_REQUIRED" ? "Not required" : "Draft"}
                </span>
                <p>
                  {bomComponents.length
                    ? "Review the copied BOM, then approve and release it independently."
                    : "No BOM is attached, so BOM release is not required for this revision."}
                </p>
              </div>
              {!isViewMode && form.bomReleaseStatus === "DRAFT" && (
                <button type="button" className="primary-action-button" disabled={bomReleasing}
                  onClick={() => void releaseRevisionBom()}>
                  <ShieldCheck size={16} />
                  {bomReleasing ? "Releasing..." : "Approve & Release BOM"}
                </button>
              )}
            </section>
          )}
        </section>

      </form>

      {revisionClone && (
        <div className="part-revision-clone-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !revisionCloning) setRevisionClone(null);
        }}>
          <form className="part-revision-clone-dialog" role="dialog" aria-modal="true"
            aria-labelledby="part-revision-clone-title" onSubmit={createRevisionClone}>
            <header>
              <div>
                <GitBranch size={21} />
                <span>
                  <h2 id="part-revision-clone-title">Create Drawing Revision</h2>
                  <p>{form.partNumber} will be made inactive after the revision is created.</p>
                </span>
              </div>
              <button type="button" disabled={revisionCloning} onClick={() => setRevisionClone(null)} aria-label="Close drawing revision form">
                <X size={18} />
              </button>
            </header>
            <div className="part-revision-clone-content">
              <p className="part-revision-clone-notice">
                BOM, Process Plan, linked Inspection Plan and drawings will be copied. The new Part stays under revision until QA releases the BOM and default Process Plan.
              </p>
              <div className="master-form-grid">
                <label className="master-field">
                  <span>New Part Number <b>*</b></span>
                  <input autoFocus value={revisionClone.partNumber} onChange={(event) => setRevisionClone((current) => current ? { ...current, partNumber: event.target.value } : current)} />
                </label>
                <label className="master-field">
                  <span>Drawing Number</span>
                  <input value={revisionClone.drawingNumber} onChange={(event) => setRevisionClone((current) => current ? { ...current, drawingNumber: event.target.value } : current)} />
                </label>
                <label className="master-field">
                  <span>New Drawing Revision <b>*</b></span>
                  <input value={revisionClone.drawingRevisionNumber} onChange={(event) => setRevisionClone((current) => current ? { ...current, drawingRevisionNumber: event.target.value } : current)} />
                </label>
                <label className="master-field">
                  <span>Revision Date</span>
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={revisionClone.drawingRevisionDate} onChange={(event) => setRevisionClone((current) => current ? { ...current, drawingRevisionDate: event.target.value } : current)} />
                </label>
              </div>
            </div>
            <footer>
              <button type="button" className="secondary-action-button" disabled={revisionCloning} onClick={() => setRevisionClone(null)}>Cancel</button>
              <button type="submit" className="primary-action-button" disabled={revisionCloning}>
                <GitBranch size={16} />
                {revisionCloning ? "Creating..." : "Create Revision"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {bomHierarchyOpen && (
        <div className="part-bom-hierarchy-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeBomHierarchy();
        }}>
          <section className="part-bom-hierarchy-modal" role="dialog" aria-modal="true"
            aria-labelledby="part-bom-hierarchy-title"
            aria-hidden={hierarchyDetail ? true : undefined}>
            <header>
              <div><Network size={20}/><span><h2 id="part-bom-hierarchy-title">Part Hierarchy</h2>
                <p>{form.partNumber} - {form.partName}</p></span></div>
              <button type="button" onClick={closeBomHierarchy} aria-label="Close hierarchy">
                <X size={18}/>
              </button>
            </header>
            <div className="part-bom-hierarchy-content">
              {bomHierarchyLoading && <div className="part-bom-hierarchy-message">Loading hierarchy...</div>}
              {!bomHierarchyLoading && bomHierarchy && (
                <ul className="part-bom-hierarchy-tree">
                  <BomHierarchyBranch node={bomHierarchy} onOpenDetail={openHierarchyDetail}/>
                </ul>
              )}
            </div>
            <footer><button type="button" className="secondary-action-button"
              onClick={closeBomHierarchy}>Close</button></footer>
          </section>

          {hierarchyDetail && (
            <>
              <div
                className="part-detail-drawer-scrim"
                onMouseDown={closeHierarchyDetail}
              />
              <aside
                className="part-detail-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hierarchy-part-detail-title"
              >
                <header>
                  <div>
                    {hierarchyDetail.detailType === "PART"
                      ? <Box size={23}/>
                      : <Package size={23}/>
                    }
                    <span>
                      <h2 id="hierarchy-part-detail-title">
                        {hierarchyDetail.detailType === "PART" ? "Part Details" : "Item Details"}
                      </h2>
                      <p>{hierarchyDetail.code} - {hierarchyDetail.description}</p>
                    </span>
                  </div>
                  {!isViewMode && <button
                    type="button"
                    onClick={closeHierarchyDetail}
                    aria-label={`Close ${hierarchyDetail.detailType.toLowerCase()} details`}
                  >
                    <X size={19}/>
                  </button>}
                </header>

                <div className="part-detail-drawer-content">
                  <h3>{hierarchyDetail.detailType === "PART" ? "Part Information" : "Item Information"}</h3>

                  {hierarchyDetailLoading && (
                    <div className="part-detail-drawer-message">
                      Loading {hierarchyDetail.detailType.toLowerCase()} details...
                    </div>
                  )}

                  {!hierarchyDetailLoading && hierarchyDetailError && (
                    <div className="part-detail-drawer-error">{hierarchyDetailError}</div>
                  )}

                  {!hierarchyDetailLoading && !hierarchyDetailError && (
                    <dl className="part-detail-grid">
                      <div>
                        <dt>{hierarchyDetail.detailType === "PART" ? "Part Number" : "Item Code"}</dt>
                        <dd>{hierarchyDetail.code || "-"}</dd>
                      </div>
                      <div>
                        <dt>{hierarchyDetail.detailType === "PART" ? "Part Name" : "Item Description"}</dt>
                        <dd>{hierarchyDetail.description || "-"}</dd>
                      </div>
                      <div><dt>{hierarchyDetail.detailType === "PART" ? "Part Status" : "Item Status"}</dt><dd>
                        <span className={`part-detail-status ${hierarchyDetail.status.toLowerCase()}`}>
                          {readableCode(hierarchyDetail.status) || "-"}
                        </span>
                      </dd></div>
                      {hierarchyDetail.detailType === "PART" ? (
                        <>
                          <div><dt>Part Category</dt><dd>
                            {readableCode(hierarchyDetail.partCategory) || "-"}
                          </dd></div>
                          <div><dt>Drawing Number</dt><dd>{hierarchyDetail.drawingNumber || "-"}</dd></div>
                          <div><dt>Revision</dt><dd>{hierarchyDetail.drawingRevisionNumber || "-"}</dd></div>
                          <div><dt>Material and Grade</dt><dd>{hierarchyDetail.materialAndGrade || "-"}</dd></div>
                          <div><dt>Unit of Measurement</dt><dd>{hierarchyDetail.unitOfMeasurement || "-"}</dd></div>
                        </>
                      ) : (
                        <>
                          <div><dt>Item Group</dt><dd>{hierarchyDetail.itemGroup || "-"}</dd></div>
                          <div><dt>Item Type</dt><dd>{hierarchyDetail.itemType || "-"}</dd></div>
                          <div><dt>Material</dt><dd>{hierarchyDetail.materialAndGrade || "-"}</dd></div>
                          <div><dt>Unit of Measurement</dt><dd>{hierarchyDetail.unitOfMeasurement || "-"}</dd></div>
                          <div><dt>Inspection Required</dt><dd>{hierarchyDetail.inspectionRequired || "-"}</dd></div>
                        </>
                      )}
                    </dl>
                  )}
                </div>

                <footer>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={closeHierarchyDetail}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="primary-action-button"
                    onClick={() => openFullDetail(hierarchyDetail)}
                  >
                    <ExternalLink size={16}/>
                    Open Full {hierarchyDetail.detailType === "PART" ? "Part" : "Item"}
                  </button>
                </footer>
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  );
}
