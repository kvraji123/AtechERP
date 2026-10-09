import { db } from "../../config/db.js";
import * as queries from "./item.queries.js";

const integer = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

export async function listItems(filters = {}) {
  const search = String(filters.search || "").trim();
  const ids = ["itemGroupId", "itemTypeId", "materialId", "uomId", "supplierId"]
    .map((key) => integer(filters[key]));
  const inspection = ["Y", "N"].includes(String(filters.inspectionRequired || "").toUpperCase())
    ? String(filters.inspectionRequired).toUpperCase() : "";
  const active = ["Y", "N"].includes(String(filters.activeFlag || "").toUpperCase())
    ? String(filters.activeFlag).toUpperCase() : "";
  const [itemGroupId, itemTypeId, materialId, uomId, supplierId] = ids;
  const params = [search, search, search, itemGroupId, itemGroupId, itemTypeId, itemTypeId,
    materialId, materialId, uomId, uomId, inspection, inspection, active, active,
    supplierId, supplierId];
  const limit = integer(filters.limit, 20, 1, 100);
  const offset = integer(filters.offset, 0);
  const [rows] = await db.execute(`${queries.LIST_ITEMS} LIMIT ${limit} OFFSET ${offset}`, params);
  const [countRows] = await db.execute(queries.COUNT_ITEMS, params);
  return { rows, total: Number(countRows[0]?.total || 0) };
}

