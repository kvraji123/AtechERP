import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { withTransaction } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./item.repository.js";

const clean = (value) => value === null || value === undefined ? null : String(value).trim() || null;
const optionalNumber = (value, label, decimals = true) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!decimals && !Number.isInteger(number))) {
    throw new AppError(`${label} must be a non-negative ${decimals ? "number" : "whole number"}.`);
  }
  return number;
};
const jsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed=JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const humanize = (value) => String(value || "").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const withItemGroupPrefix = (groupCode, description) => {
  const normalizedDescription = String(description || "").trim().replace(/\s+/g, " ");
  const normalizedGroupCode = String(groupCode || "").trim().toUpperCase();
  if (!normalizedDescription || !normalizedGroupCode) return normalizedDescription;
  const prefix = `${normalizedGroupCode}-`;
  if (normalizedDescription.toUpperCase() === prefix) return "";
  const descriptionWithoutPrefix = normalizedDescription.replace(new RegExp(`^${prefix}\\s*`, "i"), "").trim();
  return descriptionWithoutPrefix ? `${prefix}${descriptionWithoutPrefix}` : "";
};

function normalizeItemCategory(data) {
  const itemGroupId = Number(data.itemGroupId);
  const typeName = String(data.typeName || "").trim().replace(/\s+/g, " ");
  const itemCodePrefix = String(data.itemCodePrefix || "").trim().toUpperCase();
  if (!itemGroupId) throw new AppError("Item Group is required.");
  if (!typeName) throw new AppError("Item Category name is required.");
  if (typeName.length > 120) throw new AppError("Item Category name cannot exceed 120 characters.");
  if (!/^[A-Z0-9]{2,10}$/.test(itemCodePrefix)) {
    throw new AppError("Item Category Code must contain 2 to 10 letters or numbers.");
  }
  return { itemGroupId, typeName, itemCodePrefix };
}

function isRetiredPurchasedCategory(groupCode, typeName) {
  return String(groupCode || "").toUpperCase() === "PU"
    && ["PURCHASED ITEM", "PURCHASED ITEMS"].includes(
      String(typeName || "").trim().toUpperCase()
    );
}

function normalizeSuppliers(input) {
  const suppliers = Array.isArray(input) ? input.map((row) => ({
    supplierId: Number(row.supplierId),
    supplierItemCode: clean(row.supplierItemCode),
    purchaseRate: optionalNumber(row.purchaseRate, "Supplier purchase rate"),
    currencyCode: clean(row.currencyCode) || "INR",
    moq: optionalNumber(row.moq, "Supplier MOQ"),
    leadTimeDays: optionalNumber(row.leadTimeDays, "Lead time", false),
    effectiveFrom: clean(row.effectiveFrom), effectiveTo: clean(row.effectiveTo),
    preferredSupplier: row.preferredSupplier === true || row.preferredSupplier === "Y" ? "Y" : "N",
    remarks: clean(row.remarks),
  })) : [];
  const ids = suppliers.map((row) => row.supplierId);
  if (ids.some((id) => !id)) throw new AppError("Select a valid supplier.");
  if (new Set(ids).size !== ids.length) throw new AppError("Duplicate suppliers are not allowed.");
  if (suppliers.filter((row) => row.preferredSupplier === "Y").length > 1) {
    throw new AppError("Only one preferred supplier is allowed.");
  }
  if (suppliers.some((row) => row.effectiveFrom && row.effectiveTo && row.effectiveTo < row.effectiveFrom)) {
    throw new AppError("Supplier Effective To date cannot be before Effective From date.");
  }
  return suppliers;
}

function normalizeInspectionPlanCharacteristics(input) {
  return Array.isArray(input) ? input.map((row, index) => {
    const characteristicMasterId = Number(row.characteristicMasterId) || null;
    return {
      sequenceNumber: index + 1,
      balloonNumber: clean(row.balloonNumber),
      characteristicMasterId,
      characteristicText: characteristicMasterId
        ? null
        : clean(row.characteristicText ?? row.characteristicSearch),
      specifiedDimension: optionalNumber(row.specifiedDimension, `Specified Dimension in inspection row ${index + 1}`),
      toleranceGradeId: Number(row.toleranceGradeId) || null,
      toleranceGradeText: clean(row.toleranceGradeText),
      toleranceMinus: optionalNumber(row.toleranceMinus, `Tol− in inspection row ${index + 1}`),
      tolerancePlus: optionalNumber(row.tolerancePlus, `Tol+ in inspection row ${index + 1}`),
      drawingGrid: clean(row.drawingGrid),
      instrumentMasterId: Number(row.instrumentMasterId) || null,
      sampleSize: clean(row.sampleSize),
      inspectionFrequency: clean(row.inspectionFrequency),
    };
  }) : [];
}

