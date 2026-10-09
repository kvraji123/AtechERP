import { ArrowRight, Eye, PackagePlus } from "lucide-react";
import type { GateEntryRecord } from "../gateEntryData";
import { formatDateTime } from "../../../../utils/formatDateTime";

type Props = { records: GateEntryRecord[]; onAction: (record: GateEntryRecord) => void };
const statusLabel = { DRAFT: "Draft", GATE_ENTERED: "Gate Entered", GRN_CREATED: "GRN Created", OUTSOURCING_WIP: "Outsourcing WIP", STOCK_POSTED: "Stock Posted" };
const displayDateTime = formatDateTime;

const typeLabel = { REGULAR_PURCHASE: "Regular Purchase", CUSTOMER_PURCHASE: "Customer Purchase", OPEN_PURCHASE: "Open Purchase", OUTSOURCING_PARTS: "Outsourcing Parts" };

export default function GateEntryTable({ records, onAction }: Props) {
  const action = (status: GateEntryRecord["status"]) => status === "DRAFT" ? { label: "Continue", icon: <ArrowRight size={14} /> } : status === "GATE_ENTERED" ? { label: "Create GRN", icon: <PackagePlus size={14} /> } : status === "STOCK_POSTED" ? { label: "View Receipt", icon: <Eye size={14} /> } : { label: "View GRN", icon: <Eye size={14} /> };
  return <div className="purchase-gate-table-wrap"><table className="purchase-gate-table"><thead><tr><th>Gate Entry No.</th><th>Date &amp; Time</th><th>Entry Type / Reference</th><th>Supplier / Customer</th><th>Vehicle Number</th><th>Driver</th><th>Items / Quantity</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.map((record) => { const rowAction = action(record.status); const entryType = record.entryType || "REGULAR_PURCHASE"; const customerPurchase = entryType === "CUSTOMER_PURCHASE"; return <tr key={record.id}><td><strong>{record.gateEntryNumber}</strong></td><td>{displayDateTime(record.entryDateTime)}</td><td><strong>{record.referenceNumber || record.poNumber || "—"}</strong><small>{typeLabel[entryType]}</small></td><td><strong>{customerPurchase ? record.customerName || "—" : record.supplierName || "—"}</strong><small>{customerPurchase ? "Customer supplied" : record.supplierCode || "Reference only"}</small></td><td>{record.vehicleNumber || "—"}</td><td><strong>{record.driverName || "—"}</strong><small>{record.drivingLicenceNumber || "Licence pending"}</small></td><td><strong>{record.itemCount} items</strong><small>{record.totalQuantity} total quantity</small></td><td><span className={`purchase-gate-status ${record.status.toLowerCase().replace("_", "-")}`}>{statusLabel[record.status]}</span></td><td><button type="button" className="purchase-po-view-button" onClick={() => onAction(record)}>{rowAction.icon} {rowAction.label}</button></td></tr>; })}</tbody></table>{!records.length && <div className="purchase-gate-empty">No gate entries match the selected filters.</div>}</div>;
}
