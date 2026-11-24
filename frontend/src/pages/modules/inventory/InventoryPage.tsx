import { BadgeCheck, FileText, Handshake, RefreshCw, ShieldAlert, Truck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { inventoryApi, type InventoryDashboard } from "../../../api/inventory.api";
import { customerApi } from "../../../api/customer.api";
import { supplierApi } from "../../../api/supplier.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { formatDate as formatAppDate, formatDateTime, todayInAppTimeZone } from "../../../utils/formatDateTime";
import { useReferenceData } from "../../../hooks/useReferenceData";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import "./InventoryPage.css";

type InventoryRow = Record<string, unknown>;
type ValidationErrors = Record<string, string>;
type PageKind = "dashboard" | "stock" | "transactions" | "quality-hold" | "rejection-inventory" | "reorder-alerts";
type DashboardDestination = "/inventory/stock" | "/inventory/quality-hold" | "/inventory/rejection-inventory" | "/inventory/outsourcing-wip" | "/inventory/customer-material" | "/inventory/reorder-alerts" | "/inventory/transactions" | "/inventory/control";
type DashboardTone = "stock" | "quality-hold" | "rejection-inventory" | "outsourcing-wip" | "customer-material" | "reorder-alerts" | "transactions" | "production-control";

const pageByPath:Record<string,PageKind> = {
  "/inventory":"dashboard", "/inventory/stock":"stock", "/inventory/transactions":"transactions",
  "/inventory/quality-hold":"quality-hold", "/inventory/rejection-inventory":"rejection-inventory",
  "/inventory/reorder-alerts":"reorder-alerts",
};

// Keep dashboard accents aligned with the colour assigned to each Inventory destination.
const dashboardToneByDestination:Record<DashboardDestination,DashboardTone> = {
  "/inventory/stock":"stock",
  "/inventory/quality-hold":"quality-hold",
  "/inventory/rejection-inventory":"rejection-inventory",
  "/inventory/outsourcing-wip":"outsourcing-wip",
  "/inventory/customer-material":"customer-material",
  "/inventory/reorder-alerts":"reorder-alerts",
  "/inventory/transactions":"transactions",
  "/inventory/control":"production-control",
};

const numeric = (value:unknown) => Number(value || 0).toLocaleString("en-IN",{maximumFractionDigits:3});
const text = (value:unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const date = formatAppDate;
const dateTime = formatDateTime;

export default function InventoryPage() {
  const location = useLocation(); const navigate = useNavigate(); const { showSuccess } = useAppFeedback();
  const referenceData = useReferenceData(["TRANSPORT_MODE"]);
  const kind = pageByPath[location.pathname] || "dashboard";
  const grnFilter = useMemo(() => kind === "rejection-inventory" ? new URLSearchParams(location.search).get("grn")?.trim() || "" : "", [kind, location.search]);
  const [dashboard,setDashboard] = useState<InventoryDashboard | null>(null);
  const [rows,setRows] = useState<InventoryRow[]>([]);
  const [search,setSearch] = useState(""); const [warehouse,setWarehouse] = useState(""); const [error,setError] = useState(""); const [loading,setLoading] = useState(true);
  const [page,setPage] = useState(1); const [total,setTotal] = useState(0);
  const [resolving,setResolving] = useState<InventoryRow | null>(null); const [resolutionAction,setResolutionAction] = useState("RETURN_TO_VENDOR"); const [resolutionQuantity,setResolutionQuantity] = useState(""); const [resolutionRemarks,setResolutionRemarks] = useState(""); const [resolutionReference,setResolutionReference] = useState(""); const [releaseWarehouse,setReleaseWarehouse] = useState(""); const [releaseBin,setReleaseBin] = useState(""); const [returnDate,setReturnDate] = useState(""); const [dispatchReference,setDispatchReference] = useState(""); const [transportMode,setTransportMode] = useState(""); const [transportReference,setTransportReference] = useState(""); const [allowedTransportModes,setAllowedTransportModes] = useState<string[]>([]); const [savingResolution,setSavingResolution] = useState(false);
  const [rtvWorkflow,setRtvWorkflow] = useState<InventoryRow | null>(null); const [approvalRemarks,setApprovalRemarks] = useState(""); const [supplierContact,setSupplierContact] = useState(""); const [acknowledgementReference,setAcknowledgementReference] = useState(""); const [savingRtv,setSavingRtv] = useState(false);
  const [resolutionWorkflow,setResolutionWorkflow] = useState<InventoryRow | null>(null); const [workflowApprovalRemarks,setWorkflowApprovalRemarks] = useState(""); const [workflowPartyContact,setWorkflowPartyContact] = useState(""); const [workflowAcknowledgementReference,setWorkflowAcknowledgementReference] = useState(""); const [workflowExecutionReference,setWorkflowExecutionReference] = useState(""); const [workflowCompletionRemarks,setWorkflowCompletionRemarks] = useState(""); const [workflowReinspectionDecision,setWorkflowReinspectionDecision] = useState("ACCEPT_ALL"); const [workflowReinspectionAccepted,setWorkflowReinspectionAccepted] = useState(""); const [workflowReinspectionRejected,setWorkflowReinspectionRejected] = useState(""); const [workflowReinspectionRemarks,setWorkflowReinspectionRemarks] = useState(""); const [workflowReinspectionReason,setWorkflowReinspectionReason] = useState(""); const [workflowStockPostingDate,setWorkflowStockPostingDate] = useState(""); const [workflowStockWarehouse,setWorkflowStockWarehouse] = useState(""); const [workflowStockBin,setWorkflowStockBin] = useState(""); const [workflowStockBatch,setWorkflowStockBatch] = useState(""); const [savingWorkflow,setSavingWorkflow] = useState(false);
  const [validationErrors,setValidationErrors] = useState<ValidationErrors>({});
  const clearValidationErrors = () => setValidationErrors({});

  const load = async (notify=false, searchOverride=search, warehouseOverride=warehouse, pageOverride=page) => {
    try {
      setLoading(true); setError("");
      if (kind === "dashboard") { const response = await inventoryApi.dashboard(); setDashboard(response.data || null); setRows([]); setTotal(0); }
      else {
        const params = { search:searchOverride,warehouse:warehouseOverride,page:pageOverride,pageSize:PAGE_SIZE };
        const response = kind === "stock" ? await inventoryApi.stock(params) : kind === "transactions" ? await inventoryApi.transactions(params) : kind === "quality-hold" ? await inventoryApi.qualityHold({page:pageOverride,pageSize:PAGE_SIZE}) : kind === "rejection-inventory" ? await inventoryApi.rejectionInventory(params) : await inventoryApi.reorderAlerts({page:pageOverride,pageSize:PAGE_SIZE});
        setRows(response.data || []);
        setTotal(Number(response?.meta?.total || 0));
      }
      if (notify) showSuccess("Inventory data refreshed.");
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  };

  useEffect(() => { const nextSearch = grnFilter; setSearch(nextSearch); setWarehouse(""); setPage(1); setResolving(null); setRtvWorkflow(null); setResolutionWorkflow(null); clearValidationErrors(); void load(false, nextSearch, "", 1); },[kind, grnFilter]);
  const warehouses = useMemo(() => Array.from(new Set(rows.map((row) => String(row.warehouseCode || "")).filter(Boolean))).sort(),[rows]);
  const transportOptions = referenceData.options("TRANSPORT_MODE").filter((option) => allowedTransportModes.includes(option.value));
  useEffect(() => {
    const isCustomer = resolutionAction === "RETURN_TO_CUSTOMER";
    const partyId = Number(isCustomer ? resolving?.customerId : resolving?.supplierId);
    if (!partyId) { setAllowedTransportModes([]); setTransportMode(""); return; }
    let active = true;
    const request = isCustomer ? customerApi.getById(partyId) : supplierApi.getById(partyId);
    request.then((response) => { if (active) setAllowedTransportModes(Array.isArray(response?.data?.transportModes) ? response.data.transportModes : []); })
      .catch(() => { if (active) setAllowedTransportModes([]); });
    return () => { active = false; };
  }, [resolving?.customerId, resolving?.supplierId, resolutionAction]);
  const title = kind === "dashboard" ? "Inventory Dashboard" : kind === "stock" ? "Stock Enquiry" : kind === "transactions" ? "Stock Transactions" : kind === "quality-hold" ? "Quality Hold" : kind === "rejection-inventory" ? "Rejection Inventory" : "Reorder Alerts";
  const openResolve = (row:InventoryRow) => { clearValidationErrors(); setResolving(row); setResolutionAction(row.responsibleParty === "CUSTOMER" ? "RETURN_TO_CUSTOMER" : "RETURN_TO_VENDOR"); setResolutionQuantity(String(row.availableQuantity ?? row.quantityOnHand ?? "")); setResolutionRemarks(""); setResolutionReference(""); setReleaseWarehouse(""); setReleaseBin(""); setReturnDate(todayInAppTimeZone()); setDispatchReference(""); setTransportMode(""); setTransportReference(""); };
  const openRtv = (row:InventoryRow) => { clearValidationErrors(); setRtvWorkflow(row); setApprovalRemarks(""); setSupplierContact(String(row.latestRtvSupplierContact || "")); setAcknowledgementReference(String(row.latestRtvAcknowledgementReference || "")); };
  const openResolutionWorkflow = (row:InventoryRow) => { clearValidationErrors(); const reworkQuantity = String(row.latestReworkQuantity || ""); setResolutionWorkflow(row); setWorkflowApprovalRemarks(""); setWorkflowPartyContact(String(row.latestResolutionPartyContact || "")); setWorkflowAcknowledgementReference(String(row.latestResolutionAcknowledgementReference || "")); setWorkflowExecutionReference(String(row.latestResolutionExecutionReference || "")); setWorkflowCompletionRemarks(""); setWorkflowReinspectionDecision("ACCEPT_ALL"); setWorkflowReinspectionAccepted(String(row.latestReworkAcceptedQuantity || reworkQuantity)); setWorkflowReinspectionRejected(String(row.latestReworkRejectedQuantity || "0")); setWorkflowReinspectionRemarks(""); setWorkflowReinspectionReason(""); setWorkflowStockPostingDate(todayInAppTimeZone()); setWorkflowStockWarehouse(""); setWorkflowStockBin(""); setWorkflowStockBatch(""); };
  const selectReinspectionDecision = (decision:string) => { const quantity = Number(resolutionWorkflow?.latestReworkQuantity || 0); setWorkflowReinspectionDecision(decision); if (decision === "ACCEPT_ALL") { setWorkflowReinspectionAccepted(String(quantity)); setWorkflowReinspectionRejected("0"); } if (decision === "REJECT_ALL") { setWorkflowReinspectionAccepted("0"); setWorkflowReinspectionRejected(String(quantity)); } if (decision === "PARTIALLY_ACCEPT") { setWorkflowReinspectionAccepted(""); setWorkflowReinspectionRejected(""); } };
  const validateResolution = () => {
    if (!resolving) return false;
    const nextErrors:ValidationErrors = {};
    const quantity = Number(resolutionQuantity);
    const availableQuantity = Number(resolving.availableQuantity ?? resolving.quantityOnHand ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = "Enter a quantity greater than zero.";
    else if (quantity > availableQuantity) nextErrors.quantity = `Quantity cannot exceed the available rejected quantity (${numeric(availableQuantity)}).`;
    if (!resolutionRemarks.trim()) nextErrors.remarks = "Enter the reason and decision remarks.";
    if (["RETURN_TO_VENDOR","RETURN_TO_CUSTOMER"].includes(resolutionAction) && !returnDate) nextErrors.returnDate = "Select the planned return date.";
    if (["RETURN_TO_VENDOR","RETURN_TO_CUSTOMER"].includes(resolutionAction) && !transportMode) nextErrors.transportMode = "Select the actual transport mode.";
    if (["REWORK","SCRAP","DEVIATION_RELEASE"].includes(resolutionAction) && !resolutionReference.trim()) nextErrors.actionReference = "Enter the required approval or work reference.";
    if (resolutionAction === "DEVIATION_RELEASE" && !releaseWarehouse.trim()) nextErrors.warehouse = "Enter the destination warehouse.";
    if (resolutionAction === "DEVIATION_RELEASE" && !releaseBin.trim()) nextErrors.binLocation = "Enter the destination bin.";
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const validateRtvWorkflow = (action:"approve" | "acknowledge" | "dispatch") => {
    const nextErrors:ValidationErrors = {};
    if (action === "acknowledge" && !supplierContact.trim()) nextErrors.supplierContact = "Enter the supplier contact who acknowledged the RTV.";
    if (action === "acknowledge" && !acknowledgementReference.trim()) nextErrors.acknowledgementReference = "Enter the acknowledgement reference.";
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const validateResolutionWorkflow = (action:"approve" | "acknowledge" | "execute" | "complete-rework" | "reinspect" | "post-rework") => {
    const nextErrors:ValidationErrors = {};
    const resolutionAction = String(resolutionWorkflow?.latestResolutionAction || "");
    if (action === "acknowledge" && !workflowPartyContact.trim()) nextErrors.partyContact = "Enter the customer contact who acknowledged the return.";
    if (action === "acknowledge" && !workflowAcknowledgementReference.trim()) nextErrors.acknowledgementReference = "Enter the acknowledgement reference.";
    if (action === "execute" && ["SCRAP","DEVIATION_RELEASE"].includes(resolutionAction) && !workflowExecutionReference.trim()) nextErrors.executionReference = resolutionAction === "SCRAP" ? "Enter the disposal certificate or scrap reference." : "Enter the release execution reference.";
    if (action === "complete-rework" && !workflowCompletionRemarks.trim()) nextErrors.completionRemarks = "Enter the completed-work and Quality handover remarks.";
    if (action === "reinspect") {
      const quantity = Number(resolutionWorkflow?.latestReworkQuantity || 0); const accepted = Number(workflowReinspectionAccepted); const rejected = Number(workflowReinspectionRejected);
      if (!["ACCEPT_ALL","PARTIALLY_ACCEPT","REJECT_ALL"].includes(workflowReinspectionDecision)) nextErrors.reinspectionDecision = "Select the Quality decision.";
      if (!Number.isFinite(accepted) || accepted < 0) nextErrors.reinspectionAccepted = "Enter a valid accepted quantity.";
      if (!Number.isFinite(rejected) || rejected < 0) nextErrors.reinspectionRejected = "Enter a valid rejected quantity.";
      if (Number.isFinite(accepted) && Number.isFinite(rejected) && Math.abs(accepted + rejected - quantity) > 0.0001) nextErrors.reinspectionQuantity = `Accepted and rejected quantities must equal ${numeric(quantity)}.`;
      if (!workflowReinspectionRemarks.trim()) nextErrors.reinspectionRemarks = "Enter Quality re-inspection remarks.";
      if (rejected > 0 && !workflowReinspectionReason.trim()) nextErrors.reinspectionReason = "Enter the reason for the re-inspection rejection.";
    }
    if (action === "post-rework") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(workflowStockPostingDate)) nextErrors.stockPostingDate = "Select the stock posting date.";
      if (!workflowStockWarehouse.trim()) nextErrors.stockWarehouse = "Enter the destination warehouse.";
      if (!workflowStockBin.trim()) nextErrors.stockBin = "Enter the destination bin.";
    }
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const resolve = async () => {
    if (!resolving || !validateResolution()) return;
    try {
      setSavingResolution(true); setError("");
      const response = await inventoryApi.resolveRejectionInventory(String(resolving.id),{ action:resolutionAction,quantity:Number(resolutionQuantity),remarks:resolutionRemarks,warehouseCode:releaseWarehouse,binLocation:releaseBin,returnDate,dispatchReference,transportMode,transportReference,actionReference:resolutionReference });
      const rtvNumber = response.data?.rtvDocument?.rtvNumber;
      const resolutionNumber = response.data?.resolutionRequest?.resolutionNumber;
      showSuccess(rtvNumber ? `${rtvNumber} submitted for purchase approval. Rejected stock remains in quarantine.` : resolutionNumber ? `${resolutionNumber} submitted for approval. Rejected stock remains in quarantine.` : response.message || "Rejection inventory updated.");
      setResolving(null); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingResolution(false); }
  };
  const updateRtvWorkflow = (data:Record<string,unknown>) => setRtvWorkflow((current) => current ? {
    ...current, latestRtvStatus:data.documentStatus, latestRtvFileUrl:data.fileUrl, latestRtvNumber:data.rtvNumber,
    latestRtvSupplierContact:data.supplierContact, latestRtvAcknowledgementReference:data.supplierAcknowledgementReference,
  } : current);
  const processRtv = async (action:"approve" | "acknowledge" | "dispatch") => {
    const rtvDocumentId = rtvWorkflow?.latestRtvDocumentId;
    if (!rtvDocumentId || !validateRtvWorkflow(action)) return;
    try {
      setSavingRtv(true); setError("");
      const response = action === "approve" ? await inventoryApi.approveReturnToVendor(String(rtvDocumentId),{approvalRemarks})
        : action === "acknowledge" ? await inventoryApi.acknowledgeReturnToVendor(String(rtvDocumentId),{supplierContact,acknowledgementReference})
        : await inventoryApi.dispatchReturnToVendor(String(rtvDocumentId));
      updateRtvWorkflow(response.data || {});
      showSuccess(action === "approve" ? `${response.data?.rtvNumber || "RTV"} approved and PDF generated.` : action === "acknowledge" ? "Supplier acknowledgement recorded." : "RTV dispatched and rejection inventory updated.");
      await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingRtv(false); }
  };
  const updateResolutionWorkflow = (data:Record<string,unknown>) => setResolutionWorkflow((current) => current ? {
    ...current, latestResolutionStatus:data.resolutionStatus, latestResolutionNumber:data.resolutionNumber,
    latestResolutionFileUrl:data.fileUrl, latestResolutionPartyContact:data.partyContact,
    latestResolutionAcknowledgementReference:data.acknowledgementReference, latestResolutionExecutionReference:data.executionReference,
    latestReworkBalanceId:data.reworkBalanceId ?? current.latestReworkBalanceId, latestReworkStatus:data.reworkStatus ?? current.latestReworkStatus,
    latestReworkAcceptedQuantity:data.acceptedQuantity ?? current.latestReworkAcceptedQuantity, latestReworkRejectedQuantity:data.rejectedQuantity ?? current.latestReworkRejectedQuantity,
  } : current);
  const processResolutionWorkflow = async (action:"approve" | "acknowledge" | "execute" | "complete-rework" | "reinspect" | "post-rework") => {
    if (!resolutionWorkflow) return;
    const requestId = resolutionWorkflow.latestResolutionRequestId; const reworkBalanceId = resolutionWorkflow.latestReworkBalanceId;
    const needsReworkBalance = ["complete-rework","reinspect","post-rework"].includes(action);
    if ((needsReworkBalance && !reworkBalanceId) || (!needsReworkBalance && !requestId) || !validateResolutionWorkflow(action)) return;
    try {
      setSavingWorkflow(true); setError("");
      const response = action === "approve" ? await inventoryApi.approveRejectionResolution(String(requestId),{approvalRemarks:workflowApprovalRemarks})
        : action === "acknowledge" ? await inventoryApi.acknowledgeReturnToCustomer(String(requestId),{partyContact:workflowPartyContact,acknowledgementReference:workflowAcknowledgementReference})
        : action === "execute" ? await inventoryApi.executeRejectionResolution(String(requestId),{executionReference:workflowExecutionReference})
        : action === "complete-rework" ? await inventoryApi.completeRework(String(reworkBalanceId),{remarks:workflowCompletionRemarks})
        : action === "reinspect" ? await inventoryApi.reinspectRework(String(reworkBalanceId),{decision:workflowReinspectionDecision,acceptedQuantity:Number(workflowReinspectionAccepted),rejectedQuantity:Number(workflowReinspectionRejected),qualityRemarks:workflowReinspectionRemarks,rejectionReason:workflowReinspectionReason})
        : await inventoryApi.postReworkedStock(String(reworkBalanceId),{stockPostingDate:workflowStockPostingDate,warehouseCode:workflowStockWarehouse,binLocation:workflowStockBin,batchSerialNumber:workflowStockBatch});
      updateResolutionWorkflow(response.data || {});
      showSuccess(action === "approve" ? `${response.data?.resolutionNumber || "Resolution"} approved and document generated.` : action === "acknowledge" ? "Customer acknowledgement recorded." : action === "complete-rework" ? "Rework completed and returned to quarantine for re-inspection." : action === "reinspect" ? "Quality re-inspection recorded. Accepted quantity is ready for stock posting." : action === "post-rework" ? "Accepted rework quantity posted to inventory." : "Rejection resolution executed.");
      await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingWorkflow(false); }
  };

  return <main className="inventory-page">
    <header className="inventory-header"><h1>{title}</h1><button type="button" className="inventory-refresh" onClick={() => { void load(true); }}><RefreshCw size={17}/> Refresh</button></header>
    {grnFilter && <div className="inventory-grn-filter">Filtered to GRN <strong>{grnFilter}</strong><button type="button" onClick={() => navigate("/inventory/rejection-inventory")}>Clear filter</button></div>}
    {error && <div className="inventory-error">{error}</div>}
    {kind === "dashboard" ? <Dashboard dashboard={dashboard} loading={loading} onNavigate={navigate}/> : <><InventoryTable kind={kind} rows={rows} loading={loading} search={search} warehouse={warehouse} warehouses={warehouses} onSearch={setSearch} onWarehouse={setWarehouse} onSearchSubmit={() => { setPage(1); void load(false, search, warehouse, 1); }} onResolve={openResolve} onManageRtv={openRtv} onManageResolution={openResolutionWorkflow} pagination={<Pagination page={page} total={total} onPageChange={(nextPage) => { setPage(nextPage); void load(false, search, warehouse, nextPage); }} itemLabel="inventory records" disabled={loading}/>} />{resolving && <ResolutionPanel row={resolving} action={resolutionAction} quantity={resolutionQuantity} remarks={resolutionRemarks} actionReference={resolutionReference} warehouse={releaseWarehouse} binLocation={releaseBin} returnDate={returnDate} dispatchReference={dispatchReference} transportMode={transportMode} transportOptions={transportOptions} transportReference={transportReference} saving={savingResolution} errors={validationErrors} onAction={setResolutionAction} onQuantity={setResolutionQuantity} onRemarks={setResolutionRemarks} onActionReference={setResolutionReference} onWarehouse={setReleaseWarehouse} onBinLocation={setReleaseBin} onReturnDate={setReturnDate} onDispatchReference={setDispatchReference} onTransportMode={setTransportMode} onTransportReference={setTransportReference} onCancel={() => setResolving(null)} onSave={() => { void resolve(); }}/>} {rtvWorkflow && <RtvWorkflowPanel row={rtvWorkflow} approvalRemarks={approvalRemarks} supplierContact={supplierContact} acknowledgementReference={acknowledgementReference} saving={savingRtv} errors={validationErrors} onApprovalRemarks={setApprovalRemarks} onSupplierContact={setSupplierContact} onAcknowledgementReference={setAcknowledgementReference} onClose={() => setRtvWorkflow(null)} onApprove={() => { void processRtv("approve"); }} onAcknowledge={() => { void processRtv("acknowledge"); }} onDispatch={() => { void processRtv("dispatch"); }}/>} {resolutionWorkflow && <ResolutionWorkflowPanel row={resolutionWorkflow} approvalRemarks={workflowApprovalRemarks} partyContact={workflowPartyContact} acknowledgementReference={workflowAcknowledgementReference} executionReference={workflowExecutionReference} completionRemarks={workflowCompletionRemarks} reinspectionDecision={workflowReinspectionDecision} reinspectionAccepted={workflowReinspectionAccepted} reinspectionRejected={workflowReinspectionRejected} reinspectionRemarks={workflowReinspectionRemarks} reinspectionReason={workflowReinspectionReason} stockPostingDate={workflowStockPostingDate} stockWarehouse={workflowStockWarehouse} stockBin={workflowStockBin} stockBatch={workflowStockBatch} saving={savingWorkflow} errors={validationErrors} onApprovalRemarks={setWorkflowApprovalRemarks} onPartyContact={setWorkflowPartyContact} onAcknowledgementReference={setWorkflowAcknowledgementReference} onExecutionReference={setWorkflowExecutionReference} onCompletionRemarks={setWorkflowCompletionRemarks} onReinspectionDecision={selectReinspectionDecision} onReinspectionAccepted={setWorkflowReinspectionAccepted} onReinspectionRejected={setWorkflowReinspectionRejected} onReinspectionRemarks={setWorkflowReinspectionRemarks} onReinspectionReason={setWorkflowReinspectionReason} onStockPostingDate={setWorkflowStockPostingDate} onStockWarehouse={setWorkflowStockWarehouse} onStockBin={setWorkflowStockBin} onStockBatch={setWorkflowStockBatch} onClose={() => setResolutionWorkflow(null)} onApprove={() => { void processResolutionWorkflow("approve"); }} onAcknowledge={() => { void processResolutionWorkflow("acknowledge"); }} onExecute={() => { void processResolutionWorkflow("execute"); }} onCompleteRework={() => { void processResolutionWorkflow("complete-rework"); }} onReinspect={() => { void processResolutionWorkflow("reinspect"); }} onPostRework={() => { void processResolutionWorkflow("post-rework"); }}/>}</>}
  </main>;
}

function Dashboard({ dashboard,loading,onNavigate }: { dashboard:InventoryDashboard | null; loading:boolean; onNavigate:(to:string) => void }) {
  const cards:Array<{ label:string; value:string; detail:string; to:DashboardDestination }> = [
    {label:"On-hand quantity",value:numeric(dashboard?.quantityOnHand),detail:`${numeric(dashboard?.itemCount)} stocked items`,to:"/inventory/stock"},
    {label:"Quality hold",value:numeric(dashboard?.qualityHoldQuantity),detail:`${numeric(dashboard?.qualityHoldLineCount)} GRN line(s) pending disposition`,to:"/inventory/quality-hold"},
    {label:"Rejection inventory",value:numeric(dashboard?.rejectionInventoryQuantity),detail:`${numeric(dashboard?.rejectionInventoryLineCount)} segregated rejection line(s)`,to:"/inventory/rejection-inventory"},
    {label:"Outsourcing WIP",value:numeric(dashboard?.outsourcingWipQuantity),detail:`${numeric(dashboard?.outsourcingWipLineCount)} receipt line(s) awaiting the Process Plan operation`,to:"/inventory/outsourcing-wip"},
    {label:"Customer-owned stock",value:numeric(dashboard?.customerStockQuantity),detail:`${numeric(dashboard?.customerStockCustomerCount)} customer(s) · ${numeric(dashboard?.customerWipQuantity)} in WIP`,to:"/inventory/customer-material"},
    {label:"Reorder alerts",value:numeric(dashboard?.reorderAlertCount),detail:"Items at or below the Item Master reorder level",to:"/inventory/reorder-alerts"},
    {label:"Last movement",value:date(dashboard?.lastTransactionDate),detail:"Latest posted inventory transaction",to:"/inventory/transactions"},
    {label:"Production control",value:"Open",detail:"Transfers, work-order issue, MTR / PRR and rejection disposition",to:"/inventory/control"},
  ];
  return <section className="inventory-dashboard"><div className="inventory-card-grid">{cards.map((card) => <button type="button" key={card.label} className={`inventory-card ${dashboardToneByDestination[card.to]}`} onClick={() => onNavigate(card.to)} disabled={loading}><span>{card.label}</span><strong>{loading ? "…" : card.value}</strong><small>{card.detail}</small></button>)}</div></section>;
}

function InventoryTable({ pagination,kind,rows,loading,search,warehouse,warehouses,onSearch,onWarehouse,onSearchSubmit,onResolve,onManageRtv,onManageResolution }: { pagination:ReactNode; kind:PageKind; rows:InventoryRow[]; loading:boolean; search:string; warehouse:string; warehouses:string[]; onSearch:(value:string) => void; onWarehouse:(value:string) => void; onSearchSubmit:() => void; onResolve:(row:InventoryRow) => void; onManageRtv:(row:InventoryRow) => void; onManageResolution:(row:InventoryRow) => void }) {
  const visibleFilters = kind === "stock" || kind === "transactions" || kind === "rejection-inventory";
  const headers = kind === "stock" ? ["Item","Warehouse","Bin / Batch","On hand","Reorder level","Status","Last Updated"] : kind === "transactions" ? ["Transaction Date","Item","Transaction","Warehouse / Bin","Quantity in","Quantity out","Balance","Reference","Last Updated"] : kind === "quality-hold" ? ["GRN","Item","Supplier","On hold","Disposition","Reason","GRN Date","Last Updated"] : kind === "rejection-inventory" ? ["GRN","Item","Rejected qty","Location","Owner","Reason","Follow-up","Status","Last Updated","Action"] : ["Item","On hand","Reorder level","Minimum stock","UOM","Alert","Last Updated"];
  return <section className={`inventory-table-card inventory-table-card--${kind}`}>{visibleFilters && <form className="inventory-filters app-list-toolbar" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={kind === "rejection-inventory" ? "Search GRN, item, reason or follow-up action" : "Search item, warehouse, bin or GRN"}/><select value={warehouse} onChange={(event) => onWarehouse(event.target.value)}><option value="">All warehouses</option>{warehouses.map((value) => <option key={value} value={value}>{value}</option>)}</select><button type="submit">Search</button>{pagination}</form>}{!visibleFilters && <div className="app-list-toolbar">{pagination}</div>}<div className="inventory-table-wrap"><table><thead><tr>{headers.map((header) => <th key={header} className={header === "Last Updated" ? "app-last-updated-column" : undefined}>{header}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={headers.length} className="inventory-empty">Loading inventory data…</td></tr> : rows.length === 0 ? <tr><td colSpan={headers.length} className="inventory-empty">No records found.</td></tr> : rows.map((row,index) => <TableRow key={String(row.id || row.grnItemId || row.itemId || index)} kind={kind} row={row} onResolve={onResolve} onManageRtv={onManageRtv} onManageResolution={onManageResolution}/>)}</tbody></table></div></section>;
}

function TableRow({ kind,row,onResolve,onManageRtv,onManageResolution }: { kind:PageKind; row:InventoryRow; onResolve:(row:InventoryRow) => void; onManageRtv:(row:InventoryRow) => void; onManageResolution:(row:InventoryRow) => void }) {
  if (kind === "stock") return <tr><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small>{row.stockOwnerType === "CUSTOMER" && <small>Customer owned · {text(row.stockOwnerName)}</small>}</td><td>{text(row.warehouseCode)}</td><td>{text(row.binLocation)}<small>{text(row.batchSerialNumber)}</small></td><td>{numeric(row.quantityOnHand)} {text(row.uomCode)}</td><td>{numeric(row.reorderLevel)}</td><td><Status value={text(row.stockStatus)}/></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>;
  if (kind === "transactions") return <tr><td>{date(row.transactionDate)}</td><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small>{row.stockOwnerType === "CUSTOMER" && <small>Customer owned · {text(row.stockOwnerName)}</small>}</td><td><Status value={text(row.transactionType)}/></td><td>{text(row.warehouseCode)}<small>{text(row.binLocation)}</small></td><td>{numeric(row.quantityIn)}</td><td>{numeric(row.quantityOut)}</td><td>{numeric(row.balanceAfterQuantity)} {text(row.uomCode)}</td><td>{text(row.grnNumber)}</td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>;
  if (kind === "quality-hold") return <tr><td><strong>{text(row.grnNumber)}</strong></td><td>{text(row.itemDescription)}</td><td>{text(row.supplierName)}</td><td>{numeric(row.onHoldQuantity)} {text(row.uomCode)}</td><td><Status value={text(row.disposition)}/></td><td>{text(row.rejectionReason || row.qualityRemarks)}</td><td>{date(row.grnDate)}</td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>;
  if (kind === "rejection-inventory") {
    const rtvStatus = String(row.latestRtvStatus || ""); const activeRtv = Boolean(row.latestRtvDocumentId) && !["DISPATCHED","CANCELLED"].includes(rtvStatus);
    const resolutionStatus = String(row.latestResolutionStatus || ""); const reworkStatus = String(row.latestReworkStatus || ""); const activeResolution = Boolean(row.latestResolutionRequestId) && !["EXECUTED","CANCELLED","REINSPECTED_REJECTED","POSTED"].includes(resolutionStatus);
    return <tr><td><strong>{text(row.grnNumber)}</strong><small>{text(row.receiptType).replace(/_/g," ")}</small></td><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small></td><td>{numeric(row.quantityOnHand)} {text(row.uomCode)}{Number(row.quantityReserved || 0) > 0 && <small>{numeric(row.quantityReserved)} reserved for workflow</small>}</td><td>{text(row.warehouseCode)}<small>{text(row.binLocation)}</small></td><td>{text(row.stockOwnerType) === "CUSTOMER" ? "Customer" : "Company"}<small>{text(row.stockOwnerName)}</small></td><td>{text(row.rejectionReason)}</td><td>{text(row.followUpAction)}</td><td><Status value={text(row.inventoryStatus)}/>{rtvStatus && <small>RTV: {rtvStatus.replace(/_/g," ")}</small>}{resolutionStatus && <small>{text(row.latestResolutionAction).replace(/_/g," ")}: {resolutionStatus.replace(/_/g," ")}</small>}{reworkStatus && <small>Rework: {reworkStatus.replace(/_/g," ")}</small>}</td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td><td><div className="inventory-rejection-actions">{row.inventoryStatus === "OPEN" && Number((row.availableQuantity ?? row.quantityOnHand) || 0) > 0 && <button type="button" className="inventory-row-action" onClick={() => onResolve(row)}>Resolve</button>}{activeRtv && <button type="button" className="inventory-row-action" onClick={() => onManageRtv(row)}>Manage {text(row.latestRtvNumber)}</button>}{activeResolution && <button type="button" className="inventory-row-action" onClick={() => onManageResolution(row)}>Manage {text(row.latestResolutionNumber)}</button>}{row.latestRtvFileUrl && <a href={String(row.latestRtvFileUrl)} target="_blank" rel="noreferrer" className="inventory-rtv-link"><FileText size={13}/>{text(row.latestRtvNumber)} PDF</a>}{row.latestResolutionFileUrl && <a href={String(row.latestResolutionFileUrl)} target="_blank" rel="noreferrer" className="inventory-rtv-link"><FileText size={13}/>{text(row.latestResolutionNumber)} PDF</a>}{!activeRtv && !activeResolution && !row.latestRtvFileUrl && !row.latestResolutionFileUrl && !(row.inventoryStatus === "OPEN" && Number((row.availableQuantity ?? row.quantityOnHand) || 0) > 0) && "—"}</div></td></tr>;
  }
  return <tr><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small>{row.stockOwnerType === "CUSTOMER" && <small>Customer owned · {text(row.stockOwnerName)}</small>}</td><td>{numeric(row.quantityOnHand)}</td><td>{numeric(row.reorderLevel)}</td><td>{numeric(row.minimumStock)}</td><td>{text(row.uomCode)}</td><td><Status value={text(row.alertStatus)}/></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>;
}

function FieldError({ message }: { message?:string }) {
  return message ? <span className="inventory-field-error" role="alert">{message}</span> : null;
}

function ValidationSummary({ errors }: { errors:ValidationErrors }) {
  return Object.keys(errors).length ? <div className="inventory-validation-summary" role="alert">Complete the highlighted fields before continuing.</div> : null;
}

function ResolutionPanel({ row,action,quantity,remarks,actionReference,warehouse,binLocation,returnDate,dispatchReference,transportMode,transportOptions,transportReference,saving,errors,onAction,onQuantity,onRemarks,onActionReference,onWarehouse,onBinLocation,onReturnDate,onDispatchReference,onTransportMode,onTransportReference,onCancel,onSave }: { row:InventoryRow; action:string; quantity:string; remarks:string; actionReference:string; warehouse:string; binLocation:string; returnDate:string; dispatchReference:string; transportMode:string; transportOptions:Array<{ value:string; label:string }>; transportReference:string; saving:boolean; errors:ValidationErrors; onAction:(value:string) => void; onQuantity:(value:string) => void; onRemarks:(value:string) => void; onActionReference:(value:string) => void; onWarehouse:(value:string) => void; onBinLocation:(value:string) => void; onReturnDate:(value:string) => void; onDispatchReference:(value:string) => void; onTransportMode:(value:string) => void; onTransportReference:(value:string) => void; onCancel:() => void; onSave:() => void }) {
  const customerOwned = row.responsibleParty === "CUSTOMER";
  const isCustomerReturn = action === "RETURN_TO_CUSTOMER";
  const isReturn = action === "RETURN_TO_VENDOR" || isCustomerReturn;
  const needsReference = ["REWORK","SCRAP","DEVIATION_RELEASE"].includes(action);
  const actionReferenceLabel = action === "REWORK" ? "Rework instruction / job reference *" : action === "SCRAP" ? "Scrap authorisation reference *" : "Deviation authorisation reference *";
  return <section className="inventory-resolution">
    <header><div><span>REJECTION INVENTORY RESOLUTION</span><h2>{text(row.grnNumber)} · {text(row.itemDescription)}</h2><p>{numeric(row.availableQuantity ?? row.quantityOnHand)} {text(row.uomCode)} available to resolve in {text(row.warehouseCode)} / {text(row.binLocation)}.</p></div><button type="button" onClick={onCancel}>Close</button></header>
    <ValidationSummary errors={errors}/>
    <div className="inventory-resolution-grid">
      <label>Resolution action<select value={action} onChange={(event) => onAction(event.target.value)}>{customerOwned ? <option value="RETURN_TO_CUSTOMER">Return to customer</option> : <option value="RETURN_TO_VENDOR">Return to vendor</option>}<option value="REWORK">Rework</option><option value="SCRAP">Scrap</option><option value="DEVIATION_RELEASE">Release with authorised deviation</option></select></label>
      <label>Quantity to resolve<input type="number" min="0.001" step="0.001" max={Number((row.availableQuantity ?? row.quantityOnHand) || 0)} value={quantity} onChange={(event) => onQuantity(event.target.value)} aria-invalid={Boolean(errors.quantity)}/><FieldError message={errors.quantity}/></label>
      {isReturn && <><label>{isCustomerReturn ? "Planned return date *" : "Planned RTV date *"}<input type="date" value={returnDate} onChange={(event) => onReturnDate(event.target.value)} aria-invalid={Boolean(errors.returnDate)}/><FieldError message={errors.returnDate}/></label><label>Dispatch reference<input value={dispatchReference} onChange={(event) => onDispatchReference(event.target.value)} placeholder="Challan or courier reference"/></label><label>Actual transport mode *<select value={transportMode} onChange={(event) => onTransportMode(event.target.value)} disabled={!transportOptions.length} aria-invalid={Boolean(errors.transportMode)}><option value="">{transportOptions.length ? "Select actual transport mode" : "No allowed mode set for party"}</option>{transportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><FieldError message={errors.transportMode}/></label><label>Transport / vehicle<input value={transportReference} onChange={(event) => onTransportReference(event.target.value)} placeholder="Vehicle number or carrier"/></label></>}
      {needsReference && <label>{actionReferenceLabel}<input value={actionReference} onChange={(event) => onActionReference(event.target.value)} placeholder={action === "REWORK" ? "Job card or rework instruction" : "Enter authorisation reference"} aria-invalid={Boolean(errors.actionReference)}/><FieldError message={errors.actionReference}/></label>}
      {action === "DEVIATION_RELEASE" && <><label>Available-stock warehouse *<input value={warehouse} onChange={(event) => onWarehouse(event.target.value)} placeholder="Main Stores" aria-invalid={Boolean(errors.warehouse)}/><FieldError message={errors.warehouse}/></label><label>Available-stock bin *<input value={binLocation} onChange={(event) => onBinLocation(event.target.value)} placeholder="Accepted bin location" aria-invalid={Boolean(errors.binLocation)}/><FieldError message={errors.binLocation}/></label></>}
      <label className="inventory-resolution-remarks">Resolution remarks *<textarea value={remarks} onChange={(event) => onRemarks(event.target.value)} placeholder="Describe the return, rework, scrap or authorised deviation decision" aria-invalid={Boolean(errors.remarks)}/><FieldError message={errors.remarks}/></label>
    </div>
    <p className="inventory-resolution-note">{action === "RETURN_TO_VENDOR" ? "The rejected quantity is reserved in quarantine. It leaves Rejection Inventory only after approval, supplier acknowledgement and dispatch." : "This quantity is reserved in quarantine until approval and the final workflow step are recorded."}</p>
    <div className="inventory-resolution-actions"><button type="button" className="inventory-resolution-cancel" onClick={onCancel}>Cancel</button><button type="button" className="inventory-resolution-save" disabled={saving} onClick={onSave}>{saving ? "Saving…" : action === "RETURN_TO_VENDOR" ? "Create RTV for approval" : "Create resolution for approval"}</button></div>
  </section>;
}

function RtvWorkflowPanel({ row,approvalRemarks,supplierContact,acknowledgementReference,saving,errors,onApprovalRemarks,onSupplierContact,onAcknowledgementReference,onClose,onApprove,onAcknowledge,onDispatch }: { row:InventoryRow; approvalRemarks:string; supplierContact:string; acknowledgementReference:string; saving:boolean; errors:ValidationErrors; onApprovalRemarks:(value:string) => void; onSupplierContact:(value:string) => void; onAcknowledgementReference:(value:string) => void; onClose:() => void; onApprove:() => void; onAcknowledge:() => void; onDispatch:() => void }) {
  const status = String(row.latestRtvStatus || "PENDING_APPROVAL");
  return <section className="inventory-resolution inventory-rtv-workflow">
    <header><div><span>RETURN TO VENDOR WORKFLOW</span><h2>{text(row.latestRtvNumber)} · {text(row.itemDescription)}</h2><p>{numeric(row.quantityReserved || row.quantityOnHand)} {text(row.uomCode)} remains in quarantine until dispatch.</p></div><button type="button" onClick={onClose}>Close</button></header>
    <ValidationSummary errors={errors}/>
    <div className="inventory-rtv-steps"><span className={status === "PENDING_APPROVAL" ? "active" : "done"}><BadgeCheck size={15}/>Approval</span><span className={status === "APPROVED" ? "active" : ["ACKNOWLEDGED","DISPATCHED"].includes(status) ? "done" : ""}><Handshake size={15}/>Supplier acknowledgement</span><span className={status === "ACKNOWLEDGED" ? "active" : status === "DISPATCHED" ? "done" : ""}><Truck size={15}/>Dispatch</span></div>
    {status === "PENDING_APPROVAL" && <div className="inventory-resolution-grid"><label className="inventory-resolution-remarks">Approval remarks<input value={approvalRemarks} onChange={(event) => onApprovalRemarks(event.target.value)} placeholder="Optional approval remarks for the RTV PDF"/></label></div>}
    {status === "APPROVED" && <div className="inventory-resolution-grid"><label>Supplier contact *<input value={supplierContact} onChange={(event) => onSupplierContact(event.target.value)} placeholder="Name, phone or email" aria-invalid={Boolean(errors.supplierContact)}/><FieldError message={errors.supplierContact}/></label><label>Supplier acknowledgement reference *<input value={acknowledgementReference} onChange={(event) => onAcknowledgementReference(event.target.value)} placeholder="Email, call log or signed copy" aria-invalid={Boolean(errors.acknowledgementReference)}/><FieldError message={errors.acknowledgementReference}/></label>{row.latestRtvFileUrl && <a href={String(row.latestRtvFileUrl)} target="_blank" rel="noreferrer" className="inventory-rtv-document"><FileText size={16}/>Download approved RTV PDF</a>}</div>}
    {status === "ACKNOWLEDGED" && <div className="inventory-rtv-confirm"><Handshake size={18}/><span>Supplier acknowledgement recorded. Confirm only after the material leaves quarantine.</span></div>}
    <div className="inventory-resolution-actions"><button type="button" className="inventory-resolution-cancel" onClick={onClose}>Cancel</button>{status === "PENDING_APPROVAL" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onApprove}>{saving ? "Approving…" : "Approve RTV & generate PDF"}</button>}{status === "APPROVED" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onAcknowledge}>{saving ? "Saving…" : "Record acknowledgement"}</button>}{status === "ACKNOWLEDGED" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onDispatch}>{saving ? "Dispatching…" : "Confirm dispatch"}</button>}</div>
  </section>;
}

function ResolutionWorkflowPanel({ row,approvalRemarks,partyContact,acknowledgementReference,executionReference,completionRemarks,reinspectionDecision,reinspectionAccepted,reinspectionRejected,reinspectionRemarks,reinspectionReason,stockPostingDate,stockWarehouse,stockBin,stockBatch,saving,errors,onApprovalRemarks,onPartyContact,onAcknowledgementReference,onExecutionReference,onCompletionRemarks,onReinspectionDecision,onReinspectionAccepted,onReinspectionRejected,onReinspectionRemarks,onReinspectionReason,onStockPostingDate,onStockWarehouse,onStockBin,onStockBatch,onClose,onApprove,onAcknowledge,onExecute,onCompleteRework,onReinspect,onPostRework }: { row:InventoryRow; approvalRemarks:string; partyContact:string; acknowledgementReference:string; executionReference:string; completionRemarks:string; reinspectionDecision:string; reinspectionAccepted:string; reinspectionRejected:string; reinspectionRemarks:string; reinspectionReason:string; stockPostingDate:string; stockWarehouse:string; stockBin:string; stockBatch:string; saving:boolean; errors:ValidationErrors; onApprovalRemarks:(value:string) => void; onPartyContact:(value:string) => void; onAcknowledgementReference:(value:string) => void; onExecutionReference:(value:string) => void; onCompletionRemarks:(value:string) => void; onReinspectionDecision:(value:string) => void; onReinspectionAccepted:(value:string) => void; onReinspectionRejected:(value:string) => void; onReinspectionRemarks:(value:string) => void; onReinspectionReason:(value:string) => void; onStockPostingDate:(value:string) => void; onStockWarehouse:(value:string) => void; onStockBin:(value:string) => void; onStockBatch:(value:string) => void; onClose:() => void; onApprove:() => void; onAcknowledge:() => void; onExecute:() => void; onCompleteRework:() => void; onReinspect:() => void; onPostRework:() => void }) {
  const action = String(row.latestResolutionAction || ""); const status = String(row.latestResolutionStatus || "PENDING_APPROVAL"); const reworkStatus = String(row.latestReworkStatus || "");
  const reworkQuantity = Number(row.latestReworkQuantity || 0); const acceptedForStock = Number(row.latestReworkAcceptedQuantity || reinspectionAccepted || 0);
  const actionLabel = action === "RETURN_TO_CUSTOMER" ? "Return to Customer" : action === "REWORK" ? "Rework" : action === "SCRAP" ? "Scrap" : "Authorised Deviation";
  const isCustomerReturn = action === "RETURN_TO_CUSTOMER"; const isRework = action === "REWORK"; const isScrap = action === "SCRAP"; const isDeviation = action === "DEVIATION_RELEASE";
  const executionLabel = isScrap ? "Disposal certificate / scrap reference *" : isDeviation ? "Release execution reference *" : "Rework job reference";
  const isAwaitingReinspection = isRework && status === "AWAITING_REINSPECTION";
  const isReadyForStock = isRework && status === "READY_FOR_STOCK" && reworkStatus === "READY_FOR_STOCK";
  return <section className="inventory-resolution inventory-rtv-workflow">
    <header><div><span>REJECTION RESOLUTION WORKFLOW</span><h2>{text(row.latestResolutionNumber)} · {actionLabel}</h2><p>{isRework && reworkQuantity ? numeric(reworkQuantity) : numeric(row.quantityReserved || row.quantityOnHand)} {text(row.uomCode)} remains controlled outside available stock until the workflow is complete.</p></div><button type="button" onClick={onClose}>Close</button></header>
    <ValidationSummary errors={errors}/>
    <div className="inventory-rtv-steps"><span className={status === "PENDING_APPROVAL" ? "active" : "done"}><BadgeCheck size={15}/>Approval</span><span className={status === "APPROVED" ? "active" : ["ACKNOWLEDGED","IN_PROGRESS","AWAITING_REINSPECTION","READY_FOR_STOCK","REINSPECTED_REJECTED","EXECUTED","POSTED"].includes(status) ? "done" : ""}>{isCustomerReturn ? <Handshake size={15}/> : <Truck size={15}/>}{isCustomerReturn ? "Customer acknowledgement" : isRework ? "Rework execution" : isScrap ? "Scrap disposal" : "Stock release"}</span><span className={isAwaitingReinspection ? "active" : ["READY_FOR_STOCK","REINSPECTED_REJECTED","EXECUTED","POSTED"].includes(status) ? "done" : ""}>{isRework ? <ShieldAlert size={15}/> : <Truck size={15}/>}{isRework ? "Quality re-inspection" : "Completion"}</span>{isRework && <span className={isReadyForStock ? "active" : status === "POSTED" ? "done" : ""}><Truck size={15}/>Stock receipt</span>}</div>
    {status === "PENDING_APPROVAL" && <div className="inventory-resolution-grid"><label className="inventory-resolution-remarks">Approval remarks<input value={approvalRemarks} onChange={(event) => onApprovalRemarks(event.target.value)} placeholder="Optional approval remarks for the resolution document"/></label></div>}
    {status === "APPROVED" && isCustomerReturn && <div className="inventory-resolution-grid"><label>Customer contact *<input value={partyContact} onChange={(event) => onPartyContact(event.target.value)} placeholder="Name, phone or email" aria-invalid={Boolean(errors.partyContact)}/><FieldError message={errors.partyContact}/></label><label>Customer acknowledgement reference *<input value={acknowledgementReference} onChange={(event) => onAcknowledgementReference(event.target.value)} placeholder="Email, call log or signed copy" aria-invalid={Boolean(errors.acknowledgementReference)}/><FieldError message={errors.acknowledgementReference}/></label>{row.latestResolutionFileUrl && <a href={String(row.latestResolutionFileUrl)} target="_blank" rel="noreferrer" className="inventory-rtv-document"><FileText size={16}/>Download approved document</a>}</div>}
    {status === "APPROVED" && !isCustomerReturn && <div className="inventory-resolution-grid"><label>{executionLabel}<input value={executionReference} onChange={(event) => onExecutionReference(event.target.value)} placeholder={isRework ? "Optional; request reference is used when blank" : "Enter execution reference"} aria-invalid={Boolean(errors.executionReference)}/><FieldError message={errors.executionReference}/></label>{row.latestResolutionFileUrl && <a href={String(row.latestResolutionFileUrl)} target="_blank" rel="noreferrer" className="inventory-rtv-document"><FileText size={16}/>Download approved document</a>}</div>}
    {status === "ACKNOWLEDGED" && <div className="inventory-rtv-confirm"><Handshake size={18}/><span>Customer acknowledgement recorded. Confirm only after the material leaves quarantine.</span></div>}
    {status === "IN_PROGRESS" && <div className="inventory-resolution-grid"><label className="inventory-resolution-remarks">Rework completion remarks *<textarea value={completionRemarks} onChange={(event) => onCompletionRemarks(event.target.value)} placeholder="Describe completed rework and handover to Quality for re-inspection" aria-invalid={Boolean(errors.completionRemarks)}/><FieldError message={errors.completionRemarks}/></label></div>}
    {isAwaitingReinspection && <div className="inventory-resolution-grid"><label>Quality decision<select value={reinspectionDecision} onChange={(event) => onReinspectionDecision(event.target.value)} aria-invalid={Boolean(errors.reinspectionDecision)}><option value="ACCEPT_ALL">Accept all reworked quantity</option><option value="PARTIALLY_ACCEPT">Partially accept</option><option value="REJECT_ALL">Reject all reworked quantity</option></select><FieldError message={errors.reinspectionDecision}/></label><label>Accepted quantity *<input type="number" min="0" step="0.001" max={reworkQuantity} value={reinspectionAccepted} onChange={(event) => onReinspectionAccepted(event.target.value)} aria-invalid={Boolean(errors.reinspectionAccepted || errors.reinspectionQuantity)}/><FieldError message={errors.reinspectionAccepted || errors.reinspectionQuantity}/></label><label>Rejected quantity *<input type="number" min="0" step="0.001" max={reworkQuantity} value={reinspectionRejected} onChange={(event) => onReinspectionRejected(event.target.value)} aria-invalid={Boolean(errors.reinspectionRejected || errors.reinspectionQuantity)}/><FieldError message={errors.reinspectionRejected}/></label><label className="inventory-resolution-remarks">Quality re-inspection remarks *<textarea value={reinspectionRemarks} onChange={(event) => onReinspectionRemarks(event.target.value)} placeholder="Record the re-inspection findings and decision" aria-invalid={Boolean(errors.reinspectionRemarks)}/><FieldError message={errors.reinspectionRemarks}/></label>{Number(reinspectionRejected) > 0 && <label className="inventory-resolution-remarks">Re-inspection rejection reason *<input value={reinspectionReason} onChange={(event) => onReinspectionReason(event.target.value)} placeholder="Reason the reworked quantity still fails" aria-invalid={Boolean(errors.reinspectionReason)}/><FieldError message={errors.reinspectionReason}/></label>}</div>}
    {isReadyForStock && <div className="inventory-resolution-grid"><label>Accepted rework quantity<input value={numeric(acceptedForStock)} readOnly/></label><label>Stock posting date *<input type="date" value={stockPostingDate} onChange={(event) => onStockPostingDate(event.target.value)} aria-invalid={Boolean(errors.stockPostingDate)}/><FieldError message={errors.stockPostingDate}/></label><label>Warehouse *<input value={stockWarehouse} onChange={(event) => onStockWarehouse(event.target.value)} placeholder="Main Stores" aria-invalid={Boolean(errors.stockWarehouse)}/><FieldError message={errors.stockWarehouse}/></label><label>Bin location *<input value={stockBin} onChange={(event) => onStockBin(event.target.value)} placeholder="Accepted bin location" aria-invalid={Boolean(errors.stockBin)}/><FieldError message={errors.stockBin}/></label><label>Batch / serial<input value={stockBatch} onChange={(event) => onStockBatch(event.target.value)} placeholder="Optional batch or serial"/></label></div>}
    {isRework && status === "REINSPECTED_REJECTED" && <div className="inventory-resolution-note">Quality rejected the completed rework. The quantity remains in Rejection Inventory for a new resolution action.</div>}
    {isRework && status === "POSTED" && <div className="inventory-rtv-confirm"><BadgeCheck size={18}/><span>The accepted rework quantity has been posted to inventory.</span></div>}
    <div className="inventory-resolution-actions"><button type="button" className="inventory-resolution-cancel" onClick={onClose}>Close</button>{status === "PENDING_APPROVAL" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onApprove}>{saving ? "Approving…" : "Approve & generate document"}</button>}{status === "APPROVED" && isCustomerReturn && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onAcknowledge}>{saving ? "Saving…" : "Record customer acknowledgement"}</button>}{status === "APPROVED" && !isCustomerReturn && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onExecute}>{saving ? "Saving…" : isRework ? "Start rework" : isScrap ? "Confirm scrap disposal" : "Release to available stock"}</button>}{status === "ACKNOWLEDGED" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onExecute}>{saving ? "Dispatching…" : "Confirm return dispatch"}</button>}{status === "IN_PROGRESS" && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onCompleteRework}>{saving ? "Completing…" : "Complete rework"}</button>}{isAwaitingReinspection && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onReinspect}>{saving ? "Saving…" : "Record Quality re-inspection"}</button>}{isReadyForStock && <button type="button" className="inventory-resolution-save" disabled={saving} onClick={onPostRework}>{saving ? "Posting…" : "Post accepted stock"}</button>}</div>
  </section>;
}

function Status({ value }: { value:string }) { return <span className={"inventory-status " + value.toLowerCase().replace(/_/g,"-")}>{value.replace(/_/g," ")}</span>; }
