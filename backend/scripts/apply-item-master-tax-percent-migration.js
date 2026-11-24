import fs from "node:fs/promises";

import { db } from "../src/config/db.js";

try {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM item_master LIKE 'tax_percent'"
  );

  if (!columns.length) {
    const sql = await fs.readFile(
      new URL("../database/item-master-tax-percent-migration.sql", import.meta.url),
      "utf8"
    );
    await db.query(sql.trim());
    console.log("Item Master tax percentage column added successfully.");
  } else {
    console.log("Item Master tax percentage column already exists; no change was needed.");
  }
} finally {
  await db.end();
}
