import { BadgeCheck, Clock3, Eye, FilePenLine, FilePlus2, PackageCheck, Pencil, RefreshCw, Search, Send, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi, type PurchaseOrderDetail, type PurchaseOrderListRow } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseOrderApprovedPrTab from "./components/PurchaseOrderApprovedPrTab";
import PurchaseOrderFullViewDialog from "./components/PurchaseOrderFullViewDialog";
import PurchaseRequestViewDialog from "./components/PurchaseRequestViewDialog";
import { mapApiRfqPurchaseRequest, type ApiPurchaseRequisitionRow, type RfqPurchaseRequest } from "./purchaseRfqRequests";
import "./PurchaseFlow.css";

type StatusFilter = "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "PARTIALLY_RECEIVED";
type SourceFilter = "ALL" | "DIRECT" | "RFQ";
type WorkspaceView = "EXISTING_PRS" | "NEW_PRS" | "PURCHASE_ORDERS";
type PurchaseRequestDetail = {
  items?: Array<{
    purchase_request_item_id?: number | string;
    purchaseRequestItemId?: number | string;
    approval_status?: string;
    approvalStatus?: string;
  }>;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
};

const statusLabel = (status: string) => ({
  DRAFT: "Draft",
  RETURNED: "Returned",
  SUBMITTED: "Pending Approval",
  APPROVED: "Approved",
  PARTIALLY_RECEIVED: "Partial Receipt",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
}[status] || status.replace(/_/g, " "));

const sourceKind = (reference: string): Exclude<SourceFilter, "ALL"> => /RFQ|PE\//i.test(reference) ? "RFQ" : "DIRECT";

