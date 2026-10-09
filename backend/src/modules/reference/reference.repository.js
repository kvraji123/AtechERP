import { db } from "../../config/db.js";

export async function getReferenceData(types = []) {
  const requested = [...new Set(types.map((type) => String(type || "").trim().toUpperCase()).filter(Boolean))];
  const where = requested.length ? `AND reference_type IN (${requested.map(() => "?").join(",")})` : "";
  const [[references], [materials], [uoms], [grades]] = await Promise.all([
    db.execute(`SELECT reference_type AS referenceType, value_code AS value,
      display_label AS label, numeric_value AS numericValue, effective_date AS effectiveDate
      FROM marketing_reference_values WHERE active_flag='Y' ${where}
      ORDER BY reference_type, sort_order, display_label`, requested),
    db.query(`SELECT material_id AS materialId, material_name AS materialName
      FROM material_master WHERE active_flag='Y' ORDER BY material_name`),
    db.query(`SELECT uom_id AS uomId, uom_code AS uomCode, uom_name AS uomName
      FROM uom_master WHERE active_flag='Y' ORDER BY uom_name`),
    db.query(`SELECT material_grade_id AS materialGradeId, material_id AS materialId,
      grade_code AS gradeCode, grade_name AS gradeName
      FROM material_grade_master WHERE active_flag='Y' ORDER BY grade_name`),
  ]);
  return { references, materials, uoms, grades };
}

export async function isActiveReference(referenceType, value) {
  const [rows] = await db.execute(`SELECT 1 FROM marketing_reference_values
    WHERE reference_type=? AND value_code=? AND active_flag='Y' LIMIT 1`,
  [referenceType, value]);
  return Boolean(rows[0]);
}
