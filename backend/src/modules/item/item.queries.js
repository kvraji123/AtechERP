export const LIST_ITEMS = `
  SELECT
    I.item_id AS itemId,
    I.item_code AS itemCode,
    I.item_description AS itemDescription,
    G.item_group_id AS itemGroupId,
    G.group_code AS groupCode,
    G.group_name AS groupName,
    T.item_type_id AS itemTypeId,
    T.type_name AS typeName,
    U.uom_id AS uomId,
    U.uom_code AS uomCode,
    M.material_id AS materialId,
    I.material_grade_id AS materialGradeId,
    MG.grade_code AS materialGradeCode,
    MG.grade_name AS materialName,
    I.mtc_applicable AS mtcApplicable,
    I.inspection_required AS inspectionRequired,
    I.hsn_code AS hsnCode,
    I.tax_percent AS taxPercent,
    I.purchase_rate AS purchaseRate,
    (
      SELECT ISU.purchase_rate
      FROM item_supplier ISU
      WHERE ISU.item_id = I.item_id
        AND ISU.supplier_id = ?
      ORDER BY ISU.preferred_supplier DESC, ISU.item_supplier_id DESC
      LIMIT 1
    ) AS supplierPurchaseRate,
    I.minimum_stock AS minimumStock,
    I.make_name AS makeName,
    I.model_name AS modelName,
    I.machine_type_id AS machineTypeId,
    MT.machine_type_name AS machineTypeName,
    I.machine_capacity AS machineCapacity,
    I.item_status AS itemStatus,
    I.active_flag AS activeFlag,
    COALESCE(I.updated_on, I.created_on) AS lastUpdated,
    (SELECT COUNT(*) FROM item_supplier S WHERE S.item_id = I.item_id) AS supplierCount,
    (SELECT C.supplier_name FROM item_supplier S
       JOIN supplier_master C ON C.supplier_id = S.supplier_id
      WHERE S.item_id = I.item_id AND S.preferred_supplier = 'Y' LIMIT 1) AS preferredSupplierName
  FROM item_master I
  JOIN item_group_master G ON G.item_group_id = I.item_group_id
  JOIN item_type_master T ON T.item_type_id = I.item_type_id
  JOIN uom_master U ON U.uom_id = I.uom_id
  LEFT JOIN material_master M ON M.material_id = I.material_id
  LEFT JOIN material_grade_master MG ON MG.material_grade_id = I.material_grade_id
  LEFT JOIN machine_type_master MT ON MT.machine_type_id = I.machine_type_id
  WHERE (? = '' OR I.item_code LIKE CONCAT('%', ?, '%') OR I.item_description LIKE CONCAT('%', ?, '%'))
    AND (? = 0 OR I.item_group_id = ?)
    AND (? = 0 OR I.item_type_id = ?)
    AND (? = 0 OR I.material_id = ?)
    AND (? = 0 OR I.uom_id = ?)
    AND (? = '' OR I.inspection_required = ?)
    AND (? = '' OR I.active_flag = ?)
    AND (? = 0 OR EXISTS (
      SELECT 1 FROM item_supplier ISU WHERE ISU.item_id = I.item_id AND ISU.supplier_id = ?
    ))
  ORDER BY COALESCE(I.updated_on, I.created_on) DESC, I.item_id DESC
`;

export const COUNT_ITEMS = `
  SELECT COUNT(*) AS total
  FROM item_master I
  WHERE (? = '' OR I.item_code LIKE CONCAT('%', ?, '%') OR I.item_description LIKE CONCAT('%', ?, '%'))
    AND (? = 0 OR I.item_group_id = ?)
    AND (? = 0 OR I.item_type_id = ?)
    AND (? = 0 OR I.material_id = ?)
    AND (? = 0 OR I.uom_id = ?)
    AND (? = '' OR I.inspection_required = ?)
    AND (? = '' OR I.active_flag = ?)
    AND (? = 0 OR EXISTS (
      SELECT 1 FROM item_supplier ISU WHERE ISU.item_id = I.item_id AND ISU.supplier_id = ?
    ))
`;

export const GET_ITEM = `
  SELECT I.*, G.group_code, G.group_name, T.type_name, T.description_prefix,
         T.item_code_prefix, U.uom_code, U.uom_name, M.material_name, M.material_short_code,
         MG.grade_code AS material_grade_code,
         MG.grade_name AS material_grade_name
  FROM item_master I
  JOIN item_group_master G ON G.item_group_id = I.item_group_id
  JOIN item_type_master T ON T.item_type_id = I.item_type_id
  JOIN uom_master U ON U.uom_id = I.uom_id
  LEFT JOIN material_master M ON M.material_id = I.material_id
  LEFT JOIN material_grade_master MG ON MG.material_grade_id = I.material_grade_id
  WHERE I.item_id = ?
`;