function normalizeItem(data) {
  const item = {
    itemGroupId: Number(data.itemGroupId), itemTypeId: Number(data.itemTypeId),
    customerId: data.customerId ? Number(data.customerId) : null,
    itemDescription: clean(data.itemDescription), itemSpecification: clean(data.itemSpecification),
    itemStatus: clean(data.itemStatus)?.toUpperCase() || "ACTIVE",
    additionalDescription: clean(data.additionalDescription),
    uomId: Number(data.uomId),
    materialGradeId: data.materialGradeId ? Number(data.materialGradeId) : null,
    materialId: null,
    inspectionRequired: data.inspectionRequired === "Y" ? "Y" : "N",
    inspectionPlanCharacteristics: normalizeInspectionPlanCharacteristics(data.inspectionPlanCharacteristics),
    hsnCode: clean(data.hsnCode), purchaseRate: optionalNumber(data.purchaseRate, "Purchase rate"),
    minimumStock: optionalNumber(data.minimumStock, "Minimum stock"),
    makeName: clean(data.makeName), modelName: clean(data.modelName),
    machineTypeId: data.machineTypeId ? Number(data.machineTypeId) : null,
    machineCapacity: clean(data.machineCapacity),
    leadTimeDays: optionalNumber(data.leadTimeDays, "Lead time", false),
    reorderLevel: optionalNumber(data.reorderLevel, "Reorder level"),
    maximumStock: optionalNumber(data.maximumStock, "Maximum stock"),
    storageLocation: clean(data.storageLocation), shelfLifeApplicable: data.shelfLifeApplicable === "Y" ? "Y" : "N",
    shelfLifeDays: optionalNumber(data.shelfLifeDays, "Shelf Life Days", false),
    batchTrackingRequired: data.batchTrackingRequired === "Y" ? "Y" : "N",
    serialTrackingRequired: data.serialTrackingRequired === "Y" ? "Y" : "N",
    drawingNumber: clean(data.drawingNumber), drawingRevision: clean(data.drawingRevision),
    serialNumber: clean(data.serialNumber), assetCategory: clean(data.assetCategory),
    warrantyApplicable: data.warrantyApplicable === "Y" ? "Y" : "N",
    warrantyPeriodMonths: optionalNumber(data.warrantyPeriodMonths, "Warranty period", false),
    installationRequired: data.installationRequired === "Y" ? "Y" : "N",
    calibrationRequired: data.calibrationRequired === "Y" ? "Y" : "N",
    calibrationFrequency: clean(data.calibrationFrequency), measurementRange: clean(data.measurementRange),
    leastCount: clean(data.leastCount), accuracy: clean(data.accuracy),
    calibrationAgencyId: data.calibrationAgencyId ? Number(data.calibrationAgencyId) : null,
    remarks: clean(data.remarks),
    specifications: Array.isArray(data.specifications) ? data.specifications.map((row) => ({
      specFieldId: Number(row.specFieldId), fieldCode: clean(row.fieldCode),
      value: row.value === null || row.value === undefined ? "" : String(row.value).trim(),
      uomId: row.uomId ? Number(row.uomId) : null,
    })) : [],
    suppliers: normalizeSuppliers(data.suppliers),
  };
  if (!item.itemGroupId) throw new AppError("Item Group is required.");
  if (!item.itemTypeId) throw new AppError("Item Category is required.");
  if (!item.itemDescription && !item.specifications.length) throw new AppError("Item Description is required.");
  if (item.itemDescription && item.itemDescription.length > 250) throw new AppError("Item Description cannot exceed 250 characters.");
  if (!["ACTIVE", "INACTIVE", "OBSOLETE"].includes(item.itemStatus)) {
    throw new AppError("Item Status must be Active, Inactive or Obsolete.");
  }
  if (!item.uomId) throw new AppError("UOM is required.");
  if (data.materialGradeId && !item.materialGradeId) {
    throw new AppError("Select a valid Material & Grade.");
  }
  if (item.hsnCode && !/^\d+$/.test(item.hsnCode)) throw new AppError("HSN Code must contain digits only.");
  if (item.maximumStock !== null && item.reorderLevel !== null && item.maximumStock < item.reorderLevel) {
    throw new AppError("Maximum stock cannot be less than reorder level.");
  }
  return item;
}

async function validateInspectionPlanCharacteristics(connection, item) {
  if (item.inspectionRequired !== "Y") {
    item.inspectionPlanCharacteristics = [];
    return;
  }
  if (!item.inspectionPlanCharacteristics.length) {
    throw new AppError("Add at least one Incoming Inspection Plan characteristic when Inspection Required is Yes.");
  }
  const masters = await repository.getInspectionMasters(connection);
  const characteristicIds = new Set(masters.characteristics.map((entry) => Number(entry.characteristicMasterId)));
  const instrumentIds = new Set(masters.instruments.map((entry) => Number(entry.instrumentMasterId)));
  const sampleSizes = new Set(masters.sampleSizes.map((entry) => entry.value));
  const frequencies = new Set(masters.frequencies.map((entry) => entry.value));

  item.inspectionPlanCharacteristics = item.inspectionPlanCharacteristics.map((row, index) => {
    if (row.characteristicMasterId && !characteristicIds.has(row.characteristicMasterId)) {
      throw new AppError(`Select a valid Characteristic in incoming inspection row ${index + 1}.`);
    }
    if (!row.characteristicMasterId && !row.characteristicText) {
      throw new AppError(`Enter or select a Characteristic in incoming inspection row ${index + 1}.`);
    }
    if (row.characteristicText && row.characteristicText.length > 150) {
      throw new AppError(`Characteristic text cannot exceed 150 characters in incoming inspection row ${index + 1}.`);
    }
    if (row.instrumentMasterId && !instrumentIds.has(row.instrumentMasterId)) {
      throw new AppError(`Select a valid Inspection Instrument in incoming inspection row ${index + 1}.`);
    }
    if (row.sampleSize && !sampleSizes.has(row.sampleSize)) {
      throw new AppError(`Select a valid Sample Size in incoming inspection row ${index + 1}.`);
    }
    if (row.inspectionFrequency && !frequencies.has(row.inspectionFrequency)) {
      throw new AppError(`Select a valid Inspection Frequency in incoming inspection row ${index + 1}.`);
    }
    const gradeText = String(row.toleranceGradeText || "").trim().toUpperCase();
    const matchedGrade = row.specifiedDimension === null || !gradeText ? null : masters.toleranceGrades.find((grade) =>
      String(grade.gradeCode).trim().toUpperCase() === gradeText
      && (Number(grade.basicSizeFrom) === 0 ? row.specifiedDimension >= 0 : row.specifiedDimension > Number(grade.basicSizeFrom))
      && row.specifiedDimension <= Number(grade.basicSizeTo));
    if (matchedGrade) {
      const toleranceMinus = Math.abs(Number(matchedGrade.lowerDeviationMicrons || 0)) / 1000;
      const tolerancePlus = Number(matchedGrade.upperDeviationMicrons || 0) / 1000;
      return { ...row, toleranceMode: "GRADE", toleranceGradeId: Number(matchedGrade.toleranceGradeId),
        toleranceGradeText: String(matchedGrade.gradeCode), toleranceMinus, tolerancePlus,
        lsl: Number((row.specifiedDimension + Number(matchedGrade.lowerDeviationMicrons || 0) / 1000).toFixed(4)),
        usl: Number((row.specifiedDimension + tolerancePlus).toFixed(4)) };
    }
    return { ...row, toleranceMode: "MANUAL", toleranceGradeId: null,
      lsl: row.specifiedDimension !== null && row.toleranceMinus !== null
        ? Number((row.specifiedDimension - row.toleranceMinus).toFixed(4)) : null,
      usl: row.specifiedDimension !== null && row.tolerancePlus !== null
        ? Number((row.specifiedDimension + row.tolerancePlus).toFixed(4)) : null };
  });
}