export async function getLookups() {
  const [[groups], [types], [uoms], [materials], [materialGrades], [suppliers], [customers], [references], [hsnCodes], [drawingCodes], [specFields], [descriptionTemplates], [machineTypes], [characteristics], [instruments], [toleranceGrades], [sampleSizes], [frequencies]] = await Promise.all([
    db.query(`SELECT item_group_id AS itemGroupId, group_code AS groupCode, group_name AS groupName
      FROM item_group_master WHERE active_flag='Y' ORDER BY item_group_id`),
    db.query(`SELECT item_type_id AS itemTypeId, item_group_id AS itemGroupId,
      type_name AS typeName, description_prefix AS descriptionPrefix,
      item_code_prefix AS itemCodePrefix
      FROM item_type_master WHERE active_flag='Y' ORDER BY item_group_id, type_name`),
    db.query(`SELECT uom_id AS uomId, uom_code AS uomCode, uom_name AS uomName
      FROM uom_master WHERE active_flag='Y' ORDER BY uom_name`),
    db.query(`SELECT material_id AS materialId, material_name AS materialName
      FROM material_master WHERE active_flag='Y' ORDER BY material_name`),
    db.query(`SELECT MG.material_grade_id AS materialGradeId,
      MG.material_id AS materialId, MG.grade_code AS gradeCode,
      MG.grade_name AS gradeName,M.material_name AS materialName,M.material_short_code AS materialShortCode,
      CASE WHEN UPPER(TRIM(MG.grade_name))=UPPER(TRIM(M.material_name))
        THEN MG.grade_name ELSE CONCAT(MG.grade_name, ' (', M.material_name, ')') END AS materialAndGrade
      FROM material_grade_master MG
      JOIN material_master M ON M.material_id=MG.material_id
      WHERE MG.active_flag='Y' AND M.active_flag='Y'
      ORDER BY MG.grade_name`),
    db.query(`SELECT supplier_id AS supplierId, supplier_code AS supplierCode,
      supplier_name AS supplierName FROM supplier_master
      WHERE active_flag='Y' ORDER BY supplier_name`),
    db.query(`SELECT customer_id AS customerId,customer_code AS customerCode,customer_name AS customerName
      FROM customer_master WHERE active_flag='Y' AND party_type IN ('CUSTOMER','BOTH')
      ORDER BY customer_name`),
    db.query(`SELECT reference_group AS referenceGroup, reference_code AS referenceCode,
      reference_label AS referenceLabel FROM item_reference_value
      WHERE active_flag='Y' ORDER BY reference_group, display_order, reference_label`),
    db.query(`SELECT hsn_code AS hsnCode, hsn_description AS hsnDescription
      FROM hsn_master WHERE active_flag='Y' ORDER BY hsn_code`),
    db.query(`SELECT DISTINCT
        COALESCE(NULLIF(TRIM(drawing_code),''),NULLIF(TRIM(drawing_number),'')) AS drawingCode,
        drawing_number AS drawingNumber,part_number AS partNumber,part_name AS partName
      FROM part_master
      WHERE active_flag='Y' AND part_status='ACTIVE'
        AND COALESCE(NULLIF(TRIM(drawing_code),''),NULLIF(TRIM(drawing_number),'')) IS NOT NULL
      ORDER BY drawingCode,partNumber`),
    db.query(`SELECT item_type_spec_field_id AS specFieldId, item_type_id AS itemTypeId,
      field_code AS fieldCode, field_label AS fieldLabel, input_type AS inputType,
      required_flag AS requiredFlag, option_values_json AS optionValues,
      allowed_uom_codes_json AS allowedUomCodes, default_uom_code AS defaultUomCode,
      visible_when_field AS visibleWhenField, visible_when_value AS visibleWhenValue,
      require_one_group AS requireOneGroup, display_order AS displayOrder
      FROM item_type_spec_field WHERE active_flag='Y' ORDER BY item_type_id,display_order`),
    db.query(`SELECT item_type_description_template_id AS templateId,item_type_id AS itemTypeId,
      condition_field_code AS conditionFieldCode,condition_operator AS conditionOperator,
      condition_value AS conditionValue,template_text AS templateText,display_order AS displayOrder
      FROM item_type_description_template WHERE active_flag='Y' ORDER BY item_type_id,display_order`),
    db.query(`SELECT machine_type_id AS machineTypeId,machine_type_code AS machineTypeCode,
      machine_type_name AS machineTypeName FROM machine_type_master
      WHERE active_flag='Y' ORDER BY display_order,machine_type_name`),
    db.query(`SELECT characteristic_master_id AS characteristicMasterId,characteristic_code AS characteristicCode,
      characteristic_name AS characteristicName,characteristic_type AS characteristicType
      FROM inspection_characteristic_master WHERE active_flag='Y' ORDER BY characteristic_name`),
    db.query(`SELECT instrument_master_id AS instrumentMasterId,instrument_code AS instrumentCode,
      instrument_name AS instrumentName FROM inspection_instrument_master WHERE active_flag='Y' ORDER BY instrument_name`),
    db.query(`SELECT tolerance_grade_id AS toleranceGradeId,grade_code AS gradeCode,basic_size_from AS basicSizeFrom,
      basic_size_to AS basicSizeTo,lower_deviation_microns AS lowerDeviationMicrons,
      upper_deviation_microns AS upperDeviationMicrons FROM tolerance_grade_master
      WHERE active_flag='Y' ORDER BY grade_code,basic_size_from`),
    db.query(`SELECT sample_size_code AS value,sample_size_label AS label FROM inspection_sample_size_master
      WHERE active_flag='Y' ORDER BY display_order`),
    db.query(`SELECT frequency_code AS value,frequency_label AS label FROM inspection_frequency_master
      WHERE active_flag='Y' ORDER BY display_order`),
  ]);
  return { groups, types, uoms, materials, materialGrades, suppliers, customers, references, hsnCodes, drawingCodes, specFields, descriptionTemplates, machineTypes,
    characteristics, instruments, toleranceGrades, sampleSizes, frequencies };
}

export async function getActiveItemGroup(connection, itemGroupId) {
  const [rows] = await connection.execute(`SELECT item_group_id AS itemGroupId,group_code AS groupCode,group_name AS groupName
    FROM item_group_master WHERE item_group_id=? AND active_flag='Y'`, [Number(itemGroupId)]);
  return rows[0] || null;
}

export async function findItemCategory(connection, itemGroupId, typeName, itemCodePrefix) {
  const [rows] = await connection.execute(`SELECT item_type_id AS itemTypeId,item_group_id AS itemGroupId,
    type_name AS typeName,description_prefix AS descriptionPrefix,item_code_prefix AS itemCodePrefix
    FROM item_type_master
    WHERE item_group_id=? AND (type_name=? OR item_code_prefix=?) LIMIT 1`,
  [Number(itemGroupId), typeName, itemCodePrefix]);
  return rows[0] || null;
}

