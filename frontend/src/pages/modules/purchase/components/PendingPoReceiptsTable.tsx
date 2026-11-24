import type { PendingPoReceipt } from "../grnData";

type Props = { rows: PendingPoReceipt[] };

const quantity = (value: number | string) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const date = (value?: string | null) => value ? String(value).slice(0, 10) : "—";

export default function PendingPoReceiptsTable({ rows }: Props) {
  return <div className="purchase-grn-table-wrap"><table className="purchase-grn-table purchase-pending-po-table"><thead><tr><th>Purchase order</th><th>Supplier</th><th>Item</th><th>Ordered</th><th>Accepted</th><th>Pending to receive</th><th>Expected delivery</th><th>Receipt status</th></tr></thead><tbody>{rows.map((row) => {
    const partiallyReceived = Number(row.acceptedQuantity || 0) > 0;
    return <tr key={row.purchaseOrderItemId}><td><strong>{row.poNumber}</strong><small>Line {row.lineNumber} · PO date {date(row.poDate)}</small></td><td><strong>{row.supplierName || "—"}</strong><small>{row.supplierCode || "Supplier code unavailable"}</small></td><td><strong>{row.itemCode}</strong><small>{row.itemDescription}{row.itemSpecification ? ` · ${row.itemSpecification}` : ""}</small></td><td>{quantity(row.orderedQuantity)} {row.uomCode}</td><td>{quantity(row.acceptedQuantity)} {row.uomCode}</td><td className="purchase-pending-po-quantity">{quantity(row.pendingQuantity)} {row.uomCode}</td><td>{date(row.expectedDeliveryDate)}</td><td><span className={`purchase-grn-status ${partiallyReceived ? "ready-for-stock" : "inspection-pending"}`}>{partiallyReceived ? "Partly received" : "Awaiting receipt"}</span></td></tr>;
  })}</tbody></table>{!rows.length && <div className="purchase-grn-empty">No pending PO receipt items match the search.</div>}</div>;
}