async function applyConfiguredSpecifications(connection, item, references) {
  const config=await repository.getSpecificationConfig(connection,item.itemTypeId);
  if (references.group_code === "PC" && !config.fields.some((field) => field.fieldCode === "size")) {
    throw new AppError("Size is not configured for this Packing Material category.");
  }
  if (!config.fields.length) {
    if (references.group_code === "PU") {
      throw new AppError("Description fields are not configured for this Purchased Item category.");
    }
    return;
  }
  if (references.group_code === "RM" && !item.materialGradeId) {
    throw new AppError("Material & Grade is required for Raw Material.");
  }
  const submitted=new Map(item.specifications.map((row) => [row.fieldCode,row]));
  const uomIds=[...new Set(item.specifications.map((row) => row.uomId).filter(Boolean))];
  const uoms=await repository.getUomsByIds(connection,uomIds);
  const uomById=new Map(uoms.map((row) => [Number(row.uomId),row.uomCode]));
  const normalized=[];
  const values={};
  const visibleFields=config.fields.filter((field) => {
    if (!field.visibleWhenField) return true;
    return String(submitted.get(field.visibleWhenField)?.value || "").toUpperCase() === String(field.visibleWhenValue || "").toUpperCase();
  });
  for (const field of visibleFields) {
    const row=submitted.get(field.fieldCode);
    const value=String(row?.value || "").trim();
    if (field.requiredFlag === "Y" && !value) throw new AppError(`${field.fieldLabel} is required.`);
    if (!value) continue;
    const options=jsonArray(field.optionValues).map(String);
    if (field.fieldCode === "drawing_codes") {
      const drawingCodes=[...new Set(value.split("|").map((code) => code.trim()).filter(Boolean))];
      const activeDrawingCodes=await repository.getActiveDrawingCodes(connection,drawingCodes);
      if (!drawingCodes.length || activeDrawingCodes.length !== drawingCodes.length) {
        throw new AppError("Select valid active Drawing Code(s).");
      }
    } else if (field.inputType === "SELECT" && !options.includes(value)) {
      throw new AppError(`Select a valid ${field.fieldLabel}.`);
    }
    let valueNumber=null;
    if (field.inputType === "NUMBER") {
      valueNumber=Number(value);
      if (!Number.isFinite(valueNumber) || valueNumber <= 0) throw new AppError(`${field.fieldLabel} must be greater than zero.`);
    }
    const allowedUoms=jsonArray(field.allowedUomCodes).map(String);
    const uomCode=row?.uomId ? uomById.get(Number(row.uomId)) : null;
    if (allowedUoms.length && (!uomCode || !allowedUoms.includes(uomCode))) throw new AppError(`Select a valid UOM for ${field.fieldLabel}.`);
    values[field.fieldCode]=value;
    values[`${field.fieldCode}Uom`]=String(uomCode || "").toLowerCase();
    values[`${field.fieldCode}Label`]=humanize(value);
    normalized.push({ specFieldId:Number(field.specFieldId),fieldCode:field.fieldCode,
      valueText:field.inputType === "NUMBER" ? null : value,valueNumber,uomId:row?.uomId || null });
  }
  const groups=[...new Set(visibleFields.map((field) => field.requireOneGroup).filter(Boolean))];
  for (const group of groups) {
    if (!visibleFields.filter((field) => field.requireOneGroup === group).some((field) => values[field.fieldCode])) {
      throw new AppError("Enter at least one alternative size field.");
    }
  }
  item.specifications=normalized;
  if (references.group_code === "PC") {
    if (!values.size) throw new AppError("Size is required for Packing Materials.");
    item.itemDescription = `${references.type_name} - ${values.size}`;
    return;
  }
  if (!["RM", "TL", "PU"].includes(references.group_code)) return;
  const template=config.templates.find((row) => row.conditionOperator === "EQUALS" &&
      String(values[row.conditionFieldCode] || "").toUpperCase() === String(row.conditionValue || "").toUpperCase())
    || config.templates.find((row) => row.conditionOperator === "PRESENT" && values[row.conditionFieldCode])
    || config.templates.find((row) => row.conditionOperator === "DEFAULT");
  if (!template) throw new AppError("Description template is not configured for the selected specification.");
  const context={...values,optionalLength:values.length ? ` × ${values.length} ${values.lengthUom}` : "",materialShort:references.material_short_code || references.material_name || "",
    material:references.material_name || "",grade:references.grade_code === "GENERAL" ? "" : (references.grade_name || references.grade_code || ""),
    gradeOrMaterial:references.grade_code === "GENERAL" ? references.material_name : (references.grade_name || references.grade_code || references.material_name),
    itemType:references.type_name || ""};
  const generatedDescription=template.templateText.replace(/\{([A-Za-z0-9_]+)\}/g,(_match,key) => context[key] ?? "")
    .replace(/\s+/g," ").replace(/\s+([×–])/g," $1").replace(/([Ø])\s+/g,"$1").trim();
  item.itemDescription=["RM", "PU"].includes(references.group_code)
    ? withItemGroupPrefix(references.group_code, generatedDescription)
    : generatedDescription;
  if (!item.itemDescription) throw new AppError("Complete the fields required to generate the Item Description.");
  item.specifications=normalized;
}

export async function listItems(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return repository.listItems({ ...query, limit: pageSize, offset: (page - 1) * pageSize });
}
export const getLookups = () => repository.getLookups();
export async function getItem(itemId) {
  const item = await repository.getItemById(itemId);
  if (!item) throw new AppError("Item not found.", 404);
  return item;
}