export default function PurchaseOrderListPage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [records, setRecords] = useState<PurchaseOrderListRow[]>([]);
  const [summary, setSummary] = useState({ draft: 0, pending: 0, approved: 0, partial: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [supplier, setSupplier] = useState("ALL");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("PURCHASE_ORDERS");
  const [purchaseRequests, setPurchaseRequests] = useState<ApiPurchaseRequisitionRow[]>([]);
  const [purchaseRequestsLoading, setPurchaseRequestsLoading] = useState(true);
  const [purchaseRequestsError, setPurchaseRequestsError] = useState("");
  const [selectedExistingPrIds, setSelectedExistingPrIds] = useState<string[]>([]);
  const [creatingDirectPo, setCreatingDirectPo] = useState(false);
  const [viewRequest, setViewRequest] = useState<RfqPurchaseRequest | null>(null);

  const loadRecords = async (notify = false) => {
    setLoading(true);
    setError("");
    try {
      const [response, summaryResponse] = await Promise.all([purchaseApi.listPurchaseOrders({ page, pageSize: PAGE_SIZE, search, status: status === "ALL" ? "" : status, source: source === "ALL" ? "" : source, supplier: supplier === "ALL" ? "" : supplier }), purchaseApi.purchaseOrderSummary()]);
      setRecords(Array.isArray(response?.data) ? response.data as PurchaseOrderListRow[] : []);
      setTotal(Number(response?.meta?.total || 0));
      setSummary(summaryResponse?.data || {});
      if (notify) showSuccess("Purchase order list refreshed.");
    } catch (loadError) {
      setRecords([]);
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseRequests = async (notify = false) => {
    setPurchaseRequestsLoading(true);
    setPurchaseRequestsError("");
    try {
      const response = await purchaseApi.listRequisitions({ page: 1, pageSize: 100 });
      const rows = Array.isArray(response?.data) ? response.data as ApiPurchaseRequisitionRow[] : [];
      setPurchaseRequests(rows);
      if (notify) showSuccess("Approved purchase requests refreshed.");
    } catch (loadError) {
      setPurchaseRequests([]);
      setSelectedExistingPrIds([]);
      setPurchaseRequestsError(apiMessage(loadError));
    } finally {
      setPurchaseRequestsLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, [page, search, status, source, supplier]);
  useEffect(() => {
    void loadPurchaseRequests();
    void purchaseApi.listPurchaseOrderSuppliers()
      .then((response) => setSuppliers(Array.isArray(response?.data) ? response.data.filter(Boolean) : []))
      .catch((reason) => setError(apiMessage(reason)));
  }, []);
  const filtered = records;

  const counts = summary;

  const approvedPurchaseRequests = useMemo(() => purchaseRequests.filter((request) =>
    ["APPROVED", "PARTIALLY_APPROVED"].includes(String(request.status || "").toUpperCase())
    && Number(request.approvedItemCount || 0) > 0
  ), [purchaseRequests]);

  const existingItemRequests = useMemo(() => {
    const activeDirectSources = records
      .filter((record) => !["CANCELLED", "REJECTED"].includes(String(record.status || "").toUpperCase()))
      .map((record) => String(record.sourceReference || ""));
    return approvedPurchaseRequests.filter((request) =>
      String(request.requisitionType || "").toUpperCase() === "EXISTING_ITEM"
      && !activeDirectSources.some((reference) => reference.includes(request.prNumber))
    );
  }, [approvedPurchaseRequests, records]);

  const newItemRequests = useMemo(() => approvedPurchaseRequests.filter((request) =>
    String(request.requisitionType || "").toUpperCase() === "NEW_ITEM"
  ), [approvedPurchaseRequests]);

  useEffect(() => {
    setSelectedExistingPrIds((current) => current.filter((id) => existingItemRequests.some((request) => String(request.id) === id)));
  }, [existingItemRequests]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await purchaseApi.getPurchaseOrder(id);
      setDetail(response?.data as PurchaseOrderDetail);
    } catch (viewError) {
      setError(apiMessage(viewError));
    } finally {
      setDetailLoading(false);
    }
  };

  const submitOrder = async (record: PurchaseOrderListRow) => {
    setSubmittingId(record.id);
    setError("");
    try {
      await purchaseApi.submitPurchaseOrder(record.id);
      showSuccess(`${record.poNumber} submitted for approval.`);
      await loadRecords();
    } catch (submitError) {
      setError(apiMessage(submitError));
    } finally {
      setSubmittingId(null);
    }
  };

  const toggleExistingRequest = (id: string) => {
    setSelectedExistingPrIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  };

  const openRfqRoute = (request: ApiPurchaseRequisitionRow) => {
    const rfqCreated = String(request.rfqStatus || "").toUpperCase() === "CREATED";
    navigate(rfqCreated ? "/purchase/rfqs" : "/purchase/enquiries/new");
  };

  const createPurchaseOrder = async () => {
    if (workspaceView === "EXISTING_PRS") {
      if (!selectedExistingPrIds.length) return;
      setCreatingDirectPo(true);
      setPurchaseRequestsError("");
      try {
        const details = await Promise.all(selectedExistingPrIds.map(async (id) => {
          const response = await purchaseApi.getRequisition(id);
          return response?.data as PurchaseRequestDetail;
        }));
        const purchaseRequestItemIds = details.flatMap((detail) => (detail.items || [])
          .filter((item) => String(item.approval_status || item.approvalStatus || "").toUpperCase() === "APPROVED")
          .map((item) => Number(item.purchase_request_item_id || item.purchaseRequestItemId || 0))
          .filter(Boolean));
        if (!purchaseRequestItemIds.length) throw new Error("No approved line items are available for the selected PRs.");
        const response = await purchaseApi.generatePurchaseOrders({ purchaseRequestItemIds });
        const created = Array.isArray(response?.data) ? response.data : [];
        const createdCount = created.length || 1;
        const firstDraftId = Number(created[0]?.purchase_order_id || created[0]?.id || 0);
        showSuccess(`${createdCount} purchase-order ${createdCount === 1 ? "draft" : "drafts"} created successfully.`);
        setSelectedExistingPrIds([]);
        if (firstDraftId) {
          navigate(`/purchase/orders/new?poId=${firstDraftId}`);
        } else {
          await Promise.all([loadRecords(), loadPurchaseRequests()]);
          setStatus("DRAFT");
          setWorkspaceView("PURCHASE_ORDERS");
        }
      } catch (createError) {
        setPurchaseRequestsError(apiMessage(createError));
      } finally {
        setCreatingDirectPo(false);
      }
      return;
    }
    navigate(workspaceView === "NEW_PRS" ? "/purchase/orders/new?source=new" : "/purchase/orders/new");
  };

  const workspaceCount = workspaceView === "EXISTING_PRS"
    ? existingItemRequests.length
    : workspaceView === "NEW_PRS"
      ? newItemRequests.length
      : filtered.length;
  const createDisabled = workspaceView === "EXISTING_PRS" && !selectedExistingPrIds.length;

  const cards = [
    { key: "DRAFT" as StatusFilter, label: "Draft POs", value: counts.draft, icon: FilePenLine, tone: "red" },
    { key: "SUBMITTED" as StatusFilter, label: "Pending Approval", value: counts.pending, icon: Clock3, tone: "orange" },
    { key: "APPROVED" as StatusFilter, label: "Approved POs", value: counts.approved, icon: BadgeCheck, tone: "green" },
    { key: "PARTIALLY_RECEIVED" as StatusFilter, label: "Partial Receipt", value: counts.partial, icon: PackageCheck, tone: "purple" },
  ];

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-page-module-icon purchase-po-title-icon"><ShoppingBag size={17} /></span><div><p>Purchase / Purchase Order</p><h1>Purchase Orders</h1><span>View, create and track supplier-wise purchase orders</span></div></div></header>
    <PurchaseModuleTabs />
    <div className="purchase-order-list-page">
      <section className="purchase-order-list-dashboard" aria-label="Purchase order summary">
        {cards.map(({ key, label, value, icon: Icon, tone }) => <button type="button" key={key} className={`${tone} ${workspaceView === "PURCHASE_ORDERS" && status === key ? "active" : ""}`} onClick={() => { setWorkspaceView("PURCHASE_ORDERS"); setPage(1); setStatus((current) => workspaceView === "PURCHASE_ORDERS" && current === key ? "ALL" : key); }}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></button>)}
          <button type="button" className={`blue ${workspaceView === "NEW_PRS" ? "active" : ""}`} onClick={() => setWorkspaceView("NEW_PRS")}><span><Sparkles size={18} /></span><div><small>Approved PRs — New Item</small><strong>{newItemRequests.length}</strong></div></button>
          <button type="button" className={`cyan ${workspaceView === "EXISTING_PRS" ? "active" : ""}`} onClick={() => setWorkspaceView("EXISTING_PRS")}><span><PackageCheck size={18} /></span><div><small>Approved PRs — Existing Item</small><strong>{existingItemRequests.length}</strong></div></button>
      </section>

      <section className="purchase-order-list-section purchase-order-workspace-section">
        <header><div><h2>Purchase Order Workspace</h2><p>Approved PR sources and created purchase orders are available in one tabbed view.</p></div><div className="purchase-order-list-head-actions"><span>{workspaceCount} records</span><button type="button" className="purchase-primary-button" disabled={createDisabled || creatingDirectPo} title={workspaceView === "NEW_PRS" ? "New-item POs use completed supplier-selection decisions." : undefined} onClick={() => { void createPurchaseOrder(); }}><FilePlus2 size={15} /> {creatingDirectPo ? "Creating PO Draft…" : `Create Purchase Order${workspaceView === "EXISTING_PRS" && selectedExistingPrIds.length ? ` (${selectedExistingPrIds.length})` : ""}`}</button></div></header>

        <nav className="purchase-order-workspace-tabs" aria-label="Purchase order workspace views">
          <button type="button" className={workspaceView === "EXISTING_PRS" ? "active" : ""} aria-pressed={workspaceView === "EXISTING_PRS"} onClick={() => setWorkspaceView("EXISTING_PRS")}><PackageCheck size={15} /><span>Approved PRs — Existing Item</span><em>{existingItemRequests.length}</em></button>
          <button type="button" className={workspaceView === "NEW_PRS" ? "active" : ""} aria-pressed={workspaceView === "NEW_PRS"} onClick={() => setWorkspaceView("NEW_PRS")}><Sparkles size={15} /><span>Approved PRs — New Item</span><em>{newItemRequests.length}</em></button>
          <button type="button" className={workspaceView === "PURCHASE_ORDERS" ? "active" : ""} aria-pressed={workspaceView === "PURCHASE_ORDERS"} onClick={() => setWorkspaceView("PURCHASE_ORDERS")}><ShoppingBag size={15} /><span>Purchase Order List</span><em>{records.length}</em></button>
        </nav>

        {workspaceView === "EXISTING_PRS" && <PurchaseOrderApprovedPrTab
          kind="EXISTING_ITEM"
          requests={existingItemRequests}
          selectedIds={selectedExistingPrIds}
          loading={purchaseRequestsLoading}
          error={purchaseRequestsError}
          onToggle={toggleExistingRequest}
          onRefresh={() => { void loadPurchaseRequests(true); }}
          onView={(request) => setViewRequest(mapApiRfqPurchaseRequest(request))}
          onOpenRfq={openRfqRoute}
        />}

        {workspaceView === "NEW_PRS" && <PurchaseOrderApprovedPrTab
          kind="NEW_ITEM"
          requests={newItemRequests}
          loading={purchaseRequestsLoading}
          error={purchaseRequestsError}
          onRefresh={() => { void loadPurchaseRequests(true); }}
          onView={(request) => setViewRequest(mapApiRfqPurchaseRequest(request))}
          onOpenRfq={openRfqRoute}
        />}

        {workspaceView === "PURCHASE_ORDERS" && <>
          <div className="purchase-order-list-filters app-list-toolbar">
            <label className="purchase-order-search"><Search size={15} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search PO, supplier, PR or RFQ" aria-label="Search purchase orders" /></label>
            <select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} aria-label="Filter purchase orders by status"><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Pending Approval</option><option value="APPROVED">Approved</option><option value="PARTIALLY_RECEIVED">Partial Receipt</option></select>
            <select value={source} onChange={(event) => { setSource(event.target.value as SourceFilter); setPage(1); }} aria-label="Filter purchase orders by source"><option value="ALL">All sources</option><option value="DIRECT">Existing-item PR</option><option value="RFQ">RFQ / Comparison</option></select>
            <select value={supplier} onChange={(event) => { setSupplier(event.target.value); setPage(1); }} aria-label="Filter purchase orders by supplier"><option value="ALL">All suppliers</option>{suppliers.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            <button type="button" className="purchase-secondary-button purchase-order-refresh" disabled={loading} onClick={() => { void loadRecords(true); }}><RefreshCw size={14} /> Refresh</button>
          
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="purchase orders" disabled={loading} />
      </div>

          {error && <p className="purchase-order-list-error" role="alert">{error}</p>}
          <div className="purchase-order-list-table-wrap"><table className="purchase-order-list-table"><thead><tr><th>PO Number</th><th>Source Reference</th><th>Supplier</th><th>PO Date</th><th>Expected Delivery</th><th>Items</th><th className="money">Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((record) => {
            const recordStatus = String(record.status || "").toUpperCase();
            return <tr key={record.id}><td><strong>{record.poNumber}</strong><small>Created {formatDate(record.poDate)}</small></td><td><strong className={sourceKind(record.sourceReference || "") === "DIRECT" ? "direct" : ""}>{record.sourceReference || "—"}</strong><small>{sourceKind(record.sourceReference || "") === "DIRECT" ? "Existing item · RFQ not required" : "Quotation comparison"}</small></td><td><strong>{record.supplierName}</strong><small>{record.supplierCode || "—"}</small></td><td>{formatDate(record.poDate)}</td><td>{formatDate(record.expectedDeliveryDate)}</td><td className="text-center">{Number(record.itemCount || 0)}</td><td className="money">{money.format(Number(record.grandTotalAmount || 0))}</td><td><span className={`purchase-order-list-status ${recordStatus.toLowerCase()}`}>{statusLabel(recordStatus)}</span></td><td><div className="purchase-order-row-actions">{["DRAFT", "RETURNED"].includes(recordStatus) && <button type="button" onClick={() => navigate(`/purchase/orders/new?poId=${record.id}`)}><Pencil size={13} /> Edit</button>}{["DRAFT", "RETURNED"].includes(recordStatus) && <button type="button" disabled={submittingId === record.id} onClick={() => { void submitOrder(record); }}><Send size={13} /> {submittingId === record.id ? "Submitting" : "Submit"}</button>}<button type="button" disabled={detailLoading} onClick={() => { void openDetail(record.id); }}><Eye size={13} /> View</button>{recordStatus === "PARTIALLY_RECEIVED" && <button type="button" onClick={() => navigate(`/grn-inward?poId=${record.id}`)}><PackageCheck size={13} /> Track GRN</button>}</div></td></tr>;
          })}</tbody></table>{loading && <div className="purchase-order-list-empty">Loading purchase orders…</div>}{!loading && !filtered.length && <div className="purchase-order-list-empty">No purchase orders match the selected filters.</div>}</div>
          
        </>}
      </section>
    </div>

    {detail && <PurchaseOrderFullViewDialog detail={detail} onClose={() => setDetail(null)} />}
    <PurchaseRequestViewDialog request={viewRequest} onClose={() => setViewRequest(null)} />
  </div>;
}
