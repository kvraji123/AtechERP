import { Eye, FilePlus2, FileSearch, FileText, RadioTower, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseRequestViewDialog from "./components/PurchaseRequestViewDialog";
import RfqPurchaseRequestDashboard from "./components/RfqPurchaseRequestDashboard";
import RfqPurchaseRequestFilters from "./components/RfqPurchaseRequestFilters";
import RfqPurchaseRequestTable from "./components/RfqPurchaseRequestTable";
import { mapApiRfqPurchaseRequest, type ApiPurchaseRequisitionRow, type RfqPurchaseRequest } from "./purchaseRfqRequests";
import "./PurchaseFlow.css";

type RfqDraft = { id: number; enquiryNumber: string; enquiryDate: string; quoteDueDate: string; subject?: string | null; status: "DRAFT"; supplierCount: number; itemCount: number };
type RfqDocument = { rfqDocumentId: number; supplierId: number; supplierName: string; fileName: string; fileUrl: string; generatedAt: string };
type RfqDetail = Record<string, unknown> & { items?: Array<Record<string, unknown>>; suppliers?: Array<Record<string, unknown>>; documents?: RfqDocument[] };

const displayDate = (value?: string | null) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "-";

export default function CreateRfqQueuePage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [stage, setStage] = useState<"REQUESTS" | "DRAFTS">("REQUESTS");
  const [requests, setRequests] = useState<RfqPurchaseRequest[]>([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, rfqEligible: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [viewRequest, setViewRequest] = useState<RfqPurchaseRequest | null>(null);
  const [drafts, setDrafts] = useState<RfqDraft[]>([]);
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotal, setRequestTotal] = useState(0);
  const [draftPage, setDraftPage] = useState(1);
  const [draftTotal, setDraftTotal] = useState(0);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [viewDraft, setViewDraft] = useState<RfqDetail | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = async (showRefreshMessage = false) => {
    setLoading(true); setError("");
    try {
      const [response, summaryResponse] = await Promise.all([purchaseApi.listRequisitions({ page: requestPage, pageSize: PAGE_SIZE, search, status: status === "ALL" || status === "APPROVED" ? "" : status, department: department === "ALL" ? "" : department, priority: priority === "ALL" ? "" : priority, rfqEligible: status === "APPROVED" ? "true" : "" }), purchaseApi.purchaseRequisitionSummary()]);
      const rows = Array.isArray(response?.data) ? response.data as ApiPurchaseRequisitionRow[] : [];
      setRequests(rows.map(mapApiRfqPurchaseRequest));
      setRequestTotal(Number(response?.meta?.total || 0));
      setSummary(summaryResponse?.data || {});
      setSelectedIds((current) => current.filter((id) => rows.some((row) => String(row.id) === id)));
      if (showRefreshMessage) showSuccess("Purchase request list refreshed from the backend.");
    } catch (loadError) { setRequests([]); setSelectedIds([]); setError(apiMessage(loadError)); }
    finally { setLoading(false); }
  };

  const loadDrafts = async (showRefreshMessage = false) => {
    setDraftLoading(true); setDraftError("");
    try {
      const response = await purchaseApi.listRfqs({ page: draftPage, pageSize: PAGE_SIZE, status: "DRAFT" });
      setDrafts((response?.data || []) as RfqDraft[]);
      setDraftTotal(Number(response?.meta?.total || 0));
      if (showRefreshMessage) showSuccess("RFQ draft list refreshed from the backend.");
    } catch (loadError) { setDrafts([]); setDraftError(apiMessage(loadError)); }
    finally { setDraftLoading(false); }
  };

  useEffect(() => { void loadRequests(); }, [requestPage, search, status, department, priority]);
  useEffect(() => { void loadDrafts(); }, [draftPage]);

  const filtered = requests;

  const selectedRequests = requests.filter((request) => selectedIds.includes(request.id));
  const createRfq = () => {
    const params = new URLSearchParams();
    selectedRequests.forEach((request) => params.append("pr", request.prNumber));
    navigate(`/purchase/enquiries/supplier-assignment?${params.toString()}`);
  };
  const openDraft = async (draft: RfqDraft) => {
    try { const response = await purchaseApi.getRfq(draft.id); setViewDraft(response?.data as RfqDetail); }
    catch (loadError) { setDraftError(apiMessage(loadError)); }
  };
  const queueDraft = async (draft: RfqDraft) => {
    if (!window.confirm(`Add ${draft.enquiryNumber} to the internal email outbox? One pending record will be created for each supplier; no email will be sent yet.`)) return;
    setSendingId(draft.id); setDraftError("");
    try {
      await purchaseApi.sendRfq(draft.id);
      showSuccess(`${draft.enquiryNumber} is ready in the email outbox. No supplier email has been sent.`);
      setViewDraft(null); await loadDrafts();
    } catch (sendError) { setDraftError(apiMessage(sendError)); }
    finally { setSendingId(null); }
  };

  const draftDialog = viewDraft ? <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewDraft(null); }}>
    <section className="purchase-rfq-draft-dialog" role="dialog" aria-modal="true" aria-label="Saved RFQ draft">
      <header><div><h2>{String(viewDraft.enquiry_number || "RFQ Draft")}</h2><p>{String(viewDraft.subject || "RFQ")}</p></div><button type="button" aria-label="Close saved RFQ draft" onClick={() => setViewDraft(null)}><X size={18} /></button></header>
      <div className="purchase-rfq-draft-summary">
        <div><small>RFQ Date</small><strong>{displayDate(String(viewDraft.enquiry_date || ""))}</strong></div>
        <div><small>Due Date</small><strong>{displayDate(String(viewDraft.quote_due_date || ""))}</strong></div>
        <div><small>Delivery location</small><strong>{String(viewDraft.delivery_location || "Not specified")}</strong></div>
        <div><small>Commercial terms</small><strong>{String(viewDraft.commercial_terms || "Not specified")}</strong></div>
      </div>
      <div className="purchase-rfq-draft-body">
        <h3>Supplier RFQ documents</h3>
        <div className="purchase-rfq-draft-suppliers">
          {(viewDraft.documents || []).map((document) => <a key={document.rfqDocumentId} className="purchase-rfq-document-link" href={document.fileUrl} target="_blank" rel="noreferrer"><FileText size={15} /> {document.supplierName} PDF</a>)}
          {!(viewDraft.documents || []).length && <span>No supplier PDF has been generated.</span>}
        </div>
        <h3>Supplier-wise RFQ items</h3>
        <div className="purchase-rfq-pr-table-wrap"><table className="purchase-rfq-pr-table"><thead><tr><th>Item</th><th>Specification</th><th>Quantity</th><th>UOM</th></tr></thead><tbody>{(viewDraft.items || []).map((item, index) => <tr key={String(item.purchase_enquiry_item_id || index)}><td>{String(item.item_description || item.item_type_name || "-")}</td><td>{String(item.item_specification || "-")}</td><td>{String(item.enquiry_quantity || "-")}</td><td>{String(item.uom_code || "-")}</td></tr>)}</tbody></table></div>
        <h3>Assigned suppliers</h3>
        <div className="purchase-rfq-draft-suppliers">{Array.from(new Map((viewDraft.suppliers || []).map((supplier) => [String(supplier.supplier_id), supplier])).values()).map((supplier) => <span key={String(supplier.supplier_id)}>{String(supplier.supplierName || supplier.supplier_email || "Supplier")}</span>)}</div>
      </div>
      <footer><button type="button" className="purchase-secondary-button" onClick={() => setViewDraft(null)}>Close</button><button type="button" className="purchase-primary-button" disabled={sendingId === Number(viewDraft.purchase_enquiry_id)} onClick={() => { const draft = drafts.find((entry) => entry.id === Number(viewDraft.purchase_enquiry_id)); if (draft) void queueDraft(draft); }}><Send size={14} /> Add to Email Outbox</button></footer>
    </section>
  </div> : null;

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-back-button"><FileSearch size={19} /></span><div><p>Purchase / Supplier Enquiry</p><h1>Create RFQ</h1><span>Create a new RFQ from approved PRs or reopen a saved RFQ draft.</span></div></div></header>
    <PurchaseModuleTabs />
    <div className="purchase-rfq-stage-tabs" role="tablist" aria-label="Create RFQ workspace"><button type="button" role="tab" aria-selected={stage === "REQUESTS"} className={stage === "REQUESTS" ? "active" : ""} onClick={() => setStage("REQUESTS")}><FilePlus2 size={15} /> Approved PRs</button><button type="button" role="tab" aria-selected={stage === "DRAFTS"} className={stage === "DRAFTS" ? "active" : ""} onClick={() => setStage("DRAFTS")}><FileSearch size={15} /> RFQ Drafts <span>{draftTotal}</span></button></div>
    {stage === "REQUESTS" ? <div className="purchase-rfq-pr-page">
      <RfqPurchaseRequestDashboard summary={summary} status={status} onStatusChange={(value) => { setStatus(value); setRequestPage(1); }} />
      <section className="purchase-rfq-pr-list"><header><div><h2>Purchase Request List</h2><p>Approved and partially approved PRs can be selected or combined into one RFQ.</p></div><div className="purchase-list-head-actions"><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/rfqs")}><RadioTower size={15} /> View RFQ Tracking</button><span>{selectedIds.length} approved {selectedIds.length === 1 ? "PR" : "PRs"} selected</span><button type="button" className="purchase-primary-button" disabled={!selectedIds.length} onClick={createRfq}><FilePlus2 size={16} /> Create RFQ for Selected PRs ({selectedIds.length})</button></div></header>
      <RfqPurchaseRequestFilters requests={requests} search={search} status={status} department={department} priority={priority} onSearchChange={(value) => { setSearch(value); setRequestPage(1); }} onStatusChange={(value) => { setStatus(value); setRequestPage(1); }} onDepartmentChange={(value) => { setDepartment(value); setRequestPage(1); }} onPriorityChange={(value) => { setPriority(value); setRequestPage(1); }} onRefresh={() => { void loadRequests(true); }}  pagination={<Pagination page={requestPage} total={requestTotal} onPageChange={setRequestPage} itemLabel="purchase requests" disabled={loading}/>} />
      {error && <div className="marketing-form-alert error" role="alert">{error}</div>}
      {loading ? <div className="purchase-po-approval-empty">Loading purchase requests...</div> : <RfqPurchaseRequestTable requests={filtered} selectedIds={selectedIds} onToggle={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])} onToggleAll={(selected) => { const eligibleIds = filtered.filter((request) => (request.status === "APPROVED" || request.status === "PARTIALLY_APPROVED") && request.rfqStatus === "NOT_CREATED").map((request) => request.id); setSelectedIds((current) => selected ? Array.from(new Set([...current, ...eligibleIds])) : current.filter((id) => !eligibleIds.includes(id))); }} onView={setViewRequest} onViewRfqs={(request) => navigate(`/purchase/rfqs?pr=${encodeURIComponent(request.prNumber)}`)} />}
      
      </section>
      <div className="purchase-enquiry-note"><FileSearch size={17} /><div><strong>RFQ eligibility</strong><span>Only approved line items are fetched from approved or partially approved PRs. Returned, rejected and pending lines remain unavailable.</span></div></div>
    </div> : <section className="purchase-rfq-pr-list purchase-rfq-drafts-list">
      <header className="app-list-toolbar"><div><h2>RFQ Drafts</h2><p>Each saved RFQ has a stored supplier-specific PDF. Adding it to the email outbox does not send an email.</p></div><div className="purchase-list-head-actions"><span>{draftTotal} drafts</span><button type="button" className="purchase-secondary-button" onClick={() => { void loadDrafts(true); }}>Refresh</button><Pagination page={draftPage} total={draftTotal} onPageChange={setDraftPage} itemLabel="RFQ drafts" disabled={draftLoading}/></div></header>
      {draftError && <div className="marketing-form-alert error" role="alert">{draftError}</div>}
      {draftLoading ? <div className="purchase-po-approval-empty">Loading RFQ drafts...</div> : !drafts.length ? <div className="purchase-po-approval-empty">No RFQ drafts are waiting to be queued.</div> : <div className="purchase-rfq-pr-table-wrap"><table className="purchase-rfq-pr-table purchase-rfq-drafts-table"><thead><tr><th>RFQ Number</th><th>Subject</th><th>RFQ Date</th><th>Due Date</th><th>Suppliers</th><th>Items</th><th>Status</th><th>Action</th></tr></thead><tbody>{drafts.map((draft) => <tr key={draft.id}><td><strong>{draft.enquiryNumber}</strong></td><td>{draft.subject || "RFQ"}</td><td>{displayDate(draft.enquiryDate)}</td><td>{displayDate(draft.quoteDueDate)}</td><td>{draft.supplierCount}</td><td>{draft.itemCount}</td><td><span className="purchase-rfq-pr-status pending">Draft</span></td><td><div className="purchase-rfq-draft-actions"><button type="button" className="purchase-secondary-button" onClick={() => { void openDraft(draft); }}><Eye size={14} /> View PDF</button><button type="button" className="purchase-primary-button" disabled={sendingId === draft.id} onClick={() => { void queueDraft(draft); }}><Send size={14} /> {sendingId === draft.id ? "Queueing..." : "Add to Outbox"}</button></div></td></tr>)}</tbody></table></div>}
      
    </section>}
    <PurchaseRequestViewDialog request={viewRequest} onClose={() => setViewRequest(null)} />
    {draftDialog}
  </div>;
}