async function validateReferences(connection, item, {
  allowLegacyPurchasedCategory = false,
} = {}) {
  const references = await repository.validateReferences(connection, item);
  if (!references) throw new AppError("Select a valid active Item Group, Item Category, UOM and Material & Grade.");
  if (
    isRetiredPurchasedCategory(references.group_code, references.type_name)
    && !allowLegacyPurchasedCategory
  ) {
    throw new AppError("Select a specific Purchased Item category instead of Purchased Items.");
  }
  if (["RM", "CS"].includes(references.group_code)) {
    if (!item.materialGradeId || !references.material_id) {
      throw new AppError("Material & Grade is required.");
    }
    item.materialId = Number(references.material_id);
  } else {
    item.materialId = null;
    item.materialGradeId = null;
    references.material_id = null;
    references.grade_code = null;
    references.grade_name = null;
    references.material_name = null;
    references.material_short_code = null;
  }
  await applyConfiguredSpecifications(connection,item,references);
  if (!item.itemDescription) throw new AppError("Item Description is required.");
  if (item.itemDescription.length > 250) throw new AppError("Item Description cannot exceed 250 characters.");
  if (references.group_code === "CS") {
    if (!item.customerId) throw new AppError("Customer is required for Customer Supplied items.");
    if (!(await repository.validateCustomer(connection, item.customerId))) {
      throw new AppError("Select a valid active customer for this Customer Supplied item.");
    }
    item.suppliers = [];
  } else {
    item.customerId = null;
  }
  const supplierIds = [...new Set([...item.suppliers.map((row) => row.supplierId),
    ...(item.calibrationAgencyId ? [item.calibrationAgencyId] : [])])];
  if (!(await repository.validateSuppliers(connection, supplierIds))) {
    throw new AppError("One or more selected suppliers are inactive or not Supplier/Both parties.");
  }
  if (!["CA", "IG"].includes(references.group_code)) {
    item.makeName = null;
    item.modelName = null;
  }
  if (references.group_code !== "CA") {
    item.machineTypeId = null;
    item.machineCapacity = null;
    item.serialNumber = null;
    item.assetCategory = null;
    item.warrantyApplicable = "N";
    item.warrantyPeriodMonths = null;
    item.installationRequired = "N";
  }
  const isMachineItem = references.group_code === "CA" && references.type_name === "Machines & Equipment";
  if (isMachineItem) {
    if (!item.makeName) throw new AppError("Make is required for Machines & Equipment.");
    if (!item.modelName) throw new AppError("Model is required for Machines & Equipment.");
    if (!item.machineTypeId || !(await repository.validateMachineType(connection, item.machineTypeId))) {
      throw new AppError("Select a valid Machine Type.");
    }
    if (!item.machineCapacity) throw new AppError("Machine Capacity is required for Machines & Equipment.");
    item.assetCategory = "MACHINE";
    item.serialNumber = null;
  } else {
    item.assetCategory = null;
    item.machineTypeId = null;
    item.machineCapacity = null;
  }
  if (references.group_code !== "IG") {
    item.calibrationRequired = "N";
    item.calibrationFrequency = null;
    item.measurementRange = null;
    item.leastCount = null;
    item.accuracy = null;
    item.calibrationAgencyId = null;
  } else if (!item.measurementRange || !item.leastCount || !item.accuracy) {
    throw new AppError("Measurement Range, Least Count and Accuracy are required for Instruments & Gauges.");
  } else if (item.calibrationRequired === "Y" && !item.calibrationFrequency) {
    throw new AppError("Calibration Frequency is required when calibration is applicable.");
  }
  if (references.group_code !== "CM") {
    item.shelfLifeApplicable = "N";
    item.shelfLifeDays = null;
  } else if (item.shelfLifeApplicable === "Y") {
    if (!item.shelfLifeDays || item.shelfLifeDays <= 0) {
      throw new AppError("Shelf Life Days must be a whole number greater than zero when Shelf Life is Yes.");
    }
  } else {
    item.shelfLifeDays = null;
  }
  return references;
}

export async function createItem(data, userCode) {
  const item = normalizeItem(data);
  return withTransaction(async (connection) => {
    await validateReferences(connection, item);
    await validateInspectionPlanCharacteristics(connection, item);
    const itemCode = await repository.nextItemCode(connection, item.itemGroupId, item.itemTypeId);
    if (!itemCode) throw new AppError("Item Group is not available.");
    const itemId = await repository.insertItem(connection, item, itemCode, userCode);
    await repository.replaceSuppliers(connection, itemId, item.suppliers, userCode);
    await repository.replaceCustomerSuppliedItem(connection, itemId, item.customerId, userCode);
    await repository.replaceSpecifications(connection,itemId,item.specifications,userCode);
    await repository.replaceInspectionPlanCharacteristics(connection,itemId,item.inspectionPlanCharacteristics,userCode);
    return repository.getItemById(itemId, connection);
  });
}

export async function createItemCategory(data, userCode) {
  const category = normalizeItemCategory(data);
  return withTransaction(async (connection) => {
    const group = await repository.getActiveItemGroup(connection, category.itemGroupId);
    if (!group) throw new AppError("Select a valid active Item Group.");
    if (isRetiredPurchasedCategory(group.groupCode, category.typeName)) {
      throw new AppError("Purchased Items is retired. Add a specific category such as Fasteners, Plugs or Springs.");
    }
    const duplicate = await repository.findItemCategory(
      connection,
      category.itemGroupId,
      category.typeName,
      category.itemCodePrefix
    );
    if (duplicate) {
      const duplicateField = String(duplicate.typeName).toUpperCase() === category.typeName.toUpperCase()
        ? "name"
        : "code";
      throw new AppError(`An Item Category with this ${duplicateField} already exists in ${group.groupName}.`, 409);
    }
    const itemTypeId = await repository.insertItemCategory(connection, category, userCode);
    return repository.getItemCategory(connection, itemTypeId);
  });
}

