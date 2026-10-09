import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Eye,
  Gauge,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { todayInAppTimeZone } from "../../utils/formatDateTime";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { gaugeApi } from "../../api/gauge.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerPage.css";
import "./GaugeCalibrationWorkflowPage.css";
import "./GaugeMasterPage.css";

type GaugeRow = {
  gaugeMasterId: number;
  gaugeId: string;
  instrumentName: string;
  itemCode: string;
  manufacturerSerialNumber?: string | null;
  calibrationDueDate?: string | null;
  calibrationCondition: string;
  operationalStatus: string;
  currentLocation: string;
  assignedTo?: string | null;
  calibrationAgency?: string | null;
  daysLeft?: number | null;
};

type WorkflowStage = "collection" | "ready" | "calibration" | "service";
type QueueResult = { data?: GaugeRow[]; meta?: { total?: number } };
type WorkflowSummary = Record<WorkflowStage, number> & { collectionOverdue?: number };
type ServicePurchaseOrder = { purchaseOrderId: number; poNumber: string; poDate: string; supplierName: string; grandTotalAmount?: number | string };
type CalibrationDispatch = { calibrationDispatchId: number; dispatchNumber: string; challanNumber: string; calibrationAgency: string; servicePoNumber: string; dispatchDate: string; expectedReturnDate: string; courierReference?: string | null; dispatchStatus?: string | null; gaugeCount: number; gaugeIds?: string | null };
type DispatchForm = { servicePurchaseOrderId: string; dispatchDate: string; expectedReturnDate: string; courierReference: string; remarks: string };

const labels = (value?: string | null) => String(value || "-").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const calibrationConditions = new Set(["DUE_SOON", "DUE_TODAY", "EXPIRED"]);
const badgeClass = (value: string) => `gauge-badge ${String(value).toLowerCase().replace(/_/g, "-")}`;

const stageDetails: Record<WorkflowStage, { label: string; description: string; action: string; icon: typeof CircleAlert }> = {
  collection: { label: "Due for collection", description: "Available gauges that are due, due today or overdue.", action: "Collect for calibration", icon: CircleAlert },
  ready: { label: "Calibration Dispatch Queue", description: "Create one dispatch challan for collected Gauge IDs and an approved calibration service PO.", action: "Create dispatch challan", icon: ClipboardList },
  calibration: { label: "Under calibration", description: "Gauges waiting for a calibration result and certificate.", action: "Record calibration result", icon: CheckCircle2 },
  service: { label: "Rejected / service", description: "Failed gauges that require service before recalibration.", action: "Start service", icon: Wrench },
};

const today = todayInAppTimeZone;
const blankDispatchForm = (): DispatchForm => ({ servicePurchaseOrderId: "", dispatchDate: today(), expectedReturnDate: "", courierReference: "", remarks: "" });

