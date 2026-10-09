import { Eye } from "lucide-react";
import type { PurchaseApprovalRequest } from "../types";

type PurchaseApprovalTableProps = {
  requests: PurchaseApprovalRequest[];
  onReview: (request: PurchaseApprovalRequest) => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseApprovalTable({ requests, onReview }: PurchaseApprovalTableProps) {
  if (!requests.length) return <div className="purchase-approval-empty">No purchase requests match the selected filters.</div>;

  return (
    <div className="purchase-approval-table-wrap">
      <table className="purchase-approval-table">
        <thead><tr><th>PR Number</th><th>Plant / Department</th><th>Requested By</th><th>Supplier</th><th>Submitted</th><th>Items</th><th>Required Date</th><th>Priority</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td><strong className="purchase-pr-number">{request.prNumber}</strong><small>{request.requisitionType}</small></td>
              <td><strong>{request.plant}</strong><small>{request.department}</small></td>
              <td><strong>{request.requestedBy}</strong><small>Floor Manager</small></td>
              <td>{request.preferredSupplier ? <><strong>{request.preferredSupplier.name}</strong><small>{request.preferredSupplier.code}</small></> : <span className="purchase-supplier-no-preference">No preference</span>}</td>
              <td><strong>{request.submittedDate}</strong><small>{request.submittedTime}</small></td>
              <td>{request.itemCount}</td>
              <td><strong>{request.requiredDate}</strong></td>
              <td><span className={`purchase-approval-chip ${request.priority.toLowerCase()}`}>{request.priority}</span></td>
              <td>{money.format(request.amount)}</td>
              <td><span className={`purchase-approval-chip ${request.status.toLowerCase().replace(/ /g, "-")}`}>{request.status}</span></td>
              <td><button type="button" className="purchase-review-button" onClick={() => onReview(request)}><Eye size={15} /> {request.status === "Pending" ? "Review PR" : "View PR"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