export async function updateItem(itemId, data, userCode) {
  const item = normalizeItem(data);
  return withTransaction(async (connection) => {
    const existing = await repository.getItemById(itemId, connection);
    if (!existing) throw new AppError("Item not found.", 404);
    if (Number(existing.item_group_id) !== item.itemGroupId) {
      throw new AppError("Item Group cannot be changed after the Item Code is generated.");
    }
    await validateReferences(connection, item, {
      allowLegacyPurchasedCategory:
        Number(existing.item_type_id) === item.itemTypeId,
    });
    await validateInspectionPlanCharacteristics(connection, item);
    await repository.updateItem(connection, Number(itemId), item, userCode);
    await repository.replaceSuppliers(connection, Number(itemId), item.suppliers, userCode);
    await repository.replaceCustomerSuppliedItem(connection, Number(itemId), item.customerId, userCode);
    await repository.replaceSpecifications(connection,Number(itemId),item.specifications,userCode);
    await repository.replaceInspectionPlanCharacteristics(connection,Number(itemId),item.inspectionPlanCharacteristics,userCode);
    return repository.getItemById(itemId, connection);
  });
}

export async function changeStatus(itemId, data, userCode) {
  await getItem(itemId);
  if (!["ACTIVE", "INACTIVE", "OBSOLETE"].includes(data.itemStatus)) throw new AppError("Invalid item status.");
  await repository.updateStatus(Number(itemId), data.itemStatus, clean(data.deactivationRemarks), userCode);
  return getItem(itemId);
}

export async function addAttachment(itemId, file, data, userCode) {
  await getItem(itemId);
  if (!file) throw new AppError("Select a file to upload.");
  const attachmentId = await repository.insertAttachment(Number(itemId), file, {
    documentType: clean(data.documentType) || "OTHER",
    documentDescription: clean(data.documentDescription),
  }, userCode);
  return (await getItem(itemId)).attachments.find((row) => Number(row.itemAttachmentId) === Number(attachmentId));
}

export async function removeAttachment(itemId, attachmentId) {
  await getItem(itemId);
  const attachment = await repository.getAttachment(attachmentId);
  if (!attachment || Number(attachment.item_id) !== Number(itemId)) throw new AppError("Attachment not found.", 404);
  await repository.deleteAttachment(attachmentId);
  const absolutePath = path.resolve(env.uploadRoot, attachment.file_path);
  await fs.unlink(absolutePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

const BULK_UPLOAD_SHEET = "Item Master";
const BULK_UPLOAD_INSPECTION_SHEET = "Incoming Inspection Plan";
const MAX_BULK_UPLOAD_ROWS = 500;

const normalizeLookupText = (value) => String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const readableCell = (value) => value === null || value === undefined ? "" : String(value).trim();
const identityKey = (item) => [item.itemGroupId, item.itemTypeId, item.materialGradeId || "", normalizeLookupText(item.itemDescription)].join("|");

function readWorksheetRows(workbook, sheetLabel, requiredHeaders) {
  const sheetName = workbook.SheetNames.find((name) => normalizeLookupText(name) === normalizeLookupText(sheetLabel));
  if (!sheetName) throw new AppError(`The workbook must include an "${sheetLabel}" sheet.`);
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: true });
  const headerIndex = matrix.findIndex((row) => {
    const values = new Set((Array.isArray(row) ? row : []).map(normalizeLookupText));
    return requiredHeaders.every((header) => values.has(normalizeLookupText(header)));
  });
  if (headerIndex < 0) {
    throw new AppError(`The "${sheetLabel}" sheet does not contain the required ${requiredHeaders.join(", ")} headers.`);
  }
  const headers = matrix[headerIndex].map((value) => readableCell(value));
  const rows = [];
  for (let index = headerIndex + 1; index < matrix.length; index += 1) {
    const values = matrix[index] || [];
    if (!values.some((value) => readableCell(value))) continue;
    const cells = new Map();
    headers.forEach((header, columnIndex) => {
      const key = normalizeLookupText(header);
      const value = readableCell(values[columnIndex]);
      if (key && (value || !cells.has(key))) cells.set(key, value);
    });
    rows.push({ excelRow: index + 1, sheetLabel, cells });
  }
  return rows;
}

function readExcelRows(file) {
  if (!file?.buffer?.length) throw new AppError("Select a completed Item Master .xlsx file.");
  let workbook;
  try {
    workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false, raw: false });
  } catch {
    throw new AppError("The uploaded file is not a valid Excel workbook.");
  }
  const itemRows = readWorksheetRows(workbook, BULK_UPLOAD_SHEET,
    ["Upload Reference *", "Item Group *", "Item Category *", "UOM *"]);
  const inspectionRows = readWorksheetRows(workbook, BULK_UPLOAD_INSPECTION_SHEET,
    ["Upload Reference *", "Characteristic *"]);
  if (!itemRows.length) throw new AppError("Add at least one item row before uploading the workbook.");
  if (itemRows.length > MAX_BULK_UPLOAD_ROWS) {
    throw new AppError(`A maximum of ${MAX_BULK_UPLOAD_ROWS} item rows can be uploaded at one time.`);
  }
  return { itemRows, inspectionRows };
}

function readCell(row, aliases) {
  for (const alias of aliases) {
    const value = row.cells.get(normalizeLookupText(alias));
    if (value) return value;
  }
  return "";
}

function labelMatches(value, ...candidates) {
  const target = normalizeLookupText(value);
  return Boolean(target) && candidates.filter(Boolean).some((candidate) => {
    const normalized = normalizeLookupText(candidate);
    return target === normalized || target === `${normalizeLookupText(candidates[0])}${normalized}`;
  });
}

function findLookup(value, rows, candidateValues, label) {
  const input = readableCell(value);
  if (!input) return null;
  const resolved = rows.find((row) => candidateValues(row).some((candidate) => labelMatches(input, candidate)));
  if (!resolved) throw new AppError(`Select a valid ${label}.`);
  return resolved;
}

function mapYesNo(value, label, defaultValue = "N") {
  const normalized = normalizeLookupText(value);
  if (!normalized) return defaultValue;
  if (["Y", "YES"].includes(normalized)) return "Y";
  if (["N", "NO"].includes(normalized)) return "N";
  throw new AppError(`${label} must be Yes or No.`);
}

