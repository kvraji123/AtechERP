import { db } from "../src/config/db.js";

async function columnExists(columnName) {
  const [rows] = await db.execute(`SELECT COLUMN_TYPE AS columnType
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND COLUMN_NAME=?`, [columnName]);
  return rows[0] || null;
}

async function indexExists(indexName) {
  const [rows] = await db.execute(`SELECT COUNT(*) AS total FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND INDEX_NAME=?`, [indexName]);
  return Number(rows[0]?.total || 0) > 0;
}

async function constraintExists(constraintName) {
  const [rows] = await db.execute(`SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='part_master' AND CONSTRAINT_NAME=?`, [constraintName]);
  return Number(rows[0]?.total || 0) > 0;
}

try {
  const partStatus = await columnExists("part_status");
  if (!partStatus) throw new Error("part_master.part_status is missing. Run the core master schema migration first.");
  if (!String(partStatus.columnType || "").includes("DRAWING_UNDER_REVISION")) {
    await db.query("ALTER TABLE part_master MODIFY COLUMN part_status ENUM('ACTIVE','INACTIVE','DRAWING_UNDER_REVISION') NOT NULL DEFAULT 'ACTIVE'");
  }

  const columns = [
    ["revision_source_part_id", "ALTER TABLE part_master ADD COLUMN revision_source_part_id BIGINT UNSIGNED NULL AFTER active_flag"],
    ["bom_release_status", "ALTER TABLE part_master ADD COLUMN bom_release_status ENUM('DRAFT','RELEASED','NOT_REQUIRED') NOT NULL DEFAULT 'NOT_REQUIRED' AFTER revision_source_part_id"],
    ["bom_released_by", "ALTER TABLE part_master ADD COLUMN bom_released_by VARCHAR(50) NULL AFTER bom_release_status"],
    ["bom_released_on", "ALTER TABLE part_master ADD COLUMN bom_released_on DATETIME NULL AFTER bom_released_by"],
  ];
  for (const [columnName, statement] of columns) {
    if (!(await columnExists(columnName))) await db.query(statement);
  }

  if (!(await indexExists("ix_part_revision_source"))) {
    await db.query("ALTER TABLE part_master ADD KEY ix_part_revision_source (revision_source_part_id)");
  }
  if (!(await constraintExists("fk_part_revision_source"))) {
    await db.query("ALTER TABLE part_master ADD CONSTRAINT fk_part_revision_source FOREIGN KEY (revision_source_part_id) REFERENCES part_master(part_id) ON UPDATE CASCADE ON DELETE RESTRICT");
  }
  console.log("Part drawing-revision clone schema is ready.");
} finally {
  await db.end();
}
