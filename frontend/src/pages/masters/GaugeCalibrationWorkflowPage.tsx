import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Eye,
  Gauge,
  Printer,
  RefreshCw,
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
  effectiveOperationalStatus?: string;
  currentLocation: string;
  assignedTo?: string | null;
  calibrationAgency?: string | null;
  daysLeft?: number | null;
};

type WorkflowStage = "collection" | "ready" | "calibration" | "service";
type QueueResult = { data?: GaugeRow[]; meta?: { total?: number } };
type WorkflowSummary = Record<WorkflowStage, number> & { collectionOverdue?: number };
type CalibrationDispatch = { calibrationDispatchId: number; dispatchNumber: string; challanNumber: string; calibrationAgency: string; dispatchDate: string; expectedReturnDate: string; courierReference?: string | null; dispatchStatus?: string | null; gaugeCount: number; gaugeIds?: string | null };
type CalibrationDispatchItem = { gaugeHistoryId: number; gaugeMasterId: number; gaugeId: string; instrumentName?: string | null; manufacturerSerialNumber?: string | null; dispatchedTo?: string | null; operationalStatus?: string | null; calibrationReturnId?: number | null; returnGrnNumber?: string | null };
type CalibrationDispatchDetail = CalibrationDispatch & { dispatchLocation?: string | null; remarks?: string | null; items: CalibrationDispatchItem[] };
type CalibrationReturnItemForm = { gaugeMasterId: number; gaugeId: string; instrumentName?: string | null; received: boolean; calibrationResult: "PASS" | "FAIL"; calibrationDate: string; certificateNumber: string; remarks: string };
type CalibrationReturnForm = { returnDate: string; returnLocation: string; remarks: string; items: CalibrationReturnItemForm[] };
type CollectionForm = { collectionLocation: string; collectionDate: string; remarks: string };

const labels = (value?: string | null) => String(value || "-").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const calibrationConditions = new Set(["DUE_SOON", "DUE_TODAY", "EXPIRED"]);
const badgeClass = (value: string) => `gauge-badge ${String(value).toLowerCase().replace(/_/g, "-")}`;

const stageDetails: Record<WorkflowStage, { label: string; description: string; action: string; icon: typeof CircleAlert }> = {
  collection: { label: "Due for collection", description: "Available gauges that are due, due today or overdue.", action: "Collect for calibration", icon: CircleAlert },
  ready: { label: "Calibration Dispatch Queue", description: "Create one dispatch challan for collected Gauge IDs going to the same calibration agency.", action: "Create dispatch challan", icon: ClipboardList },
  calibration: { label: "Under calibration", description: "Receive the gauges through the linked Calibration Return GRN after the agency completes calibration.", action: "Receive Return GRN", icon: CheckCircle2 },
  service: { label: "Rejected / service", description: "Failed gauges that require service before recalibration.", action: "Start service", icon: Wrench },
};
const workflowStepperSteps: Array<{ stage: WorkflowStage; label: string; icon: typeof CircleAlert }> = [
  { stage: "collection", label: "Collect", icon: CircleAlert },
  { stage: "ready", label: "GCD / courier dispatch", icon: ClipboardList },
  { stage: "calibration", label: "Under calibration", icon: CalendarClock },
  { stage: "service", label: "Return GRN / service", icon: CheckCircle2 },
];

const today = todayInAppTimeZone;
const blankReturnForm = (): CalibrationReturnForm => ({ returnDate: today(), returnLocation: "Main Stores / Calibration Hold / Dispatch Rack", remarks: "", items: [] });
const blankCollectionForm = (): CollectionForm => ({ collectionLocation: "", collectionDate: today(), remarks: "" });