function uploadReference(row) {
  const value = clean(readCell(row, ["Upload Reference *", "Upload Reference"]));
  if (!value) throw new AppError("Upload Reference is required to link this item to its inspection-plan rows.");
  if (value.length > 80) throw new AppError("Upload Reference cannot exceed 80 characters.");
  return value;
}

function mapStatus(value) {
  const normalized = normalizeLookupText(value);
  if (!normalized || normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "INACTIVE") return "INACTIVE";
  if (normalized === "OBSOLETE") return "OBSOLETE";
  throw new AppError("Item Status must be Active, Inactive or Obsolete.");
}

function referenceCode(value, references, referenceGroup, label) {
  const input = readableCell(value);
  if (!input) return null;
  const reference = findLookup(input, references.filter((row) => row.referenceGroup === referenceGroup),
    (row) => [row.referenceCode, row.referenceLabel, `${row.referenceCode} ${row.referenceLabel}`], label);
  return reference.referenceCode;
}

function optionValue(value, field) {
  const input = readableCell(value);
  if (!input || field.inputType !== "SELECT") return input;
  const options = jsonArray(field.optionValues).map(String);
  const selected = options.find((option) => labelMatches(input, option, humanize(option)));
  if (!selected) throw new AppError(`${field.fieldLabel} contains an invalid value.`);
  return selected;
}

function specColumnAliases(field, suffix = "") {
  const suffixText = suffix ? ` ${suffix}` : "";
  const aliases = [`${field.fieldLabel}${suffixText}`, `${humanize(field.fieldCode)}${suffixText}`];
  if (["rod_type", "item_subtype"].includes(field.fieldCode) && !suffix) aliases.unshift("Item Type / Variant");
  if (field.fieldCode === "make" && !suffix) aliases.unshift("Make / Brand", "Make");
  if (field.fieldCode === "specification" && !suffix) aliases.unshift("Item Specification");
  return aliases;
}

function validateApplicableSpecificationColumns(row, itemTypeId, lookups) {
  const fields = lookups.specFields.filter((field) => Number(field.itemTypeId) === Number(itemTypeId));
  const applicableHeaders = new Set(fields.flatMap((field) => [
    ...specColumnAliases(field), ...specColumnAliases(field, "UOM"),
  ]).map(normalizeLookupText));
  const checkedHeaders = new Set();
  for (const field of lookups.specFields) {
    if (Number(field.itemTypeId) === Number(itemTypeId) || ["make", "specification", "rod_type", "item_subtype"].includes(field.fieldCode)) continue;
    for (const alias of [...specColumnAliases(field), ...specColumnAliases(field, "UOM")]) {
      const header = normalizeLookupText(alias);
      if (checkedHeaders.has(header) || applicableHeaders.has(header)) continue;
      checkedHeaders.add(header);
      if (row.cells.get(header)) {
        throw new AppError(`${field.fieldLabel} is not applicable to the selected Item Category. Leave this column blank.`);
      }
    }
  }
}

function mapSpecifications(row, itemTypeId, lookups) {
  const fields = lookups.specFields.filter((field) => Number(field.itemTypeId) === Number(itemTypeId));
  const variant = readCell(row, ["Item Type / Variant"]);
  if (variant && !fields.some((field) => ["rod_type", "item_subtype"].includes(field.fieldCode))) {
    throw new AppError("Item Type / Variant is not configured for the selected Item Category.");
  }
  validateApplicableSpecificationColumns(row, itemTypeId, lookups);
  return fields.map((field) => {
    const value = optionValue(readCell(row, specColumnAliases(field)), field);
    const uomValue = readCell(row, specColumnAliases(field, "UOM"));
    const uom = uomValue ? findLookup(uomValue, lookups.uoms,
      (entry) => [entry.uomCode, entry.uomName, `${entry.uomCode} ${entry.uomName}`], `${field.fieldLabel} UOM`) : null;
    return { specFieldId: Number(field.specFieldId), fieldCode: field.fieldCode, value, uomId: uom ? Number(uom.uomId) : null };
  });
}

function requireBlankWhenNotApplicable(row, aliases, label) {
  if (readCell(row, aliases)) throw new AppError(`${label} is not applicable to the selected Item Group or Item Category. Leave this field blank.`);
}

function validateApplicableMainColumns(row, group, category) {
  if (group.groupCode !== "RM") {
    requireBlankWhenNotApplicable(row, ["Material & Grade (Raw Material only)", "Material & Grade"], "Material & Grade");
  }
  if (group.groupCode !== "CM") {
    requireBlankWhenNotApplicable(row, ["Shelf Life Applicable?", "Shelf Life", "Shelf Life Days"], "Shelf Life");
  }
  if (group.groupCode !== "CA") {
    requireBlankWhenNotApplicable(row, ["Make / Brand", "Make", "Model", "Machine Type", "Machine Capacity", "Asset Category",
      "Warranty Applicable?", "Warranty Period (Months)", "Installation Required?"], "Capital Item detail");
  } else if (category.typeName !== "Machines & Equipment") {
    requireBlankWhenNotApplicable(row, ["Machine Type", "Machine Capacity", "Asset Category"], "Machine detail");
  }
  if (group.groupCode !== "IG") {
    requireBlankWhenNotApplicable(row, ["Calibration Required?", "Calibration Frequency", "Measurement Range", "Least Count", "Accuracy",
      "Calibration Agency / Lab", "Calibration Agency"], "Calibration detail");
  }
}