export default function GaugeCalibrationWorkflowPage() {
  const navigate = useNavigate();
  const { showSuccess, confirmAction } = useAppFeedback();
  const [queues, setQueues] = useState<Record<WorkflowStage, GaugeRow[]>>({ collection: [], ready: [], calibration: [], service: [] });
  const [totals, setTotals] = useState<Record<WorkflowStage, number>>({ collection: 0, ready: 0, calibration: 0, service: 0 });
  const [overdueCollectionCount, setOverdueCollectionCount] = useState(0);
  const [stage, setStage] = useState<WorkflowStage>("collection");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [servicePurchaseOrders, setServicePurchaseOrders] = useState<ServicePurchaseOrder[]>([]);
  const [dispatches, setDispatches] = useState<CalibrationDispatch[]>([]);
  const [selectedGaugeIds, setSelectedGaugeIds] = useState<number[]>([]);
  const [dispatchForm, setDispatchForm] = useState<DispatchForm>(blankDispatchForm);
  const [dispatchFormOpen, setDispatchFormOpen] = useState(false);
  const [savingDispatch, setSavingDispatch] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      gaugeApi.list({ operationalStatus: "AVAILABLE", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ operationalStatus: "COLLECTED_FOR_CALIBRATION", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ operationalStatus: "UNDER_CALIBRATION", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ operationalStatus: "REJECTED", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.calibrationWorkflowSummary() as Promise<{ data?: WorkflowSummary }>,
      gaugeApi.calibrationDispatchLookups() as Promise<{ data?: { servicePurchaseOrders?: ServicePurchaseOrder[] } }>,
      gaugeApi.listCalibrationDispatches({ page: 1, pageSize: 8 }) as Promise<{ data?: CalibrationDispatch[] }>,
    ]).then(([available, ready, calibration, service, summaryResponse, lookupResponse, dispatchResponse]) => {
      if (!active) return;
      const collectionRows = (available.data || []).filter((row) => calibrationConditions.has(row.calibrationCondition));
      setQueues({
        collection: collectionRows,
        ready: ready.data || [],
        calibration: calibration.data || [],
        service: service.data || [],
      });
      setTotals({ collection: Number(summaryResponse.data?.collection || 0), ready: Number(summaryResponse.data?.ready || 0), calibration: Number(summaryResponse.data?.calibration || 0), service: Number(summaryResponse.data?.service || 0) });
      setOverdueCollectionCount(Number(summaryResponse.data?.collectionOverdue || 0));
      setServicePurchaseOrders(lookupResponse.data?.servicePurchaseOrders || []);
      setDispatches(dispatchResponse.data || []);
      setSelectedGaugeIds([]);
      setDispatchFormOpen(false);
    }).catch((reason) => active && setError(apiMessage(reason))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  const currentStage = stageDetails[stage];
  const selectedDispatchRows = useMemo(() => queues.ready.filter((row) => selectedGaugeIds.includes(row.gaugeMasterId)), [queues.ready, selectedGaugeIds]);
  const selectedDispatchAgencies = useMemo(() => [...new Set(selectedDispatchRows
    .map((row) => String(row.calibrationAgency || "").trim()).filter(Boolean).map((agency) => agency.toLocaleLowerCase()))], [selectedDispatchRows]);
  const selectedDispatchAgency = selectedDispatchAgencies.length === 1
    ? selectedDispatchRows.find((row) => String(row.calibrationAgency || "").trim())?.calibrationAgency || null
    : null;
  const eligibleServicePurchaseOrders = useMemo(() => selectedDispatchAgency
    ? servicePurchaseOrders.filter((order) => String(order.supplierName || "").trim().toLocaleLowerCase() === String(selectedDispatchAgency).trim().toLocaleLowerCase())
    : servicePurchaseOrders, [selectedDispatchAgency, servicePurchaseOrders]);
  const selectedServicePurchaseOrder = servicePurchaseOrders.find((order) => String(order.purchaseOrderId) === dispatchForm.servicePurchaseOrderId);
  const displayedRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queues[stage];
    return queues[stage].filter((row) => [row.gaugeId, row.instrumentName, row.itemCode, row.manufacturerSerialNumber, row.currentLocation]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [queues, search, stage]);

  const lifecycleAction = (row: GaugeRow) => {
    const actions: Record<WorkflowStage, string> = {
      collection: "collect",
      ready: "start",
      calibration: "calibrate",
      service: "service",
    };
    navigate(`/masters/gauges/${row.gaugeMasterId}?mode=edit&action=${actions[stage]}`);
  };
  const changeStage = (nextStage: WorkflowStage) => {
    setStage(nextStage);
    setSearch("");
    if (nextStage !== "ready") setDispatchFormOpen(false);
  };
  const toggleGaugeForDispatch = (gaugeMasterId: number) => {
    setSelectedGaugeIds((current) => current.includes(gaugeMasterId) ? current.filter((id) => id !== gaugeMasterId) : [...current, gaugeMasterId]);
  };
  const selectAllForDispatch = (checked: boolean) => setSelectedGaugeIds(checked ? queues.ready.map((row) => row.gaugeMasterId) : []);
  const updateDispatchForm = (name: keyof DispatchForm, value: string) => setDispatchForm((current) => ({ ...current, [name]: value }));
  const openDispatchForm = () => {
    if (selectedDispatchAgencies.length > 1) {
      setError("Select Gauge IDs for one Calibration Agency in the same dispatch challan.");
      return;
    }
    setError("");
    setDispatchForm((current) => ({ ...blankDispatchForm(), ...current, servicePurchaseOrderId: "", dispatchDate: current.dispatchDate || today() }));
    setDispatchFormOpen(true);
  };
  const createDispatch = async () => {
    if (!selectedDispatchRows.length) { setError("Select at least one collected Gauge ID for the calibration dispatch."); return; }
    if (!dispatchForm.servicePurchaseOrderId) { setError("Select the approved Calibration Service PO."); return; }
    if (!dispatchForm.expectedReturnDate) { setError("Expected Return Date is required."); return; }
    const confirmed = await confirmAction({
      title: "Create calibration dispatch challan",
      message: `Dispatch ${selectedDispatchRows.length} selected Gauge ID${selectedDispatchRows.length === 1 ? "" : "s"} to ${selectedServicePurchaseOrder?.supplierName || "the selected calibration agency"}? Their operational status will change to Under Calibration.`,
      confirmLabel: "Create and dispatch",
    });
    if (!confirmed) return;
    try {
      setSavingDispatch(true); setError("");
      const response = await gaugeApi.createCalibrationDispatch({
        gaugeMasterIds: selectedGaugeIds,
        servicePurchaseOrderId: Number(dispatchForm.servicePurchaseOrderId),
        dispatchDate: dispatchForm.dispatchDate,
        expectedReturnDate: dispatchForm.expectedReturnDate,
        courierReference: dispatchForm.courierReference,
        remarks: dispatchForm.remarks,
      });
      const challanNumber = response?.data?.challanNumber;
      showSuccess(`Calibration dispatch${challanNumber ? ` challan ${challanNumber}` : ""} created for ${selectedDispatchRows.length} Gauge ID${selectedDispatchRows.length === 1 ? "" : "s"}.`);
      setSelectedGaugeIds([]); setDispatchForm(blankDispatchForm()); setDispatchFormOpen(false); setRefreshKey((current) => current + 1);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingDispatch(false); }
  };

  return <div className="page-container master-list-page gauge-workflow-page">
    <section className="master-list-header">
      <div>
        <p className="page-eyebrow">MASTERS / GAUGE MASTER / CALIBRATION WORKFLOW</p>
        <h1>Calibration Workflow</h1>
        <span>Follow each Gauge ID from collection through calibration result, service and availability.</span>
      </div>
      <div className="gauge-workflow-header-actions">
        <button type="button" className="secondary-action-button" onClick={() => navigate("/masters/gauges")}><ArrowLeft size={16}/>Gauge Master</button>
        <button type="button" className="primary-action-button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}><RefreshCw size={16}/>Refresh</button>
      </div>
    </section>

    {error && <Alert type="error" message={error}/>} 

    <section className="gauge-workflow-steps" aria-label="Calibration lifecycle stages">
      <div className="gauge-workflow-step is-complete"><span>1</span><strong>Collect</strong><small>Move eligible gauges to the hold rack.</small></div>
      <div className="gauge-workflow-step is-current"><span>2</span><strong>Dispatch to agency</strong><small>Link the service PO and create a challan.</small></div>
      <div className="gauge-workflow-step"><span>3</span><strong>Record result</strong><small>Save pass/fail, certificate and next due date.</small></div>
      <div className="gauge-workflow-step"><span>4</span><strong>Available or service</strong><small>Pass returns to use; fail moves to service.</small></div>
    </section>

    <section className="gauge-workflow-summary" aria-label="Calibration workflow summary">
      <button type="button" className={stage === "collection" ? "is-active" : ""} onClick={() => changeStage("collection")}><CircleAlert size={19}/><span><small>Due for collection</small><strong>{totals.collection}</strong><em>{overdueCollectionCount ? `${overdueCollectionCount} overdue` : "Due within 10 days"}</em></span></button>
      <button type="button" className={stage === "ready" ? "is-active" : ""} onClick={() => changeStage("ready")}><ClipboardList size={19}/><span><small>Dispatch queue</small><strong>{totals.ready}</strong><em>Collected Gauge IDs</em></span></button>
      <button type="button" className={stage === "calibration" ? "is-active" : ""} onClick={() => changeStage("calibration")}><CalendarClock size={19}/><span><small>Under calibration</small><strong>{totals.calibration}</strong><em>Result and certificate pending</em></span></button>
      <button type="button" className={stage === "service" ? "is-active" : ""} onClick={() => changeStage("service")}><Wrench size={19}/><span><small>Rejected / service</small><strong>{totals.service}</strong><em>Requires corrective action</em></span></button>
    </section>

    <section className="master-list-card gauge-workflow-card">
      <div className="gauge-workflow-card-header">
        <div><h2>{currentStage.label}</h2><p>{currentStage.description}</p></div>
        <span>{displayedRows.length} gauge{displayedRows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="gauge-workflow-filter-row">
        <div className="master-search-box"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Gauge ID, instrument, serial or location"/></div>
      </div>
      {stage === "ready" && <div className="gauge-dispatch-selection-bar"><div><strong>{selectedDispatchRows.length ? `${selectedDispatchRows.length} Gauge ID${selectedDispatchRows.length === 1 ? "" : "s"} selected` : "Select collected Gauge IDs"}</strong><span>{selectedDispatchAgencies.length > 1 ? "Selected Gauge IDs belong to different calibration agencies. Create separate challans." : selectedDispatchAgency ? `Calibration Agency: ${selectedDispatchAgency}` : "One challan can contain gauges for one calibration agency and one approved service PO."}</span></div><div><button type="button" className="secondary-action-button" disabled={!selectedDispatchRows.length} onClick={() => setSelectedGaugeIds([])}>Clear</button><button type="button" className="primary-action-button" disabled={!selectedDispatchRows.length || selectedDispatchAgencies.length > 1} onClick={openDispatchForm}><ClipboardList size={16}/>Create dispatch challan</button></div></div>}
      {stage === "ready" && dispatchFormOpen && <section className="gauge-dispatch-form" aria-labelledby="gauge-dispatch-form-title"><header><div><h3 id="gauge-dispatch-form-title">Create Calibration Dispatch Challan</h3><p>{selectedDispatchRows.map((row) => row.gaugeId).join(", ")}</p></div><button type="button" aria-label="Close dispatch form" onClick={() => setDispatchFormOpen(false)}><X size={18}/></button></header><div className="master-form-grid"><label className="master-field"><span>Calibration Service PO <b>*</b></span><select value={dispatchForm.servicePurchaseOrderId} onChange={(event) => updateDispatchForm("servicePurchaseOrderId", event.target.value)}><option value="">Select approved service PO</option>{eligibleServicePurchaseOrders.map((order) => <option key={order.purchaseOrderId} value={order.purchaseOrderId}>{order.poNumber} — {order.supplierName}</option>)}</select><small>{eligibleServicePurchaseOrders.length ? selectedDispatchAgency ? "Approved POs for the selected calibration agency." : "Only approved purchase orders are available." : "No approved service PO is available for the selected agency."}</small></label><div className="gauge-dispatch-agency"><strong>Calibration Agency</strong><span>{selectedServicePurchaseOrder?.supplierName || selectedDispatchAgency || "Select a service PO"}</span><small>Agency is taken from the selected PO supplier.</small></div><label className="master-field"><span>Dispatch Date <b>*</b></span><input type="date" value={dispatchForm.dispatchDate} onChange={(event) => updateDispatchForm("dispatchDate", event.target.value)}/></label><label className="master-field"><span>Expected Return Date <b>*</b></span><input type="date" min={dispatchForm.dispatchDate} value={dispatchForm.expectedReturnDate} onChange={(event) => updateDispatchForm("expectedReturnDate", event.target.value)}/></label><label className="master-field"><span>Courier / Vehicle Reference</span><input value={dispatchForm.courierReference} placeholder="Courier name, docket or vehicle number" onChange={(event) => updateDispatchForm("courierReference", event.target.value)}/></label><label className="master-field"><span>Dispatch From</span><input value={selectedDispatchRows[0]?.currentLocation || "Calibration Hold / Dispatch Rack"} readOnly/></label><label className="master-field span-2"><span>Remarks</span><textarea rows={2} value={dispatchForm.remarks} placeholder="Optional dispatch instructions" onChange={(event) => updateDispatchForm("remarks", event.target.value)}/></label></div><footer><span>A sequential challan number is created and every selected Gauge ID is marked Under Calibration.</span><div><button type="button" className="secondary-action-button" onClick={() => setDispatchFormOpen(false)}>Cancel</button><button type="button" className="primary-action-button" disabled={savingDispatch} onClick={() => void createDispatch()}>{savingDispatch ? "Creating..." : "Create challan and dispatch"}</button></div></footer></section>}
      <div className="master-table-wrapper">
        <table className="master-data-table gauge-workflow-table">
          <thead><tr>{stage === "ready" && <th className="gauge-select-column"><input type="checkbox" aria-label="Select all collected Gauge IDs" checked={queues.ready.length > 0 && selectedGaugeIds.length === queues.ready.length} onChange={(event) => selectAllForDispatch(event.target.checked)}/></th>}<th>Gauge ID</th><th>Instrument</th><th>Manufacturer Serial</th><th>Current location</th><th>Calibration condition</th><th>Due date</th><th>Operational status</th><th className="master-actions-column">Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={stage === "ready" ? 9 : 8}><div className="master-table-message">Loading calibration workflow...</div></td></tr> : displayedRows.length === 0 ? <tr><td colSpan={stage === "ready" ? 9 : 8}><div className="master-empty-state"><div className="master-empty-icon"><Gauge size={30}/></div><h3>No gauges in this workflow stage</h3><p>{stage === "collection" ? "Available gauges appear here when they are due for calibration." : "The next gauge reaching this stage will appear here."}</p></div></td></tr> : displayedRows.map((row) => {
            const ActionIcon = currentStage.icon;
            return <tr key={row.gaugeMasterId}>
              {stage === "ready" && <td className="gauge-select-column"><input type="checkbox" checked={selectedGaugeIds.includes(row.gaugeMasterId)} aria-label={`Select ${row.gaugeId} for calibration dispatch`} onChange={() => toggleGaugeForDispatch(row.gaugeMasterId)}/></td>}
              <td><strong>{row.gaugeId}</strong></td>
              <td><strong>{row.instrumentName}</strong><small>{row.itemCode}</small></td>
              <td>{row.manufacturerSerialNumber || "—"}</td>
              <td>{row.currentLocation || "—"}<small>{row.assignedTo ? `Assigned to ${row.assignedTo}` : ""}</small></td>
              <td><span className={badgeClass(row.calibrationCondition)}>{labels(row.calibrationCondition)}</span></td>
              <td>{row.calibrationDueDate || "—"}{row.daysLeft !== null && row.daysLeft !== undefined && <small>{row.daysLeft < 0 ? `${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? "" : "s"} overdue` : `${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"} left`}</small>}</td>
              <td><span className="gauge-badge operational">{labels(row.operationalStatus)}</span></td>
              <td><div className="gauge-workflow-actions">{stage !== "ready" && <button type="button" className="gauge-workflow-lifecycle-action" onClick={() => lifecycleAction(row)}><ActionIcon size={15}/>{currentStage.action}</button>}<button type="button" className="gauge-workflow-view-action" aria-label={`View ${row.gaugeId}`} title="View Gauge Master" onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=view`)}><Eye size={16}/></button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <section className="master-list-card gauge-dispatch-history"><div className="gauge-workflow-card-header"><div><h2>Recent Calibration Dispatch Challans</h2><p>Each dispatch keeps the linked service PO and individual Gauge ID history.</p></div><span>{dispatches.length} recent</span></div><div className="master-table-wrapper"><table className="master-data-table gauge-dispatch-history-table"><thead><tr><th>Dispatch Challan</th><th>Calibration Agency</th><th>Service PO</th><th>Gauge IDs</th><th>Dispatch Date</th><th>Expected Return</th><th>Status</th><th>Courier / Vehicle</th></tr></thead><tbody>{dispatches.length === 0 ? <tr><td colSpan={8}><div className="gauge-dispatch-empty">No calibration dispatch challan has been created.</div></td></tr> : dispatches.map((dispatch) => <tr key={dispatch.calibrationDispatchId}><td><strong>{dispatch.challanNumber || dispatch.dispatchNumber}</strong></td><td>{dispatch.calibrationAgency || "—"}</td><td>{dispatch.servicePoNumber || "—"}</td><td>{dispatch.gaugeIds || `${dispatch.gaugeCount} Gauge ID${Number(dispatch.gaugeCount) === 1 ? "" : "s"}`}</td><td>{dispatch.dispatchDate}</td><td>{dispatch.expectedReturnDate || "—"}</td><td><span className="gauge-badge operational">{labels(dispatch.dispatchStatus || "DISPATCHED")}</span></td><td>{dispatch.courierReference || "—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
