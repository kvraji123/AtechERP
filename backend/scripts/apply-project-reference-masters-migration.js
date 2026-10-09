import fs from "node:fs/promises";
import { db } from "../src/config/db.js";

try {
  const [columns] = await db.execute(`SELECT column_name FROM information_schema.columns
    WHERE table_schema=DATABASE() AND table_name='part_master' AND column_name='material_id'`);
  let sql = await fs.readFile(new URL("../database/project-reference-masters-migration.sql", import.meta.url), "utf8");
  if (columns.length) sql = sql.substring(0, sql.indexOf("ALTER TABLE part_master"));
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((value) => value.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  console.log("Project reference masters migration applied.");
} finally { await db.end(); }