export default function GaugeCalibrationWorkflowPage() {
  const navigate = useNavigate();
  const { showSuccess, confirmAction } = useAppFeedback();
  const [queues, setQueues] = useState<Record<WorkflowStage, GaugeRow[]>>({ collection: [], ready: [], calibration: [], service: [] });
  const [totals, setTotals] = useState<Record<WorkflowStage, number>>({ collection: 0, ready: 0, calibration: 0, service: 0 });
  const [overdueCollectionCount, setOverdueCollectionCount] = useState(0);
  const [stage, setStage] = useState<WorkflowStage>("collection");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dispatches, setDispatches] = useState<CalibrationDispatch[]>([]);
  const [selectedGaugeIds, setSelectedGaugeIds] = useState<number[]>([]);
  const [selectedCollectionGaugeIds, setSelectedCollectionGaugeIds] = useState<number[]>([]);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionForm, setCollectionForm] = useState<CollectionForm>(blankCollectionForm);
  const [savingCollection, setSavingCollection] = useState(false);
  const [viewingDispatch, setViewingDispatch] = useState<CalibrationDispatchDetail | null>(null);
  const [loadingDispatchView, setLoadingDispatchView] = useState(false);
  const [returningDispatch, setReturningDispatch] = useState<CalibrationDispatchDetail | null>(null);
  const [returnForm, setReturnForm] = useState<CalibrationReturnForm>(blankReturnForm);
  const [savingReturn, setSavingReturn] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      gaugeApi.list({ lifecycleStatus: "AVAILABLE", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ lifecycleStatus: "COLLECTED_FOR_CALIBRATION", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ lifecycleStatus: "UNDER_CALIBRATION", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ lifecycleStatus: "REJECTED", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.list({ lifecycleStatus: "UNDER_SERVICE", page: 1, pageSize: 100 }) as Promise<QueueResult>,
      gaugeApi.calibrationWorkflowSummary() as Promise<{ data?: WorkflowSummary }>,
      gaugeApi.listCalibrationDispatches({ page: 1, pageSize: 8 }) as Promise<{ data?: CalibrationDispatch[] }>,
    ]).then(([available, ready, calibration, rejected, underService, summaryResponse, dispatchResponse]) => {
      if (!active) return;
      const collectionRows = (available.data || []).filter((row) => calibrationConditions.has(row.calibrationCondition));
      setQueues({
        collection: collectionRows,
        ready: ready.data || [],
        calibration: calibration.data || [],
        service: [...(rejected.data || []), ...(underService.data || [])],
      });
      setTotals({ collection: Number(summaryResponse.data?.collection || 0), ready: Number(summaryResponse.data?.ready || 0), calibration: Number(summaryResponse.data?.calibration || 0), service: Number(summaryResponse.data?.service || 0) });
      setOverdueCollectionCount(Number(summaryResponse.data?.collectionOverdue || 0));
      setDispatches(dispatchResponse.data || []);
      setSelectedGaugeIds([]);
      setSelectedCollectionGaugeIds([]);
      setCollectionDialogOpen(false);
      setReturningDispatch(null);
    }).catch((reason) => active && setError(apiMessage(reason))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  const currentStage = stageDetails[stage];
  const selectedDispatchRows = useMemo(() => queues.ready.filter((row) => selectedGaugeIds.includes(row.gaugeMasterId)), [queues.ready, selectedGaugeIds]);
  const selectedCollectionRows = useMemo(() => queues.collection.filter((row) => selectedCollectionGaugeIds.includes(row.gaugeMasterId)), [queues.collection, selectedCollectionGaugeIds]);
  const selectedDispatchAgencies = useMemo(() => [...new Set(selectedDispatchRows
    .map((row) => String(row.calibrationAgency || "").trim()).filter(Boolean).map((agency) => agency.toLocaleLowerCase()))], [selectedDispatchRows]);
  const selectedDispatchAgency = selectedDispatchAgencies.length === 1
    ? selectedDispatchRows.find((row) => String(row.calibrationAgency || "").trim())?.calibrationAgency || null
    : null;
  const displayedRows = queues[stage];
  const isMultiSelectStage = stage === "collection" || stage === "ready";

  const lifecycleAction = (row: GaugeRow) => {
    const actions: Record<WorkflowStage, string> = {
      collection: "collect",
      ready: "start",
      calibration: "calibrate",
      service: "service",
    };
    const action = stage === "service" && row.operationalStatus === "UNDER_SERVICE" ? "calibrate" : actions[stage];
    navigate(`/masters/gauges/${row.gaugeMasterId}?mode=edit&action=${action}`);
  };
  const lifecycleActionLabel = (row: GaugeRow) => stage === "service" && row.operationalStatus === "UNDER_SERVICE"
    ? "Record calibration result"
    : currentStage.action;
  const changeStage = (nextStage: WorkflowStage) => setStage(nextStage);
  const toggleGaugeForDispatch = (gaugeMasterId: number) => {
    setSelectedGaugeIds((current) => current.includes(gaugeMasterId) ? current.filter((id) => id !== gaugeMasterId) : [...current, gaugeMasterId]);
  };
  const selectAllForDispatch = (checked: boolean) => setSelectedGaugeIds(checked ? queues.ready.map((row) => row.gaugeMasterId) : []);
  const toggleGaugeForCollection = (gaugeMasterId: number) => {
    setSelectedCollectionGaugeIds((current) => current.includes(gaugeMasterId) ? current.filter((id) => id !== gaugeMasterId) : [...current, gaugeMasterId]);
  };
  const selectAllForCollection = (checked: boolean) => setSelectedCollectionGaugeIds(checked ? queues.collection.map((row) => row.gaugeMasterId) : []);
  const openCollectionDialog = () => {
    if (!selectedCollectionRows.length) return;
    const locations = [...new Set(selectedCollectionRows.map((row) => String(row.currentLocation || "").trim()).filter(Boolean))];
    setCollectionForm({ ...blankCollectionForm(), collectionLocation: locations.length === 1 ? locations[0] : "" });
    setError("");
    setCollectionDialogOpen(true);
  };
  const updateCollectionForm = (name: keyof CollectionForm, value: string) => setCollectionForm((current) => ({ ...current, [name]: value }));
  const collectSelectedGauges = async () => {
    if (!selectedCollectionRows.length) return;
    const confirmed = await confirmAction({
      title: "Collect gauges for calibration",
      message: `Collect ${selectedCollectionRows.length} selected Gauge ID${selectedCollectionRows.length === 1 ? "" : "s"} for calibration? They will move to the Calibration Dispatch Queue.`,
      confirmLabel: "Collect gauges",
    });
    if (!confirmed) return;
    try {
      setSavingCollection(true);
      setError("");
      await gaugeApi.bulkCollectForCalibration({
        gaugeMasterIds: selectedCollectionGaugeIds,
        collectionLocation: collectionForm.collectionLocation.trim(),
        collectionDate: collectionForm.collectionDate,
        remarks: collectionForm.remarks.trim(),
      });
      showSuccess(`${selectedCollectionRows.length} Gauge ID${selectedCollectionRows.length === 1 ? "" : "s"} collected for calibration.`);
      setCollectionDialogOpen(false);
      setCollectionForm(blankCollectionForm());
      setSelectedCollectionGaugeIds([]);
      setRefreshKey((current) => current + 1);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setSavingCollection(false);
    }
  };
  const openDispatchForm = () => {
    if (selectedDispatchAgencies.length > 1) {
      setError("Select Gauge IDs for one Calibration Agency in the same dispatch challan.");
      return;
    }
    const query = new URLSearchParams({
      calibrationGaugeIds: selectedGaugeIds.join(","),
      calibrationAgency: selectedDispatchAgency || "",
      dispatchFrom: selectedDispatchRows[0]?.currentLocation || "Calibration Hold / Dispatch Rack",
    });
    navigate(`/material-outward?${query.toString()}`);
  };
  const viewDispatch = async (calibrationDispatchId: number) => {
    try {
      setLoadingDispatchView(true);
      setError("");
      const response = await gaugeApi.getCalibrationDispatch(calibrationDispatchId);
      setViewingDispatch(response?.data || null);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setLoadingDispatchView(false);
    }
  };
  const updateReturnForm = (name: Exclude<keyof CalibrationReturnForm, "items">, value: string) => setReturnForm((current) => ({ ...current, [name]: value }));
  const updateReturnItem = (gaugeMasterId: number, changes: Partial<CalibrationReturnItemForm>) => setReturnForm((current) => ({
    ...current,
    items: current.items.map((item) => item.gaugeMasterId === gaugeMasterId ? { ...item, ...changes } : item),
  }));
  const createReturnGrn = async () => {
    if (!returningDispatch) return;
    const receivedItems = returnForm.items.filter((item) => item.received);
    if (!receivedItems.length) { setError("Select at least one Gauge ID received from calibration."); return; }
    if (!returnForm.returnLocation.trim()) { setError("Return or holding location is required."); return; }
    const confirmed = await confirmAction({
      title: "Create Calibration Return GRN",
      message: `Receive ${receivedItems.length} Gauge ID${receivedItems.length === 1 ? "" : "s"} against ${returningDispatch.challanNumber || returningDispatch.dispatchNumber}? Pass results will return the gauges to Available; fail results will move them to Rejected.`,
      confirmLabel: "Create Return GRN",
    });
    if (!confirmed) return;
    try {
      setSavingReturn(true);
      setError("");
      const response = await gaugeApi.createCalibrationReturnGrn(returningDispatch.calibrationDispatchId, {
        returnDate: returnForm.returnDate,
        returnLocation: returnForm.returnLocation.trim(),
        remarks: returnForm.remarks,
        items: receivedItems.map((item) => ({
          gaugeMasterId: item.gaugeMasterId,
          calibrationResult: item.calibrationResult,
          calibrationDate: item.calibrationDate,
          certificateNumber: item.certificateNumber,
          remarks: item.remarks,
        })),
      });
      const returnGrnNumber = response?.data?.returnGrnNumber;
      showSuccess(`Calibration Return GRN${returnGrnNumber ? ` ${returnGrnNumber}` : ""} created for ${receivedItems.length} Gauge ID${receivedItems.length === 1 ? "" : "s"}.`);
      setReturningDispatch(null);
      setReturnForm(blankReturnForm());
      setRefreshKey((current) => current + 1);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingReturn(false); }
  };

  return <div className="page-container master-list-page gauge-workflow-page">
    <section className="master-list-header">
      <div><h1>Calibration Workflow</h1></div>
      <div className="gauge-workflow-header-actions">
        <button type="button" className="secondary-action-button" onClick={() => navigate("/masters/gauges")}><ArrowLeft size={16}/>Gauge Master</button>
        <button type="button" className="primary-action-button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading}><RefreshCw size={16}/>Refresh</button>
      </div>
    </section>

    {error && <Alert type="error" message={error}/>} 

    <nav className="gauge-workflow-stepper" aria-label="Calibration lifecycle steps">
      {workflowStepperSteps.map((workflowStep, index) => {
        const Icon = workflowStep.icon;
        const activeIndex = workflowStepperSteps.findIndex((entry) => entry.stage === stage);
        const state = index < activeIndex ? "completed" : index === activeIndex ? "active" : "upcoming";
        return <div key={workflowStep.stage} className={state}><Icon size={16}/><span>{workflowStep.label}</span></div>;
      })}
    </nav>

    <section className="gauge-workflow-summary" aria-label="Calibration workflow summary">
      <button type="button" className={stage === "collection" ? "is-active" : ""} onClick={() => changeStage("collection")}><CircleAlert size={19}/><span><small>Due for collection</small><strong>{totals.collection}</strong><em>{overdueCollectionCount ? `${overdueCollectionCount} overdue` : "Due within 10 days"}</em></span></button>
      <button type="button" className={stage === "ready" ? "is-active" : ""} onClick={() => changeStage("ready")}><ClipboardList size={19}/><span><small>Dispatch queue</small><strong>{totals.ready}</strong><em>Collected Gauge IDs</em></span></button>
      <button type="button" className={stage === "calibration" ? "is-active" : ""} onClick={() => changeStage("calibration")}><CalendarClock size={19}/><span><small>Under calibration</small><strong>{totals.calibration}</strong><em>Return GRN pending</em></span></button>
      <button type="button" className={stage === "service" ? "is-active" : ""} onClick={() => changeStage("service")}><Wrench size={19}/><span><small>Rejected / service</small><strong>{totals.service}</strong><em>Failed or under-service gauges</em></span></button>
    </section>

    <section className="master-list-card gauge-workflow-card">
      <div className="gauge-workflow-card-header">
        <div><h2>{currentStage.label}</h2><p>{currentStage.description}</p></div>
        <span>{displayedRows.length} gauge{displayedRows.length === 1 ? "" : "s"}</span>
      </div>
      {stage === "collection" && <div className="gauge-dispatch-selection-bar gauge-collection-selection-bar"><div><strong>{selectedCollectionRows.length ? `${selectedCollectionRows.length} Gauge ID${selectedCollectionRows.length === 1 ? "" : "s"} selected` : "Select due Gauge IDs"}</strong><span>Collect selected gauges together, then continue with one or more calibration dispatch challans.</span></div><div><button type="button" className="secondary-action-button" disabled={!selectedCollectionRows.length} onClick={() => setSelectedCollectionGaugeIds([])}>Clear</button><button type="button" className="primary-action-button" disabled={!selectedCollectionRows.length} onClick={openCollectionDialog}><CircleAlert size={16}/>Collect for calibration</button></div></div>}
      {stage === "ready" && <div className="gauge-dispatch-selection-bar"><div><strong>{selectedDispatchRows.length ? `${selectedDispatchRows.length} Gauge ID${selectedDispatchRows.length === 1 ? "" : "s"} selected` : "Select collected Gauge IDs"}</strong><span>{selectedDispatchAgencies.length > 1 ? "Selected Gauge IDs belong to different calibration agencies. Create separate challans." : selectedDispatchAgency ? `Calibration Agency: ${selectedDispatchAgency}` : "One challan can contain gauges for one calibration agency."}</span></div><div><button type="button" className="secondary-action-button" onClick={() => document.querySelector(".gauge-dispatch-history")?.scrollIntoView({ behavior: "smooth", block: "start" })}>View Dispatch Challan List</button><button type="button" className="secondary-action-button" disabled={!selectedDispatchRows.length} onClick={() => setSelectedGaugeIds([])}>Clear</button><button type="button" className="primary-action-button" disabled={!selectedDispatchRows.length || selectedDispatchAgencies.length > 1} onClick={openDispatchForm}><ClipboardList size={16}/>Continue to GRN Outward</button></div></div>}
      <div className="master-table-wrapper">
        <table className="master-data-table gauge-workflow-table">
          <thead><tr>{isMultiSelectStage && <th className="gauge-select-column"><input type="checkbox" aria-label={stage === "collection" ? "Select all due Gauge IDs" : "Select all collected Gauge IDs"} checked={stage === "collection" ? queues.collection.length > 0 && selectedCollectionGaugeIds.length === queues.collection.length : queues.ready.length > 0 && selectedGaugeIds.length === queues.ready.length} onChange={(event) => stage === "collection" ? selectAllForCollection(event.target.checked) : selectAllForDispatch(event.target.checked)}/></th>}<th>Gauge ID</th><th>Instrument</th><th>Manufacturer Serial</th><th>Current location</th><th>Calibration condition</th><th>Due date</th><th>Operational status</th><th className="master-actions-column">Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={isMultiSelectStage ? 9 : 8}><div className="master-table-message">Loading calibration workflow...</div></td></tr> : displayedRows.length === 0 ? <tr><td colSpan={isMultiSelectStage ? 9 : 8}><div className="master-empty-state"><div className="master-empty-icon"><Gauge size={30}/></div><h3>No gauges in this workflow stage</h3><p>{stage === "collection" ? "Available gauges appear here when they are due for calibration." : "The next gauge reaching this stage will appear here."}</p></div></td></tr> : displayedRows.map((row) => {
            const ActionIcon = currentStage.icon;
            const isSelected = stage === "collection" ? selectedCollectionGaugeIds.includes(row.gaugeMasterId) : selectedGaugeIds.includes(row.gaugeMasterId);
            return <tr key={row.gaugeMasterId} className={isMultiSelectStage && isSelected ? "gauge-selected-row" : ""}>
              {isMultiSelectStage && <td className="gauge-select-column"><input type="checkbox" checked={isSelected} aria-label={`Select ${row.gaugeId} for ${stage === "collection" ? "calibration collection" : "calibration dispatch"}`} onChange={() => stage === "collection" ? toggleGaugeForCollection(row.gaugeMasterId) : toggleGaugeForDispatch(row.gaugeMasterId)}/></td>}
              <td><strong>{row.gaugeId}</strong></td>
              <td><strong>{row.instrumentName}</strong><small>{row.itemCode}</small></td>
              <td>{row.manufacturerSerialNumber || "—"}</td>
              <td>{row.currentLocation || "—"}<small>{row.assignedTo ? `Assigned to ${row.assignedTo}` : ""}</small></td>
              <td><span className={badgeClass(row.calibrationCondition)}>{labels(row.calibrationCondition)}</span></td>
              <td>{row.calibrationDueDate || "—"}{row.daysLeft !== null && row.daysLeft !== undefined && <small>{row.daysLeft < 0 ? `${Math.abs(row.daysLeft)} day${Math.abs(row.daysLeft) === 1 ? "" : "s"} overdue` : `${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"} left`}</small>}</td>
              <td><span className="gauge-badge operational">{labels(row.effectiveOperationalStatus || row.operationalStatus)}</span></td>
              <td><div className="gauge-workflow-actions">{stage !== "ready" && stage !== "calibration" && <button type="button" className="gauge-workflow-lifecycle-action" onClick={() => lifecycleAction(row)}>{stage === "service" && row.operationalStatus === "UNDER_SERVICE" ? <CheckCircle2 size={15}/> : <ActionIcon size={15}/>} {lifecycleActionLabel(row)}</button>}<button type="button" className="gauge-workflow-view-action" aria-label={`View ${row.gaugeId}`} title="View Gauge Master" onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=view`)}><Eye size={16}/></button></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <section className="master-list-card gauge-dispatch-history"><div className="gauge-workflow-card-header"><div><h2>Recent Calibration Dispatch Challans</h2><p>Each dispatch keeps the calibration agency and individual Gauge ID history.</p></div><span>{dispatches.length} recent</span></div><div className="master-table-wrapper"><table className="master-data-table gauge-dispatch-history-table"><thead><tr><th>Dispatch Challan</th><th>Calibration Agency</th><th>Gauge IDs</th><th>Dispatch Date</th><th>Expected Return</th><th>Status</th><th>Courier / Vehicle</th><th className="master-actions-column">Actions</th></tr></thead><tbody>{dispatches.length === 0 ? <tr><td colSpan={8}><div className="gauge-dispatch-empty">No calibration dispatch challan has been created.</div></td></tr> : dispatches.map((dispatch) => <tr key={dispatch.calibrationDispatchId}><td><strong>{dispatch.challanNumber || dispatch.dispatchNumber}</strong></td><td>{dispatch.calibrationAgency || "—"}</td><td>{dispatch.gaugeIds || `${dispatch.gaugeCount} Gauge ID${Number(dispatch.gaugeCount) === 1 ? "" : "s"}`}</td><td>{dispatch.dispatchDate}</td><td>{dispatch.expectedReturnDate || "—"}</td><td><span className="gauge-badge operational">{labels(dispatch.dispatchStatus || "DISPATCHED")}</span></td><td>{dispatch.courierReference || "—"}</td><td><div className="gauge-dispatch-actions"><button type="button" title="View and print dispatch challan" onClick={() => void viewDispatch(dispatch.calibrationDispatchId)} disabled={loadingDispatchView}>View</button></div></td></tr>)}</tbody></table></div></section>
    {collectionDialogOpen && <div className="gauge-dispatch-view-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingCollection) setCollectionDialogOpen(false); }}><section className="gauge-dispatch-view-dialog gauge-collection-dialog" role="dialog" aria-modal="true" aria-labelledby="gauge-collection-title"><header><div><h2 id="gauge-collection-title">Collect for Calibration</h2><p>{selectedCollectionRows.length} selected Gauge ID{selectedCollectionRows.length === 1 ? "" : "s"}</p></div><button type="button" aria-label="Close collection form" disabled={savingCollection} onClick={() => setCollectionDialogOpen(false)}><X size={18}/></button></header><article className="gauge-collection-form"><div className="master-form-grid"><label className="master-field"><span>Collection Location</span><input value={collectionForm.collectionLocation} placeholder="Calibration collection area" onChange={(event) => updateCollectionForm("collectionLocation", event.target.value)}/><small>{collectionForm.collectionLocation ? "Applied to all selected Gauge IDs." : "Leave blank to use Collected for Calibration."}</small></label><label className="master-field"><span>Collection Date <b>*</b></span><input type="date" value={collectionForm.collectionDate} onChange={(event) => updateCollectionForm("collectionDate", event.target.value)}/></label><label className="master-field span-2"><span>Remarks</span><textarea rows={3} value={collectionForm.remarks} placeholder="Optional collection notes" onChange={(event) => updateCollectionForm("remarks", event.target.value)}/></label></div></article><footer><button type="button" className="secondary-action-button" disabled={savingCollection} onClick={() => setCollectionDialogOpen(false)}>Cancel</button><button type="button" className="primary-action-button" disabled={savingCollection || !selectedCollectionRows.length} onClick={() => void collectSelectedGauges()}>{savingCollection ? "Collecting..." : "Collect selected gauges"}</button></footer></section></div>}
    {viewingDispatch && <div className="gauge-dispatch-view-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingDispatch(null); }}><section className="gauge-dispatch-view-dialog" role="dialog" aria-modal="true" aria-labelledby="gauge-dispatch-view-title"><header><div><h2 id="gauge-dispatch-view-title">Calibration Dispatch Challan</h2><p>{viewingDispatch.challanNumber || viewingDispatch.dispatchNumber}</p></div><button type="button" aria-label="Close dispatch challan" onClick={() => setViewingDispatch(null)}><X size={18}/></button></header><article className="gauge-dispatch-document"><div className="gauge-dispatch-document-heading"><div><strong>ATECH AUTOMATION</strong><span>Calibration Dispatch</span></div><div><span>Challan Number</span><strong>{viewingDispatch.challanNumber || viewingDispatch.dispatchNumber}</strong></div></div><div className="gauge-dispatch-document-meta"><div><span>Calibration Agency</span><strong>{viewingDispatch.calibrationAgency || "—"}</strong></div><div><span>Dispatch Date</span><strong>{viewingDispatch.dispatchDate || "—"}</strong></div><div><span>Expected Return</span><strong>{viewingDispatch.expectedReturnDate || "—"}</strong></div><div><span>Courier / Vehicle</span><strong>{viewingDispatch.courierReference || "—"}</strong></div><div><span>Dispatch From</span><strong>{viewingDispatch.dispatchLocation || "—"}</strong></div><div><span>Status</span><strong>{labels(viewingDispatch.dispatchStatus || "DISPATCHED")}</strong></div></div><section className="gauge-dispatch-document-items"><h3>Gauge IDs Dispatched</h3><table><thead><tr><th>S. No.</th><th>Gauge ID</th><th>Instrument</th><th>Manufacturer Serial</th><th>Dispatched To</th></tr></thead><tbody>{viewingDispatch.items.map((item, index) => <tr key={item.gaugeHistoryId}><td>{index + 1}</td><td><strong>{item.gaugeId}</strong></td><td>{item.instrumentName || "—"}</td><td>{item.manufacturerSerialNumber || "—"}</td><td>{item.dispatchedTo || viewingDispatch.calibrationAgency || "—"}</td></tr>)}</tbody></table></section>{viewingDispatch.remarks && <section className="gauge-dispatch-document-remarks"><h3>Remarks</h3><p>{viewingDispatch.remarks}</p></section>}</article><footer><button type="button" className="secondary-action-button" onClick={() => setViewingDispatch(null)}>Close</button><button type="button" className="primary-action-button" onClick={() => window.print()}><Printer size={16}/>Print Challan</button></footer></section></div>}
    {returningDispatch && <div className="gauge-dispatch-view-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingReturn) setReturningDispatch(null); }}><section className="gauge-dispatch-view-dialog gauge-return-grn-dialog" role="dialog" aria-modal="true" aria-labelledby="gauge-return-grn-title"><header><div><h2 id="gauge-return-grn-title">Create Calibration Return GRN</h2><p>Against dispatch challan {returningDispatch.challanNumber || returningDispatch.dispatchNumber}</p></div><button type="button" aria-label="Close Calibration Return GRN" disabled={savingReturn} onClick={() => setReturningDispatch(null)}><X size={18}/></button></header><article className="gauge-return-grn-form"><div className="master-form-grid"><label className="master-field"><span>Calibration Agency</span><input value={returningDispatch.calibrationAgency || ""} readOnly/></label><label className="master-field"><span>Return Date <b>*</b></span><input type="date" min={returningDispatch.dispatchDate} value={returnForm.returnDate} onChange={(event) => updateReturnForm("returnDate", event.target.value)}/></label><label className="master-field span-2"><span>Return / Holding Location <b>*</b></span><input value={returnForm.returnLocation} placeholder="Main Stores / Calibration Hold / Dispatch Rack" onChange={(event) => updateReturnForm("returnLocation", event.target.value)}/></label><label className="master-field span-2"><span>Remarks</span><textarea rows={2} value={returnForm.remarks} placeholder="Optional receiving notes" onChange={(event) => updateReturnForm("remarks", event.target.value)}/></label></div><section className="gauge-return-items"><div><h3>Received Gauge IDs</h3><p>Select only the gauges received now. Unselected Gauge IDs remain under calibration for a later Return GRN.</p></div><div className="master-table-wrapper"><table><thead><tr><th>Receive</th><th>Gauge ID</th><th>Instrument</th><th>Result</th><th>Calibration Date</th><th>Certificate No.</th><th>Item Remarks</th></tr></thead><tbody>{returnForm.items.map((item) => <tr key={item.gaugeMasterId}><td><input type="checkbox" checked={item.received} aria-label={`Receive ${item.gaugeId}`} onChange={(event) => updateReturnItem(item.gaugeMasterId, { received: event.target.checked })}/></td><td><strong>{item.gaugeId}</strong></td><td>{item.instrumentName || "—"}</td><td><select value={item.calibrationResult} disabled={!item.received} onChange={(event) => updateReturnItem(item.gaugeMasterId, { calibrationResult: event.target.value as "PASS" | "FAIL" })}><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></td><td><input type="date" value={item.calibrationDate} disabled={!item.received} onChange={(event) => updateReturnItem(item.gaugeMasterId, { calibrationDate: event.target.value })}/></td><td><input value={item.certificateNumber} disabled={!item.received} placeholder="Optional" onChange={(event) => updateReturnItem(item.gaugeMasterId, { certificateNumber: event.target.value })}/></td><td><input value={item.remarks} disabled={!item.received} placeholder="Optional" onChange={(event) => updateReturnItem(item.gaugeMasterId, { remarks: event.target.value })}/></td></tr>)}</tbody></table></div></section></article><footer><button type="button" className="secondary-action-button" disabled={savingReturn} onClick={() => setReturningDispatch(null)}>Cancel</button><button type="button" className="primary-action-button" disabled={savingReturn || !returnForm.items.some((item) => item.received)} onClick={() => void createReturnGrn()}>{savingReturn ? "Creating..." : "Create Return GRN"}</button></footer></section></div>}
  </div>;
}
