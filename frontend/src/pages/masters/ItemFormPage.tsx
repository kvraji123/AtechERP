import DateInput from "../../components/DateInput";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import { ArrowLeft, Boxes, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { itemApi } from "../../api/item.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import { useReferenceData } from "../../hooks/useReferenceData";
import ItemIncomingInspectionPlan, { type ItemInspectionCharacteristicRow } from "./ItemIncomingInspectionPlan";
import "./CustomerFormPage.css";
import "./ItemFormPage.css";

type Group = { itemGroupId: number; groupCode: string; groupName: string };
type ItemType = { itemTypeId: number; itemGroupId: number; typeName: string; descriptionPrefix: string; itemCodePrefix: string };
type CustomerOption = { customerId: number; customerCode: string; customerName: string };
type Uom = { uomId: number; uomCode: string; uomName: string };
type Material = { materialId: number; materialName: string };
type MaterialGrade = { materialGradeId: number; materialId: number; gradeCode: string; gradeName: string; materialName: string; materialShortCode: string; materialAndGrade: string };
type SpecField = { specFieldId: number; itemTypeId: number; fieldCode: string; fieldLabel: string; inputType: "TEXT" | "NUMBER" | "SELECT"; requiredFlag: "Y" | "N"; optionValues: string[] | string | null; allowedUomCodes: string[] | string | null; defaultUomCode?: string; visibleWhenField?: string; visibleWhenValue?: string; requireOneGroup?: string; displayOrder: number };
type DescriptionTemplate = { templateId: number; itemTypeId: number; conditionFieldCode?: string; conditionOperator: "EQUALS" | "PRESENT" | "DEFAULT"; conditionValue?: string; templateText: string; displayOrder: number };
type SpecValue = { value: string; uomId: string };
type SupplierOption = { supplierId: number; supplierCode: string; supplierName: string };
type ReferenceValue = { referenceGroup: string; referenceCode: string; referenceLabel: string };
type HsnCode = { hsnCode: string; hsnDescription: string };
type DrawingCode = { drawingCode: string; drawingNumber: string; partNumber: string; partName: string };
type MachineType = { machineTypeId: number; machineTypeCode: string; machineTypeName: string };
type SupplierRow = { supplierId: string; supplierItemCode: string; purchaseRate: string; currencyCode: string; moq: string; leadTimeDays: string; effectiveFrom: string; effectiveTo: string; preferredSupplier: boolean; remarks: string };
type AttachmentRow = { documentType: string; documentDescription: string; file: File | null };
type ExistingAttachment = { itemAttachmentId: number; documentType: string; documentDescription?: string; fileName: string; fileUrl: string };
type InspectionCharacteristicMaster = { characteristicMasterId: number; characteristicCode: string; characteristicName: string; characteristicType: "VARIABLE" | "ATTRIBUTE" };
type InspectionInstrument = { instrumentMasterId: number; instrumentCode: string; instrumentName: string };
type ToleranceGrade = { toleranceGradeId: number; gradeCode: string; basicSizeFrom: number; basicSizeTo: number; lowerDeviationMicrons: number; upperDeviationMicrons: number };
type LookupOption = { value: string; label: string };
type Lookups = { groups: Group[]; types: ItemType[]; uoms: Uom[]; materials: Material[]; materialGrades: MaterialGrade[]; suppliers: SupplierOption[]; customers: CustomerOption[]; references: ReferenceValue[]; hsnCodes: HsnCode[]; drawingCodes: DrawingCode[]; specFields: SpecField[]; descriptionTemplates: DescriptionTemplate[]; machineTypes: MachineType[]; characteristics: InspectionCharacteristicMaster[]; instruments: InspectionInstrument[]; toleranceGrades: ToleranceGrade[]; sampleSizes: LookupOption[]; frequencies: LookupOption[] };

const emptyLookups: Lookups = { groups: [], types: [], uoms: [], materials: [], materialGrades: [], suppliers: [], customers: [], references: [], hsnCodes: [], drawingCodes: [], specFields: [], descriptionTemplates: [], machineTypes: [], characteristics: [], instruments: [], toleranceGrades: [], sampleSizes: [], frequencies: [] };
const blankSupplier = (): SupplierRow => ({ supplierId: "", supplierItemCode: "", purchaseRate: "", currencyCode: "INR", moq: "", leadTimeDays: "", effectiveFrom: "", effectiveTo: "", preferredSupplier: false, remarks: "" });
const blankAttachment = (): AttachmentRow => ({ documentType: "OTHER", documentDescription: "", file: null });
const withItemGroupPrefix = (groupCode: string | undefined, description: string) => {
  const normalizedDescription = description.trim().replace(/\s+/g, " ");
  const prefix = `${(groupCode || "").trim().toUpperCase()}-`;
  if (!normalizedDescription || !prefix.trim() || normalizedDescription.toUpperCase() === prefix) return "";
  const descriptionWithoutPrefix = normalizedDescription.replace(new RegExp(`^${prefix}\\s*`, "i"), "").trim();
  return descriptionWithoutPrefix ? `${prefix}${descriptionWithoutPrefix}` : "";
};
const initialForm = { itemCode: "Auto Generated", itemGroupId: "", itemTypeId: "", customerId: "", itemDescription: "",
  itemSpecification: "", additionalDescription: "", uomId: "", materialGradeId: "", inspectionRequired: "N", hsnCode: "",
  purchaseRate: "", minimumStock: "", makeName: "", modelName: "", machineTypeId: "", machineCapacity: "", itemStatus: "ACTIVE",
  leadTimeDays: "",
  reorderLevel: "", maximumStock: "", storageLocation: "", shelfLifeApplicable: "N", shelfLifeDays: "", batchTrackingRequired: "N",
  serialTrackingRequired: "N", drawingNumber: "", drawingRevision: "", serialNumber: "", assetCategory: "",
  warrantyApplicable: "N", warrantyPeriodMonths: "", installationRequired: "N", calibrationRequired: "N",
  calibrationFrequency: "", measurementRange: "", leastCount: "", accuracy: "", calibrationAgencyId: "", remarks: "" };

export default function ItemFormPage() {
  const referenceData = useReferenceData(["YES_NO", "DOCUMENT_TYPE"]);
  const navigate = useNavigate();
  const { id } = useParams();
  const itemId = Number(id || 0);
  const isEdit = itemId > 0;
  const { confirmDelete } = useAppFeedback();
  const [form, setForm] = useState(initialForm);
  const [lookups, setLookups] = useState<Lookups>(emptyLookups);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([blankSupplier()]);
  const [specValues, setSpecValues] = useState<Record<string, SpecValue>>({});
  const [inspectionPlanCharacteristics, setInspectionPlanCharacteristics] = useState<ItemInspectionCharacteristicRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([blankAttachment()]);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const unsaved = useUnsavedChanges({form,suppliers,specValues,inspectionPlanCharacteristics,attachments});

  useEffect(() => {
    const requests: Promise<any>[] = [itemApi.lookups()];
    if (isEdit) requests.push(itemApi.getById(itemId));
    Promise.all(requests).then(([lookupResponse, itemResponse]) => {
      setLookups({ ...emptyLookups, ...(lookupResponse?.data ?? {}) });
      if (!itemResponse) return;
      const data = itemResponse.data ?? {};
      const loadedCategory = (lookupResponse?.data?.types ?? []).find((row: ItemType) =>
        Number(row.itemTypeId) === Number(data.item_type_id));
      setCategorySearch(loadedCategory?.typeName ?? "");
      setForm({ itemCode: data.item_code ?? "", itemGroupId: String(data.item_group_id ?? ""),
        itemTypeId: String(data.item_type_id ?? ""), customerId: String(data.customerId ?? ""), itemDescription: data.item_description ?? "",
        itemSpecification: data.item_specification ?? "", additionalDescription: data.additional_description ?? "", uomId: String(data.uom_id ?? ""),
        materialGradeId: String(data.material_grade_id ?? data.materialGradeId ?? ""), inspectionRequired: data.inspection_required ?? "N",
        hsnCode: data.hsn_code ?? "", purchaseRate: String(data.purchase_rate ?? ""),
        minimumStock: String(data.minimum_stock ?? ""), makeName: data.make_name ?? "",
        modelName: data.model_name ?? "", machineTypeId: String(data.machine_type_id ?? ""),
        machineCapacity: data.machine_capacity ?? "", itemStatus: data.item_status ?? "ACTIVE",
        leadTimeDays: String(data.lead_time_days ?? ""),
        reorderLevel: String(data.reorder_level ?? ""), maximumStock: String(data.maximum_stock ?? ""),
        storageLocation: data.storage_location ?? "", shelfLifeApplicable: data.shelf_life_applicable ?? "N",
        shelfLifeDays: String(data.shelf_life_days ?? ""),
        batchTrackingRequired: data.batch_tracking_required ?? "N", serialTrackingRequired: data.serial_tracking_required ?? "N",
        drawingNumber: data.drawing_number ?? "", drawingRevision: data.drawing_revision ?? "",
        serialNumber: data.serial_number ?? "", assetCategory: data.asset_category ?? "",
        warrantyApplicable: data.warranty_applicable ?? "N", warrantyPeriodMonths: String(data.warranty_period_months ?? ""),
        installationRequired: data.installation_required ?? "N", calibrationRequired: data.calibration_required ?? "N",
        calibrationFrequency: data.calibration_frequency ?? "", measurementRange: data.measurement_range ?? "",
        leastCount: data.least_count ?? "", accuracy: data.accuracy ?? "",
        calibrationAgencyId: String(data.calibration_agency_id ?? ""), remarks: data.remarks ?? "" });
      setSuppliers(data.suppliers?.length ? data.suppliers.map((row: any) => ({ supplierId: String(row.supplierId),
        supplierItemCode: row.supplierItemCode ?? "", purchaseRate: String(row.purchaseRate ?? ""),
        currencyCode: row.currencyCode ?? "INR", moq: String(row.moq ?? ""), leadTimeDays: String(row.leadTimeDays ?? ""),
        effectiveFrom: row.effectiveFrom?.slice?.(0,10) ?? "", effectiveTo: row.effectiveTo?.slice?.(0,10) ?? "",
        preferredSupplier: row.preferredSupplier === "Y", remarks: row.remarks ?? "" })) : [blankSupplier()]);
      setSpecValues(Object.fromEntries((data.specifications ?? []).map((row: any) => [row.fieldCode,
        { value: String(row.valueNumber ?? row.valueText ?? ""), uomId: String(row.uomId ?? "") }])));
      setInspectionPlanCharacteristics((data.inspectionPlanCharacteristics ?? []).map((row: any) => ({
        itemInspectionCharacteristicId: Number(row.itemInspectionCharacteristicId || 0) || undefined,
        characteristicMasterId: String(row.characteristicMasterId ?? ""),
        characteristicText: row.characteristicText ?? "",
        characteristicSearch: row.characteristicText || row.characteristicName || row.characteristicCode || "", specifiedDimension: String(row.specifiedDimension ?? ""),
        toleranceGradeId: String(row.toleranceGradeId ?? ""), toleranceGradeText: row.toleranceGradeText ?? row.gradeCode ?? "",
        toleranceMinus: String(row.toleranceMinus ?? ""), tolerancePlus: String(row.tolerancePlus ?? ""),
        lsl: String(row.lsl ?? ""), usl: String(row.usl ?? ""), drawingGrid: row.drawingGrid ?? "",
        instrumentMasterId: String(row.instrumentMasterId ?? ""), sampleSize: row.sampleSize ?? "", inspectionFrequency: row.inspectionFrequency ?? "",
      })));
      setExistingAttachments(data.attachments ?? []);
    }).catch((loadError) => setError(apiMessage(loadError))).finally(() => setLoading(false));
  }, [isEdit, itemId]);

  const selectedGroup = lookups.groups.find((row) => row.itemGroupId === Number(form.itemGroupId));
  const selectedType = lookups.types.find((row) => row.itemTypeId === Number(form.itemTypeId));
  const isRawMaterial = selectedGroup?.groupCode === "RM";
  const isPurchasedItem = selectedGroup?.groupCode === "PU";
  const isPackingMaterial = selectedGroup?.groupCode === "PC";
  const isCustomerSupplied = selectedGroup?.groupCode === "CS";
  const requiresMaterialGrade = isRawMaterial || isCustomerSupplied;
  const isConsumable = selectedGroup?.groupCode === "CM";
  const isMachineItem = selectedGroup?.groupCode === "CA" && selectedType?.typeName === "Machines & Equipment";
  const isRetiredPurchasedCategory = (category: ItemType) => selectedGroup?.groupCode === "PU"
    && ["PURCHASED ITEM", "PURCHASED ITEMS"].includes(category.typeName.trim().toUpperCase());
  const availableTypes = useMemo(() => lookups.types.filter((row) =>
    row.itemGroupId === Number(form.itemGroupId)
    && (!isRetiredPurchasedCategory(row)
      || (isEdit && row.itemTypeId === Number(form.itemTypeId))
    )), [lookups.types, form.itemGroupId, form.itemTypeId, isEdit, selectedGroup]);
  const categoryMatches = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    return query ? availableTypes.filter((row) => row.typeName.toLowerCase().includes(query)) : availableTypes;
  }, [availableTypes, categorySearch]);
  const availableSpecFields = useMemo(() => lookups.specFields.filter((row) => row.itemTypeId === Number(form.itemTypeId)), [lookups.specFields, form.itemTypeId]);
  const autoDescription = isRawMaterial || isPurchasedItem || isPackingMaterial
    || (selectedGroup?.groupCode === "TL" && availableSpecFields.length > 0);
  const availableTemplates = useMemo(() => lookups.descriptionTemplates.filter((row) => row.itemTypeId === Number(form.itemTypeId)), [lookups.descriptionTemplates, form.itemTypeId]);
  const jsonArray = (value: string[] | string | null | undefined) => { if (Array.isArray(value)) return value; if (!value) return []; try { const parsed=JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
  const visibleSpecFields = availableSpecFields.filter((field) => !field.visibleWhenField || String(specValues[field.visibleWhenField]?.value ?? "").toUpperCase() === String(field.visibleWhenValue ?? "").toUpperCase());
  const itemSubtypeField = visibleSpecFields.find((field) => field.fieldCode === "item_subtype");
  const detailSpecFields = visibleSpecFields.filter((field) => field.fieldCode !== "item_subtype" && (!isPackingMaterial || field.fieldCode !== "size"));
  const generatedDescription = useMemo(() => {
    if (isPackingMaterial) return [selectedType?.typeName, specValues.size?.value.trim()].filter(Boolean).join(" - ");
    const selectedMaterial=lookups.materialGrades.find((row) => row.materialGradeId === Number(form.materialGradeId));
    const materialAndGrade = selectedMaterial
      ? [
          selectedMaterial.materialName,
          selectedMaterial.gradeCode === "GENERAL"
            ? ""
            : selectedMaterial.gradeName || selectedMaterial.gradeCode,
        ].filter(Boolean).join(" ")
      : "";
    if (!autoDescription) return form.itemDescription;
    const values: Record<string,string>={};
    for (const field of visibleSpecFields) {
      const current=specValues[field.fieldCode];
      const uom=lookups.uoms.find((row) => row.uomId === Number(current?.uomId));
      values[field.fieldCode]=current?.value ?? "";
      values[`${field.fieldCode}Uom`]=uom?.uomCode?.toLowerCase() ?? "";
      values[`${field.fieldCode}Label`]=String(current?.value ?? "").toLowerCase().replace(/(^|_)\w/g,(text) => text.replace("_"," ").toUpperCase());
    }
    const template=availableTemplates.find((row) => row.conditionOperator === "EQUALS" && String(values[row.conditionFieldCode ?? ""]).toUpperCase() === String(row.conditionValue ?? "").toUpperCase())
      ?? availableTemplates.find((row) => row.conditionOperator === "PRESENT" && values[row.conditionFieldCode ?? ""])
      ?? availableTemplates.find((row) => row.conditionOperator === "DEFAULT");
    if (isRawMaterial && !template) {
      return withItemGroupPrefix(selectedGroup?.groupCode, materialAndGrade);
    }
    if (!template) return "";
    const context: Record<string,string>={...values,optionalLength:values.length?.trim() ? ` × ${values.length} ${values.lengthUom}` : "",materialShort:selectedMaterial?.materialShortCode ?? selectedMaterial?.materialName ?? "",
      material:selectedMaterial?.materialName ?? "",grade:selectedMaterial?.gradeCode === "GENERAL" ? "" : (selectedMaterial?.gradeName ?? selectedMaterial?.gradeCode ?? ""),
      gradeOrMaterial:selectedMaterial?.gradeCode === "GENERAL" ? (selectedMaterial?.materialName ?? "") : (selectedMaterial?.gradeName ?? selectedMaterial?.gradeCode ?? "")};
    const description = template.templateText.replace(/\{([A-Za-z0-9_]+)\}/g,(_match,key) => context[key] ?? "").replace(/\s+/g," ").replace(/([Ø])\s+/g,"$1").trim();
    return isRawMaterial || isPurchasedItem
      ? withItemGroupPrefix(selectedGroup?.groupCode, description)
      : description;
  },[isPackingMaterial,isPurchasedItem,isRawMaterial,selectedGroup,selectedType,autoDescription,availableSpecFields,availableTemplates,form.itemDescription,form.itemSpecification,form.materialGradeId,lookups.materialGrades,lookups.uoms,specValues,visibleSpecFields]);
  const referenceOptions = (group: string) => lookups.references.filter((row) => row.referenceGroup === group);

  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (event.target.name === "inspectionRequired" && event.target.value !== "Y") setInspectionPlanCharacteristics([]);
    setError(""); setMessage("");
  };
  const changeGroup = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGroup = lookups.groups.find((row) => row.itemGroupId === Number(event.target.value));
    const autoGenerate = nextGroup?.groupCode === "RM" || nextGroup?.groupCode === "PU"
      || nextGroup?.groupCode === "PC";
    setForm((current) => ({ ...current, itemGroupId: event.target.value, itemTypeId: "",
      materialGradeId:["RM", "CS"].includes(nextGroup?.groupCode ?? "") ? current.materialGradeId : "",
      customerId: nextGroup?.groupCode === "CS" ? current.customerId : "",
      shelfLifeApplicable:nextGroup?.groupCode === "CM" ? current.shelfLifeApplicable : "N",
      shelfLifeDays:nextGroup?.groupCode === "CM" ? current.shelfLifeDays : "",
      itemDescription: autoGenerate ? "" : current.itemDescription,
      makeName: "", modelName: "", machineTypeId: "", machineCapacity: "", assetCategory: "" }));
    setCategorySearch(""); setCategoryOpen(false); setAddingCategory(false);
  };
  const changeShelfLife = (event: ChangeEvent<HTMLInputElement>) => {
    const applicable=event.target.value;
    setForm((current) => ({ ...current, shelfLifeApplicable:applicable,
      shelfLifeDays:applicable === "Y" ? current.shelfLifeDays : "" }));
    setError(""); setMessage("");
  };
  const applyItemType = (nextId: string) => {
    const nextIsMachineItem = selectedGroup?.groupCode === "CA"
      && lookups.types.find((row) => row.itemTypeId === Number(nextId))?.typeName === "Machines & Equipment";
    const configured = isRawMaterial || isPurchasedItem || isPackingMaterial
      || (selectedGroup?.groupCode === "TL"
        && lookups.specFields.some((row) => row.itemTypeId === Number(nextId)));
    setForm((current) => ({ ...current, itemTypeId: nextId,
      assetCategory: nextIsMachineItem ? current.assetCategory : "",
      itemDescription: configured ? "" : current.itemDescription }));
    const nextFields=lookups.specFields.filter((row) => row.itemTypeId === Number(nextId));
    setSpecValues(Object.fromEntries(nextFields.map((field) => [field.fieldCode,{ value:"",
      uomId:String(lookups.uoms.find((uom) => uom.uomCode === field.defaultUomCode)?.uomId ?? "") }])));
  };
  const selectItemCategory = (category: ItemType) => {
    applyItemType(String(category.itemTypeId));
    setCategorySearch(category.typeName);
    setCategoryOpen(false);
    setAddingCategory(false);
  };
  const categoryCodeSuggestion = (value: string) => value.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase();
  const beginAddCategory = () => {
    const name = categorySearch.trim();
    if (!name || !selectedGroup) return;
    setNewCategoryName(name);
    setNewCategoryCode(categoryCodeSuggestion(name));
    setAddingCategory(true);
    setCategoryOpen(false);
  };
  const createItemCategory = async () => {
    if (!selectedGroup) return;
    try {
      setSavingCategory(true); setError(""); setMessage("");
      const response = await itemApi.createCategory({ itemGroupId: selectedGroup.itemGroupId,
        typeName: newCategoryName.trim(), itemCodePrefix: newCategoryCode.trim() });
      const created = response.data as ItemType;
      setLookups((current) => ({ ...current, types: [...current.types, created]
        .sort((a, b) => a.itemGroupId - b.itemGroupId || a.typeName.localeCompare(b.typeName)) }));
      selectItemCategory(created);
      setMessage(`Item Category ${created.typeName} added and selected.`);
    } catch (createError) {
      setError(apiMessage(createError));
    } finally {
      setSavingCategory(false);
    }
  };
  const updateSpec = (field: SpecField, key: keyof SpecValue, value: string) => setSpecValues((current) => {
    const existing=current[field.fieldCode] ?? { value:"",uomId:"" };
    return { ...current,[field.fieldCode]:{...existing,[key]:value} };
  });

  const updateSupplier = (index: number, field: keyof SupplierRow, value: string | boolean) => {
    setSuppliers((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } :
      field === "preferredSupplier" && value === true ? { ...row, preferredSupplier: false } : row));
  };
  const removeSupplier = async (index: number) => {
    if (suppliers.length === 1) return;
    if (await confirmDelete({ title: "Remove supplier?", message: "This supplier link will be removed from the item.", confirmLabel: "Remove" }))
      setSuppliers((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  };
  const updateAttachment = (index: number, field: keyof AttachmentRow, value: string | File | null) =>
    setAttachments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const removeAttachmentRow = (index: number) => setAttachments((rows) => rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index));
  const deleteExistingAttachment = async (attachment: ExistingAttachment) => {
    if (!(await confirmDelete({ title: "Delete attachment?", message: `${attachment.fileName} will be permanently removed.`, confirmLabel: "Delete attachment" }))) return;
    try { await itemApi.deleteAttachment(itemId, attachment.itemAttachmentId);
      setExistingAttachments((rows) => rows.filter((row) => row.itemAttachmentId !== attachment.itemAttachmentId));
    } catch (deleteError) { setError(apiMessage(deleteError)); }
  };

  const validate = () => {
    if (!form.itemGroupId) return "Item Group is required.";
    if (!form.itemTypeId) return "Item Category is required.";
    if (isCustomerSupplied && !form.customerId) return "Customer is required for Customer Supplied items.";
    if (isPackingMaterial && !specValues.size?.value.trim()) return "Size is required for Packing Materials.";
    if (autoDescription && !generatedDescription.trim()) return "Complete the fields required to generate the Item Description.";
    if (generatedDescription.trim().length > 250) return "Item Description cannot exceed 250 characters.";
    if (!autoDescription && !form.itemDescription.trim()) return "Item Description is required.";
    if (requiresMaterialGrade && !form.materialGradeId) return "Material & Grade is required.";
    for (const field of visibleSpecFields) {
      const current=specValues[field.fieldCode];
      if (field.requiredFlag === "Y" && !current?.value) return `${field.fieldLabel} is required.`;
      if (current?.value?.trim() && jsonArray(field.allowedUomCodes).length && !current?.uomId) return `${field.fieldLabel} UOM is required.`;
    }
    if (!form.uomId) return "UOM is required.";
    if (form.inspectionRequired === "Y" && !inspectionPlanCharacteristics.length) return "Add at least one Incoming Inspection Plan characteristic when Inspection Required is Yes.";
    if (form.inspectionRequired === "Y" && inspectionPlanCharacteristics.some((row) => !row.characteristicMasterId && !row.characteristicText.trim())) return "Enter or select a Characteristic for every inspection row.";
    if (isConsumable && form.shelfLifeApplicable === "Y" && (!form.shelfLifeDays || Number(form.shelfLifeDays) <= 0 || !Number.isInteger(Number(form.shelfLifeDays)))) return "Shelf Life Days must be a whole number greater than zero.";
    if (isMachineItem && !form.makeName.trim()) return "Make is required for Machines & Equipment.";
    if (isMachineItem && !form.modelName.trim()) return "Model is required for Machines & Equipment.";
    if (isMachineItem && !form.machineTypeId) return "Machine Type is required for Machines & Equipment.";
    if (isMachineItem && !form.machineCapacity.trim()) return "Machine Capacity is required for Machines & Equipment.";
    if (form.hsnCode && !/^\d+$/.test(form.hsnCode)) return "HSN Code must contain digits only.";
    const selected = suppliers.filter((row) => row.supplierId).map((row) => row.supplierId);
    if (new Set(selected).size !== selected.length) return "Duplicate suppliers are not allowed.";
    return "";
  };

  const save = async (event: FormEvent) => {
    const savedSnapshot = unsaved.snapshot();

    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    try {
      setSaving(true); setError(""); setMessage("");
      const payload = { itemGroupId: Number(form.itemGroupId), itemTypeId: Number(form.itemTypeId),
        customerId: isCustomerSupplied && form.customerId ? Number(form.customerId) : null,
        itemDescription: generatedDescription.trim(), itemSpecification: form.itemSpecification.trim() || null,
        additionalDescription: form.additionalDescription.trim() || null,
        uomId: Number(form.uomId), materialGradeId: requiresMaterialGrade && form.materialGradeId ? Number(form.materialGradeId) : null,
        inspectionRequired: form.inspectionRequired, inspectionPlanCharacteristics: form.inspectionRequired === "Y" ? inspectionPlanCharacteristics.map((row) => ({
          characteristicMasterId: row.characteristicMasterId ? Number(row.characteristicMasterId) : null,
          characteristicText: row.characteristicMasterId ? null : row.characteristicText.trim() || null,
          specifiedDimension: row.specifiedDimension === "" ? null : Number(row.specifiedDimension),
          toleranceGradeId: row.toleranceGradeId ? Number(row.toleranceGradeId) : null, toleranceGradeText: row.toleranceGradeText.trim() || null,
          toleranceMinus: row.toleranceMinus === "" ? null : Number(row.toleranceMinus), tolerancePlus: row.tolerancePlus === "" ? null : Number(row.tolerancePlus),
          drawingGrid: row.drawingGrid.trim() || null, instrumentMasterId: row.instrumentMasterId ? Number(row.instrumentMasterId) : null,
          sampleSize: row.sampleSize || null, inspectionFrequency: row.inspectionFrequency || null,
        })) : [], hsnCode: form.hsnCode.trim() || null,
        purchaseRate: form.purchaseRate === "" ? null : Number(form.purchaseRate),
        minimumStock: form.minimumStock === "" ? null : Number(form.minimumStock),
        makeName: form.makeName.trim() || null, modelName: form.modelName.trim() || null,
        machineTypeId: form.machineTypeId ? Number(form.machineTypeId) : null,
        machineCapacity: form.machineCapacity.trim() || null,
        leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
        reorderLevel: form.reorderLevel === "" ? null : Number(form.reorderLevel), maximumStock: form.maximumStock === "" ? null : Number(form.maximumStock),
        storageLocation: form.storageLocation.trim() || null,
        shelfLifeApplicable: isConsumable ? form.shelfLifeApplicable : "N",
        shelfLifeDays: isConsumable && form.shelfLifeApplicable === "Y" ? Number(form.shelfLifeDays) : null,
        batchTrackingRequired: form.batchTrackingRequired, serialTrackingRequired: form.serialTrackingRequired,
        drawingNumber: form.drawingNumber.trim() || null, drawingRevision: form.drawingRevision.trim() || null,
        serialNumber: form.serialNumber.trim() || null, assetCategory: isMachineItem ? form.assetCategory || null : null,
        warrantyApplicable: form.warrantyApplicable, warrantyPeriodMonths: form.warrantyPeriodMonths === "" ? null : Number(form.warrantyPeriodMonths),
        installationRequired: form.installationRequired, calibrationRequired: form.calibrationRequired,
        calibrationFrequency: form.calibrationFrequency || null, measurementRange: form.measurementRange.trim() || null,
        leastCount: form.leastCount.trim() || null, accuracy: form.accuracy.trim() || null,
        calibrationAgencyId: form.calibrationAgencyId ? Number(form.calibrationAgencyId) : null, remarks: form.remarks.trim() || null,
        suppliers: (isCustomerSupplied ? [] : suppliers.filter((row) => row.supplierId)).map((row) => ({ supplierId: Number(row.supplierId),
          supplierItemCode: row.supplierItemCode.trim() || null,
          purchaseRate: row.purchaseRate === "" ? null : Number(row.purchaseRate),
          currencyCode: row.currencyCode, moq: row.moq === "" ? null : Number(row.moq),
          leadTimeDays: row.leadTimeDays === "" ? null : Number(row.leadTimeDays),
          effectiveFrom: row.effectiveFrom || null, effectiveTo: row.effectiveTo || null,
          preferredSupplier: row.preferredSupplier ? "Y" : "N", remarks: row.remarks.trim() || null })),
        specifications: visibleSpecFields.map((field) => ({ specFieldId:field.specFieldId,fieldCode:field.fieldCode,
          value:specValues[field.fieldCode]?.value ?? "",uomId:specValues[field.fieldCode]?.uomId ? Number(specValues[field.fieldCode].uomId) : null })) };
      const response = isEdit ? await itemApi.update(itemId, payload) : await itemApi.create(payload);
      const savedId = Number(response?.data?.item_id ?? itemId);
      if (savedId && (isEdit || form.itemStatus !== "ACTIVE")) await itemApi.changeStatus(savedId, form.itemStatus as "ACTIVE" | "INACTIVE" | "OBSOLETE");
      for (const attachment of attachments.filter((row) => row.file)) {
        const body = new FormData(); body.append("file", attachment.file as File);
        body.append("documentType", attachment.documentType); body.append("documentDescription", attachment.documentDescription);
        await itemApi.uploadAttachment(savedId, body);
      }
      unsaved.markSaved(savedSnapshot); setMessage(response?.message ?? "Item saved successfully.");
      window.setTimeout(() => navigate("/masters/items"), 600);
    } catch (saveError) { setError(apiMessage(saveError)); } finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="master-table-message">Loading Item Master...</div></div>;
  return <div className="page-container master-form-page customer-form-compact">
    <section className="master-form-page-header"><div className="master-form-title-group"><Boxes size={22}/><h1>{isEdit ? "Edit Item" : "Create Item"}</h1></div>
      <div className="master-form-actions"><button type="button" className="customer-cancel-link" onClick={() => navigate("/masters/items")}><ArrowLeft size={15}/>Cancel</button>
        <button type="submit" form="item-master-form" className="primary-action-button" disabled={saving}><Save size={17}/>{saving ? "Saving..." : isEdit ? "Update Item" : "Create Item"}</button></div></section>
    {error && <Alert type="error" message={error}/>} {message && <Alert type="success" message={message}/>} 
    <form id="item-master-form" className="master-entry-form" onSubmit={save}>
      <section className="master-form-section"><div className="master-section-header"><div><h2>Item Identification</h2><p>Classification, generated code and description.</p></div></div>
        <div className="master-form-grid">
          <label className="master-field"><span>Item Group<b>*</b></span><select name="itemGroupId" value={form.itemGroupId} onChange={changeGroup} disabled={isEdit}><option value="">Select group</option>{lookups.groups.map((g) => <option key={g.itemGroupId} value={g.itemGroupId}>{g.groupCode} - {g.groupName}</option>)}</select></label>
          <div className="master-field item-category-combo"><span>Item Category<b>*</b></span>
            <div className="item-category-combo-control">
              <div className="item-category-combo-input"><input value={categorySearch} disabled={!form.itemGroupId} placeholder={form.itemGroupId ? "Search or add category" : "Select Item Group first"} onFocus={() => setCategoryOpen(true)} onBlur={() => window.setTimeout(() => setCategoryOpen(false), 120)} onChange={(event) => { setCategorySearch(event.target.value); setCategoryOpen(true); setAddingCategory(false); if (form.itemTypeId) { setForm((current) => ({ ...current, itemTypeId: "", assetCategory: "" })); setSpecValues({}); } }}/><span aria-hidden="true">⌕</span></div>
              {categoryOpen && form.itemGroupId && <div className="item-category-combo-options" role="listbox" aria-label="Item Category options">
                {categoryMatches.map((category) => <button key={category.itemTypeId} type="button" role="option" aria-selected={Number(form.itemTypeId) === category.itemTypeId} onMouseDown={(event) => event.preventDefault()} onClick={() => selectItemCategory(category)}>{category.typeName}</button>)}
                {!categoryMatches.length && <span>No matching Item Category.</span>}
                {categorySearch.trim() && !isRetiredPurchasedCategory({ itemTypeId: 0, itemGroupId: Number(form.itemGroupId), typeName: categorySearch.trim(), descriptionPrefix: "", itemCodePrefix: "" }) && !availableTypes.some((category) => category.typeName.toLowerCase() === categorySearch.trim().toLowerCase()) && <button type="button" className="item-category-add-option" onMouseDown={(event) => event.preventDefault()} onClick={beginAddCategory}><Plus size={14}/>Add “{categorySearch.trim()}”</button>}
              </div>}
            </div>
            {addingCategory && <div className="item-category-add-panel"><strong>Add Item Category</strong><div><label>Name<input value={newCategoryName} maxLength={120} onChange={(event) => setNewCategoryName(event.target.value)}/></label><label>Code<input value={newCategoryCode} minLength={2} maxLength={10} onChange={(event) => setNewCategoryCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}/></label></div><small>2–10 letters or numbers. This code is used when generating the Item Code.</small><footer><button type="button" onClick={() => setAddingCategory(false)} disabled={savingCategory}>Cancel</button><button type="button" className="item-category-save-button" onClick={() => void createItemCategory()} disabled={savingCategory || !newCategoryName.trim() || newCategoryCode.trim().length < 2}>{savingCategory ? "Adding..." : "Add and Select"}</button></footer></div>}
          </div>
          {isCustomerSupplied && <label className="master-field"><span>Customer<b>*</b></span><select name="customerId" value={form.customerId} onChange={change}><option value="">Select customer</option>{lookups.customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} - {customer.customerName}</option>)}</select></label>}
          {itemSubtypeField && <label className="master-field"><span>Item Type{itemSubtypeField.requiredFlag === "Y" && <b>*</b>}</span><select name="itemSubtype" value={specValues.item_subtype?.value ?? ""} onChange={(event) => updateSpec(itemSubtypeField, "value", event.target.value)}><option value="">Select item type</option>{jsonArray(itemSubtypeField.optionValues).map((option) => <option key={option} value={option}>{option.toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase())}</option>)}</select></label>}
          {requiresMaterialGrade && <label className="master-field"><span>Material &amp; Grade<b>*</b></span><select name="materialGradeId" value={form.materialGradeId} onChange={change}><option value="">Select material &amp; grade</option>{lookups.materialGrades.map((grade) => <option key={grade.materialGradeId} value={grade.materialGradeId}>{grade.materialAndGrade}</option>)}</select></label>}
          <label className="master-field"><span>Item Code</span><input value={form.itemCode} readOnly className="readonly"/></label>
          <label className="master-field"><span>Status</span><select name="itemStatus" value={form.itemStatus} onChange={change}>{referenceOptions("ITEM_STATUS").map((o) => <option key={o.referenceCode} value={o.referenceCode}>{o.referenceLabel}</option>)}</select></label>
          {isConsumable && <div className="master-field"><span>Shelf Life</span><div className="item-radio-group" role="radiogroup" aria-label="Shelf Life"><label><input type="radio" name="shelfLifeApplicable" value="Y" checked={form.shelfLifeApplicable === "Y"} onChange={changeShelfLife}/>Yes</label><label><input type="radio" name="shelfLifeApplicable" value="N" checked={form.shelfLifeApplicable === "N"} onChange={changeShelfLife}/>No</label></div></div>}
          {isConsumable && form.shelfLifeApplicable === "Y" && <label className="master-field"><span>Shelf Life Days<b>*</b></span><input type="number" min="1" step="1" name="shelfLifeDays" value={form.shelfLifeDays} onChange={change} placeholder="Enter number of days"/></label>}
          {isPackingMaterial && <label className="master-field"><span>Size<b>*</b></span><input name="packingSize" maxLength={200} value={specValues.size?.value ?? ""} onChange={(event) => setSpecValues((current) => ({ ...current, size: { value: event.target.value, uomId: "" } }))} placeholder="e.g. 300 x 200 x 150 mm"/></label>}
          <label className="master-field span-2"><span>Item Description<b>*</b></span><input name="itemDescription" maxLength={250} value={autoDescription ? generatedDescription : form.itemDescription} onChange={change} readOnly={autoDescription} className={autoDescription ? "Complete the selected specification fields to generate description" : "Enter item description"}/></label>
          <label className="master-field span-2"><span>Item Specification</span><textarea name="itemSpecification" maxLength={1000} value={form.itemSpecification} onChange={change} placeholder="Technical specification, standard, tolerance, capacity or rating"/></label>
          <label className="master-field span-2"><span>Additional Description</span><textarea name="additionalDescription" maxLength={1000} value={form.additionalDescription} onChange={change} placeholder="Only additional information not covered by generated description or specification fields"/></label>
        </div></section>
      {detailSpecFields.length > 0 && <section className="master-form-section"><div className="master-section-header"><div><h2>Item Specifications</h2><p>Fields are loaded from the selected Item Category configuration.{autoDescription && " Description is generated automatically."}</p></div></div><div className="master-form-grid">
        {detailSpecFields.map((field) => {
          const allowedUoms = jsonArray(field.allowedUomCodes);
          const current = specValues[field.fieldCode] ?? { value: "", uomId: "" };
          const isDrawingCodes = field.fieldCode === "drawing_codes";

          return <div className="master-field" key={field.specFieldId}>
            <span>{field.fieldLabel}{field.requiredFlag === "Y" && <b>*</b>}</span>
            <div className="item-dynamic-spec-control">
              {isDrawingCodes ? (
                <select
                  className="item-drawing-code-select"
                  multiple
                  value={current.value ? current.value.split("|").filter(Boolean) : []}
                  onChange={(event) => updateSpec(field, "value", Array.from(event.currentTarget.selectedOptions, (option) => option.value).join("|"))}
                >
                  {lookups.drawingCodes.map((drawing) => <option key={`${drawing.drawingCode}-${drawing.partNumber}`} value={drawing.drawingCode}>{drawing.drawingCode} — {drawing.partName || drawing.partNumber}</option>)}
                </select>
              ) : field.inputType === "SELECT" ? (
                <select value={current.value} onChange={(event) => updateSpec(field, "value", event.target.value)}>
                  <option value="">Select {field.fieldLabel.toLowerCase()}</option>
                  {jsonArray(field.optionValues).map((option) => <option key={option} value={option}>{option.toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase())}</option>)}
                </select>
              ) : (
                <input type={field.inputType === "NUMBER" ? "number" : "text"} min={field.inputType === "NUMBER" ? "0" : undefined} step={field.inputType === "NUMBER" ? "any" : undefined} value={current.value} onChange={(event) => updateSpec(field, "value", event.target.value)}/>
              )}
              {allowedUoms.length > 0 && <select className="item-spec-uom" value={current.uomId} onChange={(event) => updateSpec(field, "uomId", event.target.value)}><option value="">UOM</option>{lookups.uoms.filter((uom) => allowedUoms.includes(uom.uomCode)).map((uom) => <option key={uom.uomId} value={uom.uomId}>{uom.uomCode}</option>)}</select>}
            </div>
          </div>;
        })}
      </div></section>}
      <section className="master-form-section"><div className="master-section-header"><div><h2>Inventory and Purchasing</h2><p>Measurement, tax, inspection and stock controls.</p></div></div>
        <div className="master-form-grid">
          <label className="master-field"><span>UOM<b>*</b></span><select name="uomId" value={form.uomId} onChange={change}><option value="">Select UOM</option>{lookups.uoms.map((u) => <option key={u.uomId} value={u.uomId}>{u.uomCode} - {u.uomName}</option>)}</select></label>
          <label className="master-field"><span>Inspection Required<b>*</b></span><select name="inspectionRequired" value={form.inspectionRequired} onChange={change}>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="master-field"><span>HSN Code</span><input name="hsnCode" list="item-hsn-codes" inputMode="numeric" maxLength={20} value={form.hsnCode} onChange={change} placeholder="Search HSN code"/><datalist id="item-hsn-codes">{lookups.hsnCodes.map((h) => <option key={h.hsnCode} value={h.hsnCode}>{h.hsnDescription}</option>)}</datalist></label>
          <label className="master-field"><span>Reorder Level</span><input type="number" min="0" step="0.001" name="reorderLevel" value={form.reorderLevel} onChange={change}/></label>
          <label className="master-field"><span>Storage Location</span><input name="storageLocation" value={form.storageLocation} onChange={change}/></label>
          <label className="master-field"><span>Batch Tracking</span><select name="batchTrackingRequired" value={form.batchTrackingRequired} onChange={change}>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="master-field"><span>Drawing Number</span><input name="drawingNumber" value={form.drawingNumber} onChange={change}/></label>
          <label className="master-field"><span>Drawing Revision</span><input name="drawingRevision" value={form.drawingRevision} onChange={change}/></label>
        </div></section>
      {form.inspectionRequired === "Y" && <ItemIncomingInspectionPlan rows={inspectionPlanCharacteristics} onChange={setInspectionPlanCharacteristics} masters={{
        characteristics: lookups.characteristics, instruments: lookups.instruments, toleranceGrades: lookups.toleranceGrades,
        sampleSizes: lookups.sampleSizes, frequencies: lookups.frequencies,
      }}/>}
      {selectedGroup?.groupCode === "CA" && <section className="master-form-section"><div className="master-section-header"><div><h2>Capital Item Details</h2><p>Asset identification, warranty and installation controls.</p></div></div><div className="master-form-grid">
        <label className="master-field"><span>Make</span><input name="makeName" value={form.makeName} onChange={change}/></label>
        <label className="master-field"><span>Model</span><input name="modelName" value={form.modelName} onChange={change}/></label>
        {isMachineItem && <><label className="master-field"><span>Machine Type<b>*</b></span><select name="machineTypeId" value={form.machineTypeId} onChange={change}><option value="">Select machine type</option>{lookups.machineTypes.map((machineType) => <option key={machineType.machineTypeId} value={machineType.machineTypeId}>{machineType.machineTypeCode} - {machineType.machineTypeName}</option>)}</select></label>
        <label className="master-field span-2"><span>Machine Capacity<b>*</b></span><input name="machineCapacity" value={form.machineCapacity} onChange={change} placeholder="Example: X-820 mm / Y-510 mm / Z-510 mm"/></label></>}
        {!isMachineItem && <label className="master-field"><span>Serial Number</span><input name="serialNumber" value={form.serialNumber} onChange={change}/></label>}
        {isMachineItem && <label className="master-field"><span>Asset Category</span><select name="assetCategory" value={form.assetCategory} onChange={change}><option value="">Select category</option>{referenceOptions("ASSET_CATEGORY").map((o) => <option key={o.referenceCode} value={o.referenceCode}>{o.referenceLabel}</option>)}</select></label>}
        <label className="master-field"><span>Warranty Applicable</span><select name="warrantyApplicable" value={form.warrantyApplicable} onChange={change}>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        {form.warrantyApplicable === "Y" && <label className="master-field"><span>Warranty Period (Months)</span><input type="number" min="0" name="warrantyPeriodMonths" value={form.warrantyPeriodMonths} onChange={change}/></label>}
        <label className="master-field"><span>Installation Required</span><select name="installationRequired" value={form.installationRequired} onChange={change}>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      </div></section>}
      {selectedGroup?.groupCode === "IG" && <section className="master-form-section"><div className="master-section-header"><div><h2>Calibration &amp; Measurement</h2><p>Instrument and gauge calibration controls.</p></div></div><div className="master-form-grid">
        <label className="master-field"><span>Make</span><input name="makeName" value={form.makeName} onChange={change}/></label>
        <label className="master-field"><span>Model</span><input name="modelName" value={form.modelName} onChange={change}/></label>
        <label className="master-field"><span>Calibration Required</span><select name="calibrationRequired" value={form.calibrationRequired} onChange={change}>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        {form.calibrationRequired === "Y" && <><label className="master-field"><span>Calibration Frequency</span><select name="calibrationFrequency" value={form.calibrationFrequency} onChange={change}><option value="">Select frequency</option>{referenceOptions("CALIBRATION_FREQUENCY").map((o) => <option key={o.referenceCode} value={o.referenceCode}>{o.referenceLabel}</option>)}</select></label><label className="master-field"><span>Calibration Agency</span><select name="calibrationAgencyId" value={form.calibrationAgencyId} onChange={change}><option value="">Select supplier / agency</option>{lookups.suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.supplierCode} - {s.supplierName}</option>)}</select></label></>}
        <label className="master-field"><span>Measurement Range</span><input name="measurementRange" value={form.measurementRange} onChange={change}/></label>
        <label className="master-field"><span>Least Count</span><input name="leastCount" value={form.leastCount} onChange={change}/></label>
        <label className="master-field"><span>Accuracy</span><input name="accuracy" value={form.accuracy} onChange={change}/></label>
      </div></section>}
      {!isCustomerSupplied && <section className="master-form-section"><div className="master-section-header between"><div><h2>Suppliers</h2><p>Link multiple Supplier/Both parties and identify one preferred supplier.</p></div><button type="button" className="marketing-add-line-button" onClick={() => setSuppliers((rows) => [...rows, blankSupplier()])}><Plus size={16}/>Add Supplier</button></div>
        <div className="item-supplier-list">{suppliers.map((supplier, index) => <div className="item-commercial-row" key={index}><span className="attachment-index">{index + 1}</span><div className="item-commercial-fields">
          <label><span>Supplier</span><select value={supplier.supplierId} onChange={(e) => updateSupplier(index,"supplierId",e.target.value)}><option value="">Select supplier</option>{lookups.suppliers.map((s) => <option key={s.supplierId} value={s.supplierId}>{s.supplierCode} - {s.supplierName}</option>)}</select></label>
          <label><span>Supplier Item Code</span><input value={supplier.supplierItemCode} onChange={(e) => updateSupplier(index,"supplierItemCode",e.target.value)}/></label>
          <label><span>Purchase Rate</span><input type="number" min="0" step="0.01" value={supplier.purchaseRate} onChange={(e) => updateSupplier(index,"purchaseRate",e.target.value)}/></label>
          <label><span>Currency</span><select value={supplier.currencyCode} onChange={(e) => updateSupplier(index,"currencyCode",e.target.value)}>{referenceOptions("CURRENCY").map((o) => <option key={o.referenceCode} value={o.referenceCode}>{o.referenceLabel}</option>)}</select></label>
          <label><span>MOQ</span><input type="number" min="0" step="0.001" value={supplier.moq} onChange={(e) => updateSupplier(index,"moq",e.target.value)}/></label>
          <label><span>Lead Days</span><input type="number" min="0" step="1" value={supplier.leadTimeDays} onChange={(e) => updateSupplier(index,"leadTimeDays",e.target.value)}/></label>
          <label><span>Effective From</span><DateInput type="date" value={supplier.effectiveFrom} onChange={(e) => updateSupplier(index,"effectiveFrom",e.target.value)}/></label>
          <label><span>Effective To</span><DateInput type="date" value={supplier.effectiveTo} onChange={(e) => updateSupplier(index,"effectiveTo",e.target.value)}/></label>
          <label><span>Remarks</span><input value={supplier.remarks} onChange={(e) => updateSupplier(index,"remarks",e.target.value)}/></label>
          <label className="preferred-supplier"><input type="checkbox" checked={supplier.preferredSupplier} onChange={(e) => updateSupplier(index,"preferredSupplier",e.target.checked)}/>Preferred</label>
          </div><button type="button" className="marketing-delete-line-button" disabled={suppliers.length === 1} onClick={() => void removeSupplier(index)}><Trash2 size={16}/></button></div>)}</div>
      </section>}
      <section className="master-form-section"><div className="master-section-header"><div><h2>Remarks</h2><p>Optional Item Master notes.</p></div></div><div className="master-form-grid"><label className="master-field span-4"><span>Remarks</span><textarea name="remarks" maxLength={1000} value={form.remarks} onChange={change}/></label></div></section>
      <section className="master-form-section"><div className="master-section-header between"><div><h2>Attachments</h2><p>Images, documents, drawings and technical files.</p></div><button type="button" className="marketing-add-line-button" onClick={() => setAttachments((rows) => [...rows, blankAttachment()])}><Plus size={16}/>Add Attachment</button></div>
        {!!existingAttachments.length && <div className="existing-item-attachments">{existingAttachments.map((a) => <div key={a.itemAttachmentId}><a href={a.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/>{a.fileName}</a><span>{a.documentDescription || a.documentType}</span><button type="button" onClick={() => void deleteExistingAttachment(a)}><Trash2 size={15}/></button></div>)}</div>}
        <div className="master-attachment-list">{attachments.map((attachment,index) => <div className="master-attachment-row" key={index}><span className="attachment-index">{index + 1}</span><select value={attachment.documentType} onChange={(e) => updateAttachment(index,"documentType",e.target.value)}>{referenceData.options("DOCUMENT_TYPE").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><input value={attachment.documentDescription} onChange={(e) => updateAttachment(index,"documentDescription",e.target.value)} placeholder="Description"/><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf,.step,.stp" onChange={(e) => updateAttachment(index,"file",e.target.files?.[0] ?? null)}/><button type="button" className="marketing-delete-line-button" disabled={attachments.length === 1} onClick={() => removeAttachmentRow(index)}><Trash2 size={16}/></button></div>)}</div>
      </section>
    </form>
  </div>;
}
