import { Eye, RadioTower, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ApiPurchaseRequisitionRow } from "../purchaseRfqRequests";

type PurchaseRequestKind = "EXISTING_ITEM" | "NEW_ITEM";

type Props = {
  kind: PurchaseRequestKind;
  requests: ApiPurchaseRequisitionRow[];
  selectedIds?: string[];
  loading: boolean;
  error: string;
  onToggle?: (id: string) => void;
  onRefresh: () => void;
  onView: (request: ApiPurchaseRequisitionRow) => void;
  onOpenRfq: (request: ApiPurchaseRequisitionRow) => void;
};

const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value);
};

const priorityLabel = (value?: string | null) => {
  const normalized = String(value || "LOW").toLowerCase();
  return normalized.replace(/^./, (character) => character.toUpperCase());
};

const rfqLabel = (value?: string | null) => {
  const normalized = String(value || "NOT_CREATED").toUpperCase();
  if (normalized === "CREATED") return "RFQ Created";
  if (normalized === "NOT_REQUIRED") return "Not Required";
  return "RFQ Required";
};

export default function PurchaseOrderApprovedPrTab({ kind, requests, selectedIds = [], loading, error, onToggle, onRefresh, onView, onOpenRfq }: Props) {
  const [search, setSearch] = useState("");
  const existingItem = kind === "EXISTING_ITEM";
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => [
      request.prNumber,
      request.requestedBy,
      request.department,
      request.approvedItemSummary,
      request.preferredSupplierName,
      request.preferredSupplierCode,
      request.rfqStatus,
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [requests, search]);

  return <div className="purchase-order-workspace-pr-panel">
    <div className="purchase-order-workspace-pr-filter">
      <label className="purchase-order-workspace-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search PR number, item, requester or supplier"
          aria-label="Search approved purchase requests"
        />
      </label>
      {existingItem && <span>{selectedIds.length} selected</span>}
      <button type="button" className="purchase-secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} /> Refresh</button>
    </div>

    {error && <p className="purchase-order-list-error" role="alert">{error}</p>}
    <div className="purchase-po-direct-pr-table-wrap">
      <table className="purchase-po-direct-pr-table">
        <thead><tr>{existingItem && <th>Select</th>}<th>PR Number</th><th>Requested By</th><th>Department</th><th>Approved Items</th><th>Required Date</th><th>Priority</th>{existingItem ? <><th>Preferred Supplier</th><th>Route Status</th></> : <><th>RFQ Status</th><th>PO Readiness</th></>}<th>Action</th></tr></thead>
        <tbody>{filtered.map((request) => {
          const id = String(request.id);
          const supplierReady = Boolean(request.preferredSupplierId && request.preferredSupplierName);
          const rfqCreated = String(request.rfqStatus || "").toUpperCase() === "CREATED";
          return <tr key={id} className={selectedIds.includes(id) ? "selected" : ""}>
            {existingItem && <td><input type="checkbox" checked={selectedIds.includes(id)} disabled={!supplierReady} onChange={() => onToggle?.(id)} aria-label={`Select ${request.prNumber} for purchase order`} /></td>}
            <td><strong>{request.prNumber}</strong><small>{existingItem ? "Existing Item" : "New Item"}</small></td>
            <td>{request.requestedBy || "—"}</td>
            <td>{request.department || "—"}</td>
            <td><strong>{Number(request.approvedItemCount || 0)} approved</strong><small>{request.approvedItemSummary || "Approved items"}</small></td>
            <td>{dateLabel(request.requiredDate)}</td>
            <td><span className={`purchase-rfq-pr-priority ${String(request.priority || "low").toLowerCase()}`}>{priorityLabel(request.priority)}</span></td>
            {existingItem ? <>
              <td>{supplierReady ? <><strong>{request.preferredSupplierName}</strong><small>{request.preferredSupplierCode || ""}</small></> : <span className="purchase-po-supplier-required">Supplier required</span>}</td>
              <td><span className="purchase-po-rfq-not-required">Direct PO</span></td>
            </> : <>
              <td><span className={`purchase-order-pr-route-status ${rfqCreated ? "created" : "required"}`}>{rfqLabel(request.rfqStatus)}</span></td>
              <td><span className={`purchase-order-pr-readiness ${String(request.poReadiness || "PENDING").toUpperCase() === "CREATED" ? "created" : ""}`}>{String(request.poReadiness || "PENDING").toUpperCase() === "CREATED" ? "PO created" : rfqCreated ? "Supplier selection pending" : "Complete RFQ first"}</span></td>
            </>}
            <td><div className="purchase-order-row-actions"><button type="button" onClick={() => onView(request)}><Eye size={13} /> View PR</button>{!existingItem && <button type="button" onClick={() => onOpenRfq(request)}><RadioTower size={13} /> {rfqCreated ? "Track RFQ" : "Create RFQ"}</button>}</div></td>
          </tr>;
        })}</tbody>
      </table>
      {loading && <div className="purchase-po-approval-empty">Loading approved purchase requests…</div>}
      {!loading && !filtered.length && <div className="purchase-po-approval-empty">No approved {existingItem ? "existing-item" : "new-item"} PRs match the search.</div>}
    </div>
  </div>;
}
