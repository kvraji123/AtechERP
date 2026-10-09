import fs from "fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

const schema = await fs.readFile(new URL("../database/item-master-schema.sql", import.meta.url), "utf8");
const cleanup = await fs.readFile(new URL("../database/item-master-field-removal-migration.sql", import.meta.url), "utf8");
const shelfLife = await fs.readFile(new URL("../database/consumable-shelf-life-radio-migration.sql", import.meta.url), "utf8");
const purchasedItems = await fs.readFile(new URL("../database/purchased-item-group-migration.sql", import.meta.url), "utf8");
const categoryCleanup = await fs.readFile(new URL("../database/consumable-category-cleanup-migration.sql", import.meta.url), "utf8");
const packingSize = await fs.readFile(new URL("../database/packing-material-size-migration.sql", import.meta.url), "utf8");
const fixtures = await fs.readFile(new URL("../database/tools-fixtures-group-migration.sql", import.meta.url), "utf8");
const rodType = await fs.readFile(new URL("../database/rod-type-migration.sql", import.meta.url), "utf8");
const rodLengthRemoval = await fs.readFile(new URL("../database/rod-length-optional-migration.sql", import.meta.url), "utf8");
const purchasedCategories = await fs.readFile(new URL("../database/purchased-item-categories-migration.sql", import.meta.url), "utf8");
const customerSuppliedCategory = await fs.readFile(new URL("../database/customer-supplied-item-category-migration.sql", import.meta.url), "utf8");
const furnitureItemType = await fs.readFile(new URL("../database/furniture-item-type-migration.sql", import.meta.url), "utf8");
const typeSpecifications = await fs.readFile(new URL("../database/item-master-type-specifications-migration.sql", import.meta.url), "utf8");
const sql = `${schema}\n${cleanup}\n${shelfLife}\n${purchasedItems}\n${categoryCleanup}\n${packingSize}\n${fixtures}\n${rodType}\n${rodLengthRemoval}\n${purchasedCategories}\n${customerSuppliedCategory}\n${furnitureItemType}\n${typeSpecifications}`;

const connection = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

try {
  await connection.query("SET SESSION SQL_SAFE_UPDATES=1");
  await connection.query(sql);
  console.log("Item Master schema, field cleanup, Raw Material and Consumables Shelf Life rules applied successfully.");
} finally {
  await connection.end();
}