export async function insertItemCategory(connection, data, userCode) {
  const [result] = await connection.execute(`INSERT INTO item_type_master
    (item_group_id,type_name,description_prefix,item_code_prefix,current_number,active_flag,created_by)
    VALUES (?,?,?,?,0,'Y',?)`,
  [Number(data.itemGroupId), data.typeName, data.itemCodePrefix, data.itemCodePrefix, userCode]);
  return Number(result.insertId);
}

export async function getItemCategory(connection, itemTypeId) {
  const [rows] = await connection.execute(`SELECT item_type_id AS itemTypeId,item_group_id AS itemGroupId,
    type_name AS typeName,description_prefix AS descriptionPrefix,item_code_prefix AS itemCodePrefix
    FROM item_type_master WHERE item_type_id=?`, [Number(itemTypeId)]);
  return rows[0] || null;
}

export async function getInspectionMasters(connection = db) {
  const [[characteristics], [instruments], [toleranceGrades], [sampleSizes], [frequencies]] = await Promise.all([
    connection.query(`SELECT characteristic_master_id AS characteristicMasterId,characteristic_code AS characteristicCode,
      characteristic_name AS characteristicName,characteristic_type AS characteristicType
      FROM inspection_characteristic_master WHERE active_flag='Y' ORDER BY characteristic_name`),
    connection.query(`SELECT instrument_master_id AS instrumentMasterId,instrument_code AS instrumentCode,
      instrument_name AS instrumentName FROM inspection_instrument_master WHERE active_flag='Y' ORDER BY instrument_name`),
    connection.query(`SELECT tolerance_grade_id AS toleranceGradeId,grade_code AS gradeCode,basic_size_from AS basicSizeFrom,
      basic_size_to AS basicSizeTo,lower_deviation_microns AS lowerDeviationMicrons,
      upper_deviation_microns AS upperDeviationMicrons FROM tolerance_grade_master
      WHERE active_flag='Y' ORDER BY grade_code,basic_size_from`),
    connection.query(`SELECT sample_size_code AS value,sample_size_label AS label FROM inspection_sample_size_master
      WHERE active_flag='Y' ORDER BY display_order`),
    connection.query(`SELECT frequency_code AS value,frequency_label AS label FROM inspection_frequency_master
      WHERE active_flag='Y' ORDER BY display_order`),
  ]);
  return { characteristics, instruments, toleranceGrades, sampleSizes, frequencies };
}

