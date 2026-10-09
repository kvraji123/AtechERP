import { ClipboardCheck, Eye } from "lucide-react";
import type { PurchaseOrderApprovalRecord } from "../purchaseFlowStore";

type PurchaseOrderApprovalTableProps = {
  records: PurchaseOrderApprovalRecord[];
  onReview: (record: PurchaseOrderApprovalRecord) => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const total = (record: PurchaseOrderApprovalRecord) => record.grandTotalAmount ?? record.lines.reduce((sum, line) => { const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0)); return sum + taxable + taxable * line.taxPercent / 100 + (line.freightAndOther || 0); }, 0);

export default function PurchaseOrderApprovalTable({ records, onReview }: PurchaseOrderApprovalTableProps) {
  return <div className="purchase-po-approval-table-wrap"><table className="purchase-po-approval-list-table"><thead><tr><th>PO Number</th><th>Supplier</th><th>Source Reference</th><th>Items</th><th>Submitted By</th><th>Submitted Date</th><th>PO Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.map((record) => { const itemCount = record.itemCount ?? record.lines.length; return <tr key={record.id}><td><strong>{record.form.poNumber}</strong><small>Coimbatore Unit · {record.itemCategory || "Item type unavailable"}</small></td><td><strong>{record.form.supplierName.split(" · ")[0]}</strong><small>{record.supplierCode}</small></td><td>{record.form.sourceReference.split(" · ")[0]}</td><td><strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong><small>{record.lines.map((line) => line.itemName).join(", ")}</small></td><td><strong>{record.submittedBy}</strong><small>Purchase Manager</small></td><td><strong>{record.submittedDate}</strong><small>{record.submittedTime}</small></td><td className="money"><strong>{money.format(total(record))}</strong></td><td><span className={`purchase-po-approval-list-status ${record.status.toLowerCase()}`}>{record.status === "SUBMITTED" ? "Pending Approval" : record.status.charAt(0) + record.status.slice(1).toLowerCase()}</span></td><td><button type="button" className={record.status === "SUBMITTED" ? "purchase-po-review-button" : "purchase-po-view-button"} onClick={() => onReview(record)}>{record.status === "SUBMITTED" ? <ClipboardCheck size={14} /> : <Eye size={14} />}{record.status === "SUBMITTED" ? "Review" : "View Decision"}</button></td></tr>; })}</tbody></table>{!records.length && <div className="purchase-po-approval-empty">No purchase orders match the selected filters.</div>}</div>;
}