function mapInspectionPlanRows(rows, itemReferenceKeys, lookups, errors) {
  const plansByReference = new Map();
  for (const row of rows) {
    try {
      const reference = uploadReference(row);
      const referenceKey = normalizeLookupText(reference);
      if (!itemReferenceKeys.has(referenceKey)) {
        throw new AppError("Upload Reference does not match a unique Item Master row.");
      }
      const characteristicValue = readCell(row, ["Characteristic *", "Characteristic"]);
      if (!characteristicValue) throw new AppError("Inspection Characteristic is required.");
      const characteristic = lookups.characteristics.find((entry) =>
        [entry.characteristicCode, entry.characteristicName, `${entry.characteristicCode} ${entry.characteristicName}`]
          .some((candidate) => labelMatches(characteristicValue, candidate)));
      const instrumentValue = readCell(row, ["Instrument / Gauge", "Instrument", "Gauge"]);
      const instrument = instrumentValue ? findLookup(instrumentValue, lookups.instruments,
        (entry) => [entry.instrumentCode, entry.instrumentName, `${entry.instrumentCode} ${entry.instrumentName}`], "Inspection Instrument / Gauge") : null;
      const planRow = {
        balloonNumber: readCell(row, ["Balloon Number", "Balloon No.", "Balloon No"]),
        characteristicMasterId: characteristic ? Number(characteristic.characteristicMasterId) : null,
        characteristicText: characteristic ? null : characteristicValue,
        specifiedDimension: readCell(row, ["Specified Dimension"]),
        toleranceGradeText: readCell(row, ["Tolerance Grade"]),
        toleranceMinus: readCell(row, ["Tolerance −", "Tolerance -", "Tol−", "Tol-"]),
        tolerancePlus: readCell(row, ["Tolerance +", "Tol+"]),
        drawingGrid: readCell(row, ["Drawing Grid"]),
        instrumentMasterId: instrument ? Number(instrument.instrumentMasterId) : null,
        sampleSize: readCell(row, ["Sample Size"]),
        inspectionFrequency: readCell(row, ["Inspection Frequency", "Frequency"]),
      };
      plansByReference.set(referenceKey, [...(plansByReference.get(referenceKey) || []), planRow]);
    } catch (error) {
      errors.push({ sheet: row.sheetLabel, row: row.excelRow, message: error.message || "Invalid inspection-plan row." });
    }
  }
  return plansByReference;
}

function collectItemUploadReferences(rows, errors) {
  const rowsByReference = new Map();
  const invalidRows = new Set();
  for (const row of rows) {
    try {
      const referenceKey = normalizeLookupText(uploadReference(row));
      rowsByReference.set(referenceKey, [...(rowsByReference.get(referenceKey) || []), row]);
    } catch (error) {
      invalidRows.add(row.excelRow);
      errors.push({ sheet: row.sheetLabel, row: row.excelRow, message: error.message || "Invalid Upload Reference." });
    }
  }
  const uniqueReferences = new Set();
  for (const [referenceKey, matchingRows] of rowsByReference.entries()) {
    if (matchingRows.length === 1) {
      uniqueReferences.add(referenceKey);
      continue;
    }
    for (const row of matchingRows) {
      invalidRows.add(row.excelRow);
      errors.push({ sheet: row.sheetLabel, row: row.excelRow,
        message: "Upload Reference must be unique for every Item Master row." });
    }
  }
  return { uniqueReferences, invalidRows };
}

function mapBulkRow(row, lookups) {
  const itemUploadReference = uploadReference(row);
  const groupValue = readCell(row, ["Item Group *", "Item Group"]);
  const group = findLookup(groupValue, lookups.groups,
    (entry) => [entry.groupCode, entry.groupName, `${entry.groupCode} ${entry.groupName}`], "Item Group");
  const categoryValue = readCell(row, ["Item Category *", "Item Category"]);
  const category = findLookup(categoryValue, lookups.types.filter((entry) => Number(entry.itemGroupId) === Number(group.itemGroupId)),
    (entry) => [entry.typeName, entry.itemCodePrefix, `${entry.itemCodePrefix} ${entry.typeName}`], "Item Category");
  if (isRetiredPurchasedCategory(group.groupCode, category.typeName)) {
    throw new AppError("Select a specific Purchased Item category instead of Purchased Items.");
  }
  validateApplicableMainColumns(row, group, category);
  const uom = findLookup(readCell(row, ["UOM *", "UOM"]), lookups.uoms,
    (entry) => [entry.uomCode, entry.uomName, `${entry.uomCode} ${entry.uomName}`], "UOM");
  const materialValue = readCell(row, ["Material & Grade (Raw Material only)", "Material & Grade"]);
  const materialGrade = materialValue ? findLookup(materialValue, lookups.materialGrades,
    (entry) => [entry.materialAndGrade, entry.gradeCode, entry.gradeName, `${entry.gradeCode} ${entry.materialName}`], "Material & Grade") : null;
  const machineTypeValue = readCell(row, ["Machine Type"]);
  const machineType = machineTypeValue ? findLookup(machineTypeValue, lookups.machineTypes,
    (entry) => [entry.machineTypeCode, entry.machineTypeName, `${entry.machineTypeCode} ${entry.machineTypeName}`], "Machine Type") : null;
  const agencyValue = readCell(row, ["Calibration Agency / Lab", "Calibration Agency"]);
  const calibrationAgency = agencyValue ? findLookup(agencyValue, lookups.suppliers,
    (entry) => [entry.supplierCode, entry.supplierName, `${entry.supplierCode} ${entry.supplierName}`], "Calibration Agency") : null;
  const enteredCode = readCell(row, ["Item Code"]);
  if (enteredCode) throw new AppError("Item Code is generated by the system during upload. Do not enter an Item Code in Excel.");
  return {
    itemUploadReference,
    itemGroupId: Number(group.itemGroupId),
    itemTypeId: Number(category.itemTypeId),
    itemDescription: readCell(row, ["Item Description / Name *", "Item Description"]),
    itemSpecification: readCell(row, ["Item Specification"]),
    additionalDescription: readCell(row, ["Additional Description"]),
    uomId: Number(uom.uomId), materialGradeId: materialGrade ? Number(materialGrade.materialGradeId) : null,
    itemStatus: mapStatus(readCell(row, ["Item Status (blank = Active)", "Item Status"])),
    inspectionRequired: mapYesNo(readCell(row, ["Inspection Required?", "Inspection Required"]), "Inspection Required"),
    hsnCode: readCell(row, ["HSN Code"]),
    purchaseRate: readCell(row, ["Default Purchase Rate (INR)", "Default Purchase Rate"]),
    minimumStock: readCell(row, ["Minimum Stock"]),
    leadTimeDays: readCell(row, ["Lead Time (Days)", "Lead Time"]),
    reorderLevel: readCell(row, ["Reorder Level"]), maximumStock: readCell(row, ["Maximum Stock"]),
    storageLocation: readCell(row, ["Storage Location"]),
    shelfLifeApplicable: mapYesNo(readCell(row, ["Shelf Life Applicable?", "Shelf Life"]), "Shelf Life Applicable"),
    shelfLifeDays: readCell(row, ["Shelf Life Days"]),
    batchTrackingRequired: mapYesNo(readCell(row, ["Batch Tracking Required?", "Batch Tracking"]), "Batch Tracking Required"),
    serialTrackingRequired: mapYesNo(readCell(row, ["Serial Tracking Required?", "Serial Tracking"]), "Serial Tracking Required"),
    drawingNumber: readCell(row, ["Drawing Number"]), drawingRevision: readCell(row, ["Drawing Revision"]),
    makeName: readCell(row, ["Make / Brand", "Make"]), modelName: readCell(row, ["Model"]),
    machineTypeId: machineType ? Number(machineType.machineTypeId) : null,
    machineCapacity: readCell(row, ["Machine Capacity"]),
    assetCategory: referenceCode(readCell(row, ["Asset Category"]), lookups.references, "ASSET_CATEGORY", "Asset Category"),
    warrantyApplicable: mapYesNo(readCell(row, ["Warranty Applicable?"]), "Warranty Applicable"),
    warrantyPeriodMonths: readCell(row, ["Warranty Period (Months)"]),
    installationRequired: mapYesNo(readCell(row, ["Installation Required?"]), "Installation Required"),
    calibrationRequired: mapYesNo(readCell(row, ["Calibration Required?"]), "Calibration Required"),
    calibrationFrequency: referenceCode(readCell(row, ["Calibration Frequency"]), lookups.references, "CALIBRATION_FREQUENCY", "Calibration Frequency"),
    measurementRange: readCell(row, ["Measurement Range"]), leastCount: readCell(row, ["Least Count"]), accuracy: readCell(row, ["Accuracy"]),
    calibrationAgencyId: calibrationAgency ? Number(calibrationAgency.supplierId) : null,
    remarks: readCell(row, ["Remarks"]),
    specifications: mapSpecifications(row, category.itemTypeId, lookups), suppliers: [], inspectionPlanCharacteristics: [],
  };
}

