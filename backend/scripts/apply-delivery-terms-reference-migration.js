import fs from "node:fs/promises";
import { db } from "../src/config/db.js";

try {
  const sql = await fs.readFile(
    new URL("../database/delivery-terms-reference-migration.sql", import.meta.url),
    "utf8",
  );
  await db.query(sql);
  console.log("Delivery Terms reference values are ready.");
} finally {
  await db.end();
}
