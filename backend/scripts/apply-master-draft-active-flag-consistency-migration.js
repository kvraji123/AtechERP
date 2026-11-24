import { db, withTransaction } from "../src/config/db.js";

const updates = [
  [
    "customer",
    `UPDATE customer_master
        SET active_flag='Y'
      WHERE active_flag='N'
        AND COALESCE(save_status,'SUBMITTED')='DRAFT'
        AND COALESCE(customer_status,'ACTIVE')<>'INACTIVE'`,
  ],
  [
    "supplier",
    `UPDATE supplier_master
        SET active_flag='Y'
      WHERE active_flag='N'
        AND COALESCE(save_status,'SUBMITTED')='DRAFT'
        AND COALESCE(supplier_status,'ACTIVE')<>'INACTIVE'`,
  ],
  [
    "part",
    `UPDATE part_master
        SET active_flag='Y'
      WHERE active_flag='N'
        AND COALESCE(save_status,'SUBMITTED')='DRAFT'
        AND COALESCE(part_status,'ACTIVE')<>'INACTIVE'`,
  ],
];

try {
  const affectedRows = await withTransaction(async (connection) => {
    const result = {};
    for (const [entity, statement] of updates) {
      const [update] = await connection.execute(statement);
      result[entity] = update.affectedRows;
    }
    return result;
  });

  console.log("Master draft active-flag consistency migration completed:", affectedRows);
} finally {
  await db.end();
}
