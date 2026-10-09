import { CheckCircle2, CircleAlert, ClipboardList, Clock3, Edit3, Eye, FilePlus2, Search, ThumbsDown, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import "./PurchaseFlow.css";

type StatusFilter = "ALL" | "PARTIALLY_APPROVED" | "CLARIFICATION" | "REJECTED" | "APPROVED";
type RequestRow = {
  id: number; prNumber: string; department: string; requestedBy: string; requiredDate: string; priority: string; status: string; itemCount: number | string;
  requisitionType?: "NEW_ITEM" | "EXISTING_ITEM" | null;
  preferredSupplierName?: string | null; preferredSupplierCode?: string | null;
  itemSummary?: string | null; approvedItemCount?: number | string; pendingItemCount?: number | string; rejectedItemCount?: number | string; clarificationItemCount?: number | string;
};
type RequestDetail = Record<string, unknown> & { items?: Array<Record<string, unknown>> };

const number = (value: unknown) => Number(value || 0);
const displayDate = (value: unknown) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "-";
const label = (status: string) => ({ APPROVED: "Fully approved", PARTIALLY_APPROVED: "Partially approved", RETURNED: "Clarification required", REJECTED: "Rejected", DRAFT: "Draft", SUBMITTED: "Pending approval", PENDING_APPROVAL: "Pending approval", CANCELLED: "Cancelled" }[status] || status.replace(/_/g, " ").toLowerCase());
const canAssignSupplier = (row: RequestRow) => row.requisitionType === "NEW_ITEM" && (row.status === "APPROVED" || row.status === "PARTIALLY_APPROVED");

export default function PurchaseRequestListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, partiallyApproved: 0, clarification: 0, rejected: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [card, setCard] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { const [response, summaryResponse] = await Promise.all([purchaseApi.listRequisitions({ page, pageSize: PAGE_SIZE, search, status: card === "ALL" || card === "CLARIFICATION" ? "" : card, clarificationOnly: card === "CLARIFICATION" ? "true" : "", department: department === "ALL" ? "" : department, priority: priority === "ALL" ? "" : priority }), purchaseApi.purchaseRequisitionSummary()]); setRows((response?.data || []) as RequestRow[]); setTotal(Number(response?.meta?.total || 0)); setSummary(summaryResponse?.data || {}); }
    catch (loadError) { setRows([]); setError(apiMessage(loadError)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [page, search, card, department, priority]);

  const openDetail = async (id: number) => {
    setDetailError("");
    try { const response = await purchaseApi.getRequisition(id); setDetail(response?.data as RequestDetail); }
    catch (loadError) { setDetailError(apiMessage(loadError)); }
  };

  const departments = useMemo(() => Array.from(new Set(rows.map((row) => row.department).filter(Boolean))).sort(), [rows]);
  const priorities = useMemo(() => Array.from(new Set(rows.map((row) => String(row.priority || "").toUpperCase()).filter(Boolean))).sort(), [rows]);
  const statusCounts = {
    ALL: Number(summary.total || 0),
    PARTIALLY_APPROVED: Number(summary.partiallyApproved || 0),
    CLARIFICATION: Number(summary.clarification || 0),
    REJECTED: Number(summary.rejected || 0),
    APPROVED: Number(summary.approved || 0),
  };
  const filteredRows = rows;

  const cards: Array<{ id: StatusFilter; label: string; icon: JSX.Element }> = [
    { id: "ALL", label: "All requests", icon: <ClipboardList size={19} /> },
    { id: "PARTIALLY_APPROVED", label: "Partially approved", icon: <Clock3 size={19} /> },
    { id: "CLARIFICATION", label: "Clarification required", icon: <CircleAlert size={19} /> },
    { id: "REJECTED", label: "Rejected", icon: <ThumbsDown size={19} /> },
    { id: "APPROVED", label: "Fully approved", icon: <CheckCircle2 size={19} /> },
  ];

  const detailDialog = detail ? <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><section className="purchase-pr-status-detail-dialog" role="dialog" aria-modal="true" aria-label="Purchase request details"><header><div><h2>{String(detail.pr_number || "Purchase Request")}</h2><p>Requester-facing, read-only status details</p></div><button type="button" className="purchase-dialog-close" aria-label="Close purchase request details" onClick={() => setDetail(null)}><X size={18} /></button></header><div className="purchase-pr-status-detail-summary"><div><small>Department</small><strong>{String(detail.floor_department || "-")}</strong></div><div><small>Supplier</small><strong>{String(detail.preferred_supplier_name || "Not selected")}</strong></div><div><small>Priority</small><strong>{String(detail.priority || "-")}</strong></div><div><small>Required date</small><strong>{displayDate(detail.required_date)}</strong></div><div><small>Request status</small><span className={`purchase-request-status-badge ${String(detail.pr_status || "").toLowerCase().replace(/_/g, "-")}`}>{label(String(detail.pr_status || ""))}</span></div></div><div className="purchase-request-status-table-wrap"><table><thead><tr><th>Item</th><th>Requested qty</th><th>Approved qty</th><th>Line status</th><th>Reason / clarification</th></tr></thead><tbody>{(detail.items || []).map((item, index) => <tr key={String(item.purchase_request_item_id || index)}><td><strong>{String(item.item_description || "-")}</strong><small>{String(item.item_specification || "")}</small></td><td>{String(item.requested_quantity || "-")} {String(item.uom_code || "")}</td><td>{item.approved_quantity === null || item.approved_quantity === undefined ? "-" : `${String(item.approved_quantity)} ${String(item.uom_code || "")}`}</td><td><span className={`purchase-request-status-badge ${String(item.approval_status || "").toLowerCase().replace(/_/g, "-")}`}>{label(String(item.approval_status || ""))}</span></td><td>{String(item.approval_reason || "-")}</td></tr>)}</tbody></table></div><footer><button type="button" className="purchase-primary-button" onClick={() => setDetail(null)}>Close</button></footer></section></div> : null;

  return <div className="purchase-page purchase-request-list-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-page-module-icon"><ClipboardList size={19} /></span><div><p>Purchase / Requisitions</p><h1>Purchase Request Status</h1><span>Track your requests and take action where it is needed.</span></div></div><button type="button" className="purchase-primary-button" onClick={() => navigate("/purchase/requests/new")}><FilePlus2 size={16} /> New Purchase Request</button></header>
    <PurchaseModuleTabs activeIndex={0} />
    <section className="purchase-request-status-cards" aria-label="Purchase request status filters">{cards.map((entry) => <button type="button" key={entry.id} className={card === entry.id ? "active" : ""} onClick={() => { setCard(entry.id); setPage(1); }}><span>{entry.icon}</span><small>{entry.label}</small><strong>{statusCounts[entry.id]}</strong></button>)}</section>
    <section className="purchase-request-status-list">
      <div className="purchase-request-status-filters app-list-toolbar"><label><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search PR number, item or supplier" /></label><select value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}><option value="ALL">All departments</option>{departments.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select><select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}><option value="ALL">All priorities</option>{priorities.map((entry) => <option key={entry} value={entry}>{entry.charAt(0) + entry.slice(1).toLowerCase()}</option>)}</select>
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="purchase requests" disabled={loading} />
      </div>
      {(error || detailError) && <div className="marketing-form-alert error" role="alert">{error || detailError}</div>}
      {loading ? <div className="purchase-po-approval-empty">Loading purchase requests...</div> : !filteredRows.length ? <div className="purchase-po-approval-empty">No purchase requests match the selected filters.</div> : <div className="purchase-request-status-table-wrap"><table><thead><tr><th>PR number</th><th>Request Type</th><th>Supplier</th><th>Department</th><th>Items / line status</th><th>Required date</th><th>Request status</th><th>Action</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td><strong>{row.prNumber}</strong><small>{row.requestedBy || "Requester"}</small></td><td>{row.requisitionType === "NEW_ITEM" ? "New" : row.requisitionType === "EXISTING_ITEM" ? "Existing" : "-"}</td><td><strong>{row.preferredSupplierName || "Not selected"}</strong>{row.preferredSupplierCode && <small>{row.preferredSupplierCode}</small>}</td><td>{row.department || "-"}</td><td><strong>{number(row.itemCount)} item{number(row.itemCount) === 1 ? "" : "s"}</strong><small>{number(row.approvedItemCount)} approved · {number(row.pendingItemCount)} pending · {number(row.clarificationItemCount)} clarification · {number(row.rejectedItemCount)} rejected</small></td><td>{displayDate(row.requiredDate)}</td><td><span className={`purchase-request-status-badge ${String(row.status || "").toLowerCase().replace(/_/g, "-")}`}>{label(String(row.status || ""))}</span></td><td>{row.status === "DRAFT" ? <button type="button" className="purchase-secondary-button" onClick={() => navigate(`/purchase/requests/new?prId=${row.id}`)}><Edit3 size={14} /> Edit draft</button> : <button type="button" className="purchase-secondary-button" onClick={() => { void openDetail(row.id); }}><Eye size={14} /> View</button>}{canAssignSupplier(row) && <button type="button" className="purchase-secondary-button" onClick={() => navigate(`/purchase/enquiries/supplier-assignment?pr=${encodeURIComponent(row.prNumber)}`)}><UserPlus size={14} /> Add supplier</button>}{(row.status === "RETURNED" || number(row.clarificationItemCount) > 0) && <button type="button" className="purchase-secondary-button" onClick={() => navigate(`/purchase/requests/new?prId=${row.id}`)}><Edit3 size={14} /> Update & resubmit</button>}</td></tr>)}</tbody></table></div>}
      
    </section>
    {detailDialog}
  </div>;
}