export async function bulkUploadItems(file, userCode) {
  const { itemRows, inspectionRows } = readExcelRows(file);
  const lookups = await getLookups();
  const errors = [];
  const validRows = [];
  const { uniqueReferences, invalidRows } = collectItemUploadReferences(itemRows, errors);
  const plansByReference = mapInspectionPlanRows(inspectionRows, uniqueReferences, lookups, errors);
  for (const row of itemRows) {
    if (invalidRows.has(row.excelRow)) continue;
    try {
      const { itemUploadReference, ...itemInput } = mapBulkRow(row, lookups);
      const inspectionPlanCharacteristics = plansByReference.get(normalizeLookupText(itemUploadReference)) || [];
      if (itemInput.inspectionRequired !== "Y" && inspectionPlanCharacteristics.length) {
        throw new AppError("Inspection-plan rows are allowed only when Inspection Required is Yes.");
      }
      const item = normalizeItem({ ...itemInput, inspectionPlanCharacteristics });
      await withTransaction(async (connection) => {
        await validateReferences(connection, item);
        await validateInspectionPlanCharacteristics(connection, item);
      });
      validRows.push({ excelRow: row.excelRow, item });
    } catch (error) {
      errors.push({ sheet: row.sheetLabel, row: row.excelRow, message: error.message || "Invalid item data." });
    }
  }
  const duplicateRows = new Map();
  for (const entry of validRows) {
    const key = identityKey(entry.item);
    duplicateRows.set(key, [...(duplicateRows.get(key) || []), entry]);
  }
  const duplicateKeys = new Set();
  for (const [key, entries] of duplicateRows.entries()) {
    if (entries.length > 1) {
      duplicateKeys.add(key);
      for (const entry of entries) errors.push({ sheet: BULK_UPLOAD_SHEET, row: entry.excelRow,
        message: "Duplicate item data is present elsewhere in this upload." });
    }
  }
  const existingRows = await withTransaction((connection) => repository.getExistingItemIdentityRows(connection,
    [...new Set(validRows.map((entry) => entry.item.itemTypeId))]));
  const existingKeys = new Set(existingRows.map(identityKey));
  for (const entry of validRows) {
    if (!duplicateKeys.has(identityKey(entry.item)) && existingKeys.has(identityKey(entry.item))) {
      errors.push({ sheet: BULK_UPLOAD_SHEET, row: entry.excelRow,
        message: "An Item Master record with the same category, material and description already exists." });
    }
  }
  if (errors.length) return { totalRows: itemRows.length, importedCount: 0, items: [],
    errors: errors.sort((a, b) => String(a.sheet || "").localeCompare(String(b.sheet || "")) || a.row - b.row) };
  const items = await withTransaction(async (connection) => {
    const created = [];
    for (const entry of validRows) {
      const itemCode = await repository.nextItemCode(connection, entry.item.itemGroupId, entry.item.itemTypeId);
      if (!itemCode) throw new AppError(`Item Code could not be generated for Excel row ${entry.excelRow}.`);
      const itemId = await repository.insertItem(connection, entry.item, itemCode, userCode);
      await repository.replaceSpecifications(connection, itemId, entry.item.specifications, userCode);
      await repository.replaceInspectionPlanCharacteristics(connection, itemId, entry.item.inspectionPlanCharacteristics, userCode);
      created.push({ row: entry.excelRow, itemId, itemCode, itemDescription: entry.item.itemDescription });
    }
    return created;
  });
  return { totalRows: itemRows.length, importedCount: items.length, items, errors: [] };
}
