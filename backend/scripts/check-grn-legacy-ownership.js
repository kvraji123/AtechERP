import { db } from '../src/config/db.js';
try {
  const [rows] = await db.query("SELECT COUNT(*) AS legacyCustomerTransactions FROM inventory_stock_transaction T JOIN goods_receipt_notes G ON G.grn_id=T.grn_id AND G.tenant_id=T.tenant_id WHERE G.receipt_type='CUSTOMER_SUPPLIED' AND T.stock_owner_type='COMPANY'");
  console.log(JSON.stringify(rows[0]));
} finally { await db.end(); }
