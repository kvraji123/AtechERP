import { ClipboardList, Eye, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiPurchaseRequisitionRow } from "../purchaseRfqRequests";

type Props = {
  requests: ApiPurchaseRequisitionRow[];
  selectedIds: string[];
  loading: boolean;
  preparing: boolean;
  error: string;
  onToggle: (id: string) => void;
  onPrepare: () => void;
  onRefresh: () => void;
  onView: (request: ApiPurchaseRequisitionRow) => void;
};

const dateLabel = (value?: string | null) => {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value);
};

export default function PurchaseOrderDirectPrList({ requests, selectedIds, loading, preparing, error, onToggle, onPrepare, onRefresh, onView }: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => !query || `${request.prNumber} ${request.requestedBy || ""} ${request.department || ""} ${request.approvedItemSummary || ""} ${request.preferredSupplierName || ""}`.toLowerCase().includes(query));
  }, [requests, search]);

  return (
    <section className="purchase-po-direct-pr-list">
      <header>
        <div className="purchase-po-direct-pr-title">
          <span><ClipboardList size={18} /></span>
          <div><h2>Approved Existing-item PRs</h2><p>RFQ is not required. Select PRs with a preferred supplier to prepare direct purchase-order drafts.</p></div>
        </div>
        <div className="purchase-po-direct-pr-actions">
          <em>{requests.length} direct PO {requests.length === 1 ? "request" : "requests"}</em>
          <button type="button" className="purchase-secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          <button type="button" className="purchase-primary-button" onClick={onPrepare} disabled={!selectedIds.length || preparing}><ShoppingBag size={15} /> {preparing ? "Preparing..." : `Prepare PO Drafts (${selectedIds.length})`}</button>
        </div>
      </header>

      <div className="purchase-po-direct-pr-filter">
        <label className="purchase-input-with-icon"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PR number, item or supplier" /></label>
        <span>{selectedIds.length} selected</span>
      </div>

      {error && <div className="marketing-form-alert error" role="alert">{error}</div>}
      {loading ? <div className="purchase-po-approval-empty">Loading approved existing-item PRs...</div> : (
        <div className="purchase-po-direct-pr-table-wrap">
          <table className="purchase-po-direct-pr-table">
            <thead><tr><th>Select</th><th>PR Number</th><th>Requested By</th><th>Department</th><th>Approved Items</th><th>Required Date</th><th>Priority</th><th>Preferred Supplier</th><th>RFQ Status</th><th>Action</th></tr></thead>
            <tbody>{filtered.map((request) => {
              const id = String(request.id);
              const supplierReady = Boolean(request.preferredSupplierId && request.preferredSupplierName);
              return <tr key={id} className={selectedIds.includes(id) ? "selected" : ""}>
                <td><input type="checkbox" checked={selectedIds.includes(id)} disabled={!supplierReady} onChange={() => onToggle(id)} aria-label={`Select ${request.prNumber} for purchase order`} /></td>
                <td><strong>{request.prNumber}</strong><small>Existing Item</small></td>
                <td>{request.requestedBy || "-"}</td>
                <td>{request.department || "-"}</td>
                <td><strong>{Number(request.approvedItemCount || 0)} approved</strong><small>{request.approvedItemSummary || "Approved items"}</small></td>
                <td>{dateLabel(request.requiredDate)}</td>
                <td><span className={`purchase-rfq-pr-priority ${String(request.priority || "low").toLowerCase()}`}>{String(request.priority || "Low").toLowerCase().replace(/^./, (value) => value.toUpperCase())}</span></td>
                <td>{supplierReady ? <><strong>{request.preferredSupplierName}</strong><small>{request.preferredSupplierCode || ""}</small></> : <span className="purchase-po-supplier-required">Supplier required</span>}</td>
                <td><span className="purchase-po-rfq-not-required">Not Required</span></td>
                <td><button type="button" className="purchase-po-view-button" onClick={() => onView(request)}><Eye size={13} /> View PR</button></td>
              </tr>;
            })}</tbody>
          </table>
          {!filtered.length && <div className="purchase-po-approval-empty">No approved existing-item PRs match the search.</div>}
        </div>
      )}
    </section>
  );
}
