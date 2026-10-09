import { CheckCircle2, Clock3, X } from "lucide-react";
import { loadSupplierAssignmentLines } from "../supplierAssignmentStore";
import type { RfqPurchaseRequest } from "../purchaseRfqRequests";

type Props = {
  request: RfqPurchaseRequest | null;
  onClose: () => void;
};

export default function PurchaseRequestViewDialog({ request, onClose }: Props) {
  if (!request) return null;

  const storedLines = loadSupplierAssignmentLines([request.prNumber]);
  const fallbackItems = request.itemSummary.split(",").map((itemName, index) => ({
    id: index + 1,
    prNumber: request.prNumber,
    itemCode: `ITEM-${String(index + 1).padStart(3, "0")}`,
    itemName: itemName.trim(),
    itemDescription: "Refer purchase request specification",
    quantity: 1,
    uom: "Nos",
    enquiryRequired: request.rfqStatus !== "NOT_REQUIRED",
  }));
  const lines = storedLines.length ? storedLines : fallbackItems;
  const isApproved = request.status === "APPROVED" || request.status === "PARTIALLY_APPROVED";

  return (
    <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="purchase-pr-view-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-pr-view-title">
        <header>
          <div>
            <h2 id="purchase-pr-view-title">Purchase Request</h2>
            <p>{request.prNumber} · Read-only details</p>
          </div>
          <button type="button" className="purchase-dialog-close" aria-label="Close purchase request" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="purchase-pr-view-body">
          <div className="purchase-pr-view-summary">
            <div><small>PR Number</small><strong>{request.prNumber}</strong></div>
            <div><small>Requested By</small><strong>{request.requestedBy}</strong></div>
            <div><small>Department</small><strong>{request.department}</strong></div>
            <div><small>Assigned Supplier(s)</small><strong>{request.assignedSuppliers || "Not assigned"}</strong></div>
            <div><small>Priority</small><strong>{request.priority}</strong></div>
            <div><small>Required Date</small><strong>{request.requiredDate}</strong></div>
            <div><small>Status</small><span className={`purchase-rfq-pr-status ${request.status.toLowerCase().replace(/_/g, "-")}`}>{isApproved ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}{request.status === "PARTIALLY_APPROVED" ? "Partially Approved" : request.status === "PENDING" ? "Pending Approval" : request.status.charAt(0) + request.status.slice(1).toLowerCase()}</span></div>
          </div>
          <div className="purchase-pr-view-section-head">
            <div><h3>Approved Line Items</h3><p>Only eligible approved quantities can proceed to supplier assignment and RFQ.</p></div>
            <span>{lines.length} {lines.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="purchase-pr-view-table-wrap">
            <table className="purchase-pr-view-table">
              <thead><tr><th>S.No</th><th>Item / Code</th><th>Description / Specification</th><th>Approved Qty</th><th>RFQ Eligibility</th></tr></thead>
              <tbody>{lines.map((line, index) => <tr key={`${line.prNumber}-${line.itemCode}`}><td>{index + 1}</td><td><strong>{line.itemName}</strong><small>{line.itemCode}</small></td><td>{line.itemDescription}</td><td><strong>{line.quantity} {line.uom}</strong></td><td><span className={`purchase-pr-view-eligibility ${line.enquiryRequired ? "eligible" : "not-required"}`}>{line.enquiryRequired ? "Eligible" : "Not Required"}</span></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <footer><button type="button" className="purchase-primary-button" onClick={onClose}><X size={15} /> Close</button></footer>
      </section>
    </div>
  );
}