export async function getItemById(itemId, connection = db) {
  const [rows] = await connection.execute(queries.GET_ITEM, [Number(itemId)]);
  if (!rows[0]) return null;
  const [suppliers] = await connection.execute(`
    SELECT S.item_supplier_id AS itemSupplierId, S.supplier_id AS supplierId,
      C.supplier_code AS supplierCode, C.supplier_name AS supplierName,
      S.supplier_item_code AS supplierItemCode, S.purchase_rate AS purchaseRate,
      S.currency_code AS currencyCode, S.moq, S.lead_time_days AS leadTimeDays,
      S.effective_from AS effectiveFrom, S.effective_to AS effectiveTo,
      S.preferred_supplier AS preferredSupplier, S.remarks
    FROM item_supplier S JOIN supplier_master C ON C.supplier_id=S.supplier_id
    WHERE S.item_id=? ORDER BY S.preferred_supplier DESC, C.supplier_name`, [Number(itemId)]);
  let customerSupplied = null;
  try {
    const [customerRows] = await connection.execute(`SELECT CSI.customer_id AS customerId,
      C.customer_code AS customerCode,C.customer_name AS customerName
      FROM customer_supplied_item CSI
      JOIN customer_master C ON C.customer_id=CSI.customer_id
      WHERE CSI.item_id=?`, [Number(itemId)]);
    customerSupplied = customerRows[0] || null;
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  const [attachments] = await connection.execute(`
    SELECT item_attachment_id AS itemAttachmentId, document_type AS documentType,
      document_description AS documentDescription, file_name AS fileName,
      CONCAT('/uploads/', REPLACE(file_path, '\\\\', '/')) AS fileUrl,
      mime_type AS mimeType, file_size AS fileSize, created_on AS createdOn
    FROM item_attachment WHERE item_id=? ORDER BY item_attachment_id`, [Number(itemId)]);
  const [specifications] = await connection.execute(`
    SELECT V.item_type_spec_field_id AS specFieldId,F.field_code AS fieldCode,
      V.value_text AS valueText,V.value_number AS valueNumber,V.uom_id AS uomId,U.uom_code AS uomCode
    FROM item_specification_value V
    JOIN item_type_spec_field F ON F.item_type_spec_field_id=V.item_type_spec_field_id
    LEFT JOIN uom_master U ON U.uom_id=V.uom_id
    WHERE V.item_id=? ORDER BY F.display_order`, [Number(itemId)]);
  const [inspectionPlanCharacteristics] = await connection.execute(`
    SELECT IC.item_inspection_characteristic_id AS itemInspectionCharacteristicId,
      IC.sequence_number AS sequenceNumber,IC.balloon_number AS balloonNumber,
      IC.characteristic_master_id AS characteristicMasterId,IC.characteristic_text AS characteristicText,
      CM.characteristic_code AS characteristicCode,
      COALESCE(NULLIF(IC.characteristic_text,''),CM.characteristic_name) AS characteristicName,
      IC.specified_dimension AS specifiedDimension,
      IC.tolerance_grade_id AS toleranceGradeId,IC.tolerance_grade_text AS toleranceGradeText,
      TG.grade_code AS gradeCode,IC.tolerance_minus AS toleranceMinus,IC.tolerance_plus AS tolerancePlus,
      IC.lsl,IC.usl,IC.drawing_grid AS drawingGrid,IC.instrument_master_id AS instrumentMasterId,
      IM.instrument_name AS instrumentName,IC.sample_size AS sampleSize,IC.inspection_frequency AS inspectionFrequency
    FROM item_incoming_inspection_characteristic IC
    LEFT JOIN inspection_characteristic_master CM ON CM.characteristic_master_id=IC.characteristic_master_id
    LEFT JOIN tolerance_grade_master TG ON TG.tolerance_grade_id=IC.tolerance_grade_id
    LEFT JOIN inspection_instrument_master IM ON IM.instrument_master_id=IC.instrument_master_id
    WHERE IC.item_id=? ORDER BY IC.sequence_number`, [Number(itemId)]);
  return { ...rows[0], customerId: customerSupplied?.customerId ?? null,
    customerCode: customerSupplied?.customerCode ?? null, customerName: customerSupplied?.customerName ?? null,
    suppliers, specifications, attachments, inspectionPlanCharacteristics };
}

export async function validateCustomer(connection, customerId) {
  const [rows] = await connection.execute(`SELECT customer_id FROM customer_master
    WHERE customer_id=? AND active_flag='Y' AND party_type IN ('CUSTOMER','BOTH')`, [Number(customerId)]);
  return Boolean(rows[0]);
}

export async function getSpecificationConfig(connection, itemTypeId) {
  const [fields] = await connection.execute(`SELECT item_type_spec_field_id AS specFieldId,
    field_code AS fieldCode,field_label AS fieldLabel,input_type AS inputType,required_flag AS requiredFlag,
    option_values_json AS optionValues,allowed_uom_codes_json AS allowedUomCodes,default_uom_code AS defaultUomCode,
    visible_when_field AS visibleWhenField,visible_when_value AS visibleWhenValue,
    require_one_group AS requireOneGroup,display_order AS displayOrder
    FROM item_type_spec_field WHERE item_type_id=? AND active_flag='Y' ORDER BY display_order`, [itemTypeId]);
  const [templates] = await connection.execute(`SELECT condition_field_code AS conditionFieldCode,
    condition_operator AS conditionOperator,condition_value AS conditionValue,template_text AS templateText,
    display_order AS displayOrder FROM item_type_description_template
    WHERE item_type_id=? AND active_flag='Y' ORDER BY display_order`, [itemTypeId]);
  return { fields, templates };
}

export async function nextItemCode(connection, groupId, typeId) {
  const [rows] = await connection.execute(`SELECT G.group_code,
      T.item_code_prefix, T.current_number
    FROM item_type_master T
    JOIN item_group_master G ON G.item_group_id=T.item_group_id
    WHERE G.item_group_id=? AND G.active_flag='Y'
      AND T.item_type_id=? AND T.active_flag='Y'
    FOR UPDATE`, [groupId, typeId]);
  if (!rows[0]) return null;
  const next = Number(rows[0].current_number) + 1;
  await connection.execute(`UPDATE item_type_master SET current_number=? WHERE item_type_id=?`,
    [next, typeId]);
  return `${rows[0].group_code}-${rows[0].item_code_prefix}-${String(next).padStart(6, "0")}`;
}

export async function getExistingItemIdentityRows(connection, itemTypeIds) {
  if (!itemTypeIds.length) return [];
  const placeholders = itemTypeIds.map(() => "?").join(",");
  const [rows] = await connection.execute(`SELECT item_group_id AS itemGroupId,item_type_id AS itemTypeId,
    material_grade_id AS materialGradeId,item_description AS itemDescription
    FROM item_master WHERE item_type_id IN (${placeholders})`, itemTypeIds);
  return rows;
}

export async function validateReferences(connection, data) {
  const [rows] = await connection.execute(`
    SELECT G.group_code,T.type_name,T.description_prefix,T.item_code_prefix,
      MG.material_id,MG.grade_code,MG.grade_name,M.material_name,M.material_short_code
    FROM item_group_master G JOIN item_type_master T ON T.item_group_id=G.item_group_id
    JOIN uom_master U ON U.uom_id=? AND U.active_flag='Y'
    LEFT JOIN material_grade_master MG ON MG.material_grade_id=? AND MG.active_flag='Y'
    LEFT JOIN material_master M ON M.material_id=MG.material_id AND M.active_flag='Y'
    WHERE G.item_group_id=? AND G.active_flag='Y' AND T.item_type_id=? AND T.active_flag='Y'
      AND (? IS NULL OR (MG.material_grade_id IS NOT NULL AND M.material_id IS NOT NULL))`,
    [data.uomId, data.materialGradeId, data.itemGroupId, data.itemTypeId,
      data.materialGradeId]);
  return rows[0] || null;
}

export async function validateMachineType(connection, machineTypeId) {
  if (!machineTypeId) return null;
  const [rows] = await connection.execute(`SELECT machine_type_id AS machineTypeId,
    machine_type_code AS machineTypeCode,machine_type_name AS machineTypeName
    FROM machine_type_master WHERE machine_type_id=? AND active_flag='Y'`, [machineTypeId]);
  return rows[0] || null;
}

export async function getUomsByIds(connection, uomIds) {
  if (!uomIds.length) return [];
  const placeholders=uomIds.map(() => "?").join(",");
  const [rows]=await connection.execute(`SELECT uom_id AS uomId,uom_code AS uomCode
    FROM uom_master WHERE active_flag='Y' AND uom_id IN (${placeholders})`,uomIds);
  return rows;
}

export async function getActiveDrawingCodes(connection, drawingCodes) {
  if (!drawingCodes.length) return [];
  const placeholders=drawingCodes.map(() => "?").join(",");
  const [rows]=await connection.execute(`SELECT DISTINCT
      COALESCE(NULLIF(TRIM(drawing_code),''),NULLIF(TRIM(drawing_number),'')) AS drawingCode
    FROM part_master
    WHERE active_flag='Y' AND part_status='ACTIVE'
      AND COALESCE(NULLIF(TRIM(drawing_code),''),NULLIF(TRIM(drawing_number),'')) IN (${placeholders})`,drawingCodes);
  return rows;
}

export async function validateSuppliers(connection, supplierIds) {
  if (!supplierIds.length) return true;
  const placeholders = supplierIds.map(() => "?").join(",");
  const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM supplier_master
    WHERE supplier_id IN (${placeholders}) AND active_flag='Y'`, supplierIds);
  return Number(rows[0].total) === supplierIds.length;
}

export async function insertItem(connection, data, itemCode, userCode) {
  const [result] = await connection.execute(`INSERT INTO item_master
    (item_code,item_group_id,item_type_id,item_description,item_specification,additional_description,uom_id,material_id,material_grade_id,
     inspection_required,hsn_code,purchase_rate,minimum_stock,make_name,model_name,machine_type_id,machine_capacity,
     lead_time_days,reorder_level,maximum_stock,storage_location,shelf_life_applicable,shelf_life_days,
     batch_tracking_required,serial_tracking_required,drawing_number,drawing_revision,serial_number,asset_category,
     warranty_applicable,warranty_period_months,installation_required,calibration_required,calibration_frequency,
     measurement_range,least_count,accuracy,calibration_agency_id,remarks,item_status,active_flag,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [itemCode, data.itemGroupId, data.itemTypeId, data.itemDescription, data.itemSpecification,
      data.additionalDescription, data.uomId, data.materialId, data.materialGradeId, data.inspectionRequired, data.hsnCode,
      data.purchaseRate, data.minimumStock, data.makeName, data.modelName, data.machineTypeId, data.machineCapacity,
      data.leadTimeDays, data.reorderLevel, data.maximumStock,
      data.storageLocation, data.shelfLifeApplicable, data.shelfLifeDays, data.batchTrackingRequired, data.serialTrackingRequired,
      data.drawingNumber, data.drawingRevision, data.serialNumber, data.assetCategory, data.warrantyApplicable,
      data.warrantyPeriodMonths, data.installationRequired, data.calibrationRequired, data.calibrationFrequency,
      data.measurementRange, data.leastCount, data.accuracy, data.calibrationAgencyId, data.remarks,
      data.itemStatus, data.itemStatus === "ACTIVE" ? "Y" : "N", userCode]);
  return result.insertId;
}

export async function updateItem(connection, itemId, data, userCode) {
  await connection.execute(`UPDATE item_master SET item_type_id=?,item_description=?,
    item_specification=?,additional_description=?,uom_id=?,material_id=?,material_grade_id=?,inspection_required=?,hsn_code=?,purchase_rate=?,
    minimum_stock=?,make_name=?,model_name=?,machine_type_id=?,machine_capacity=?,
    lead_time_days=?,reorder_level=?,maximum_stock=?,storage_location=?,shelf_life_applicable=?,shelf_life_days=?,batch_tracking_required=?,
    serial_tracking_required=?,drawing_number=?,drawing_revision=?,serial_number=?,asset_category=?,warranty_applicable=?,
    warranty_period_months=?,installation_required=?,calibration_required=?,calibration_frequency=?,measurement_range=?,
    least_count=?,accuracy=?,calibration_agency_id=?,remarks=?,updated_by=? WHERE item_id=?`,
    [data.itemTypeId, data.itemDescription, data.itemSpecification, data.additionalDescription, data.uomId, data.materialId,
      data.materialGradeId, data.inspectionRequired, data.hsnCode, data.purchaseRate, data.minimumStock,
      data.makeName, data.modelName, data.machineTypeId, data.machineCapacity,
      data.leadTimeDays, data.reorderLevel, data.maximumStock, data.storageLocation, data.shelfLifeApplicable, data.shelfLifeDays,
      data.batchTrackingRequired, data.serialTrackingRequired, data.drawingNumber, data.drawingRevision,
      data.serialNumber, data.assetCategory, data.warrantyApplicable, data.warrantyPeriodMonths,
      data.installationRequired, data.calibrationRequired, data.calibrationFrequency, data.measurementRange,
      data.leastCount, data.accuracy, data.calibrationAgencyId, data.remarks, userCode, itemId]);
}

export async function replaceSuppliers(connection, itemId, suppliers, userCode) {
  await connection.execute(`DELETE FROM item_supplier WHERE item_id=?`, [itemId]);
  for (const supplier of suppliers) {
    await connection.execute(`INSERT INTO item_supplier
      (item_id,supplier_id,supplier_item_code,purchase_rate,currency_code,moq,lead_time_days,effective_from,
       effective_to,preferred_supplier,remarks,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [itemId, supplier.supplierId, supplier.supplierItemCode,
      supplier.purchaseRate, supplier.currencyCode, supplier.moq, supplier.leadTimeDays, supplier.effectiveFrom,
      supplier.effectiveTo, supplier.preferredSupplier, supplier.remarks, userCode]);
  }
}

export async function replaceCustomerSuppliedItem(connection, itemId, customerId, userCode) {
  await connection.execute(`DELETE FROM customer_supplied_item WHERE item_id=?`, [Number(itemId)]);
  if (!customerId) return;
  await connection.execute(`INSERT INTO customer_supplied_item (item_id,customer_id,created_by,updated_by)
    VALUES (?,?,?,?)`, [Number(itemId), Number(customerId), userCode, userCode]);
}

export async function replaceSpecifications(connection, itemId, specifications, userCode) {
  await connection.execute(`DELETE FROM item_specification_value WHERE item_id=?`, [itemId]);
  for (const specification of specifications) {
    await connection.execute(`INSERT INTO item_specification_value
      (item_id,item_type_spec_field_id,value_text,value_number,uom_id,created_by)
      VALUES (?,?,?,?,?,?)`, [itemId,specification.specFieldId,specification.valueText,
      specification.valueNumber,specification.uomId,userCode]);
  }
}

export async function replaceInspectionPlanCharacteristics(connection, itemId, characteristics, userCode) {
  await connection.execute(`DELETE FROM item_incoming_inspection_characteristic WHERE item_id=?`, [itemId]);
  for (const characteristic of characteristics) {
    await connection.execute(`INSERT INTO item_incoming_inspection_characteristic
      (item_id,sequence_number,balloon_number,characteristic_master_id,characteristic_text,specified_dimension,tolerance_mode,
       tolerance_grade_id,tolerance_grade_text,tolerance_minus,tolerance_plus,lsl,usl,drawing_grid,
       instrument_master_id,sample_size,inspection_frequency,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [itemId, characteristic.sequenceNumber, characteristic.balloonNumber,
      characteristic.characteristicMasterId, characteristic.characteristicText, characteristic.specifiedDimension, characteristic.toleranceMode,
      characteristic.toleranceGradeId, characteristic.toleranceGradeText, characteristic.toleranceMinus,
      characteristic.tolerancePlus, characteristic.lsl, characteristic.usl, characteristic.drawingGrid,
      characteristic.instrumentMasterId, characteristic.sampleSize, characteristic.inspectionFrequency, userCode]);
  }
}

export async function updateStatus(itemId, status, remarks, userCode) {
  await db.execute(`UPDATE item_master SET item_status=?,active_flag=?,deactivation_remarks=?,updated_by=?
    WHERE item_id=?`, [status, status === "ACTIVE" ? "Y" : "N", remarks, userCode, itemId]);
}

export async function insertAttachment(itemId, file, data, userCode) {
  const relativePath = `marketing/items/${file.filename}`;
  const [result] = await db.execute(`INSERT INTO item_attachment
    (item_id,document_type,document_description,file_name,stored_file_name,file_path,mime_type,file_size,created_by)
    VALUES (?,?,?,?,?,?,?,?,?)`, [itemId, data.documentType, data.documentDescription,
    file.originalname, file.filename, relativePath, file.mimetype, file.size, userCode]);
  return result.insertId;
}

export async function getAttachment(attachmentId) {
  const [rows] = await db.execute(`SELECT * FROM item_attachment WHERE item_attachment_id=?`, [attachmentId]);
  return rows[0] || null;
}

export async function deleteAttachment(attachmentId) {
  await db.execute(`DELETE FROM item_attachment WHERE item_attachment_id=?`, [attachmentId]);
}
