import { AlertTriangle, CheckCircle2, ClipboardList, Eye, Gauge, Pencil, Plus, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayInAppTimeZone } from "../../utils/formatDateTime";
import { apiMessage } from "../../api/client";
import { gaugeApi } from "../../api/gauge.api";
import Alert from "../../components/Alert";
import DateInput from "../../components/DateInput";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerPage.css";
import "./GaugeMasterPage.css";

type GaugeRow = {
  gaugeMasterId: number; gaugeId: string; instrumentName: string; itemCode: string;
  manufacturerSerialNumber?: string | null; grnNumber: string; calibrationDueDate?: string | null;
  calibrationCondition: string; operationalStatus: string; currentLocation: string; assignedTo?: string | null;
  storageLocation?: string | null; daysLeft?: number | null;
};
type Option = { value: string; label: string };
type BulkAction = "issue" | "return";
type BulkForm = { issuedTo: string; issueLocation: string; issueDate: string; returnLocation: string; remarks: string };
type CalibrationAlerts = { dueSoonCount: number; dueTodayCount: number; expiredCount: number; dueWithinTenDays: number };

const label = (value?: string | null) => String(value || "-").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const conditionClass = (value: string) => `gauge-badge ${String(value).toLowerCase().replace(/_/g, "-")}`;
const today = todayInAppTimeZone;
const canIssue = (row: GaugeRow) => row.operationalStatus === "AVAILABLE" && ["ON_TIME", "DUE_SOON", "DUE_TODAY"].includes(row.calibrationCondition);
const blankBulkForm = (): BulkForm => ({ issuedTo: "", issueLocation: "", issueDate: today(), returnLocation: "", remarks: "" });

export default function GaugeMasterPage() {
  const navigate = useNavigate();
  const { showSuccess, confirmAction } = useAppFeedback();
  const [rows, setRows] = useState<GaugeRow[]>([]);
  const [operationalStatuses, setOperationalStatuses] = useState<Option[]>([]);
  const [calibrationConditions, setCalibrationConditions] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [operationalStatus, setOperationalStatus] = useState("");
  const [calibrationCondition, setCalibrationCondition] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkForm, setBulkForm] = useState<BulkForm>(blankBulkForm);
  const [savingBulk, setSavingBulk] = useState(false);
  const [alerts, setAlerts] = useState<CalibrationAlerts | null>(null);

  useEffect(() => {
    void gaugeApi.lookups().then((response) => {
      setOperationalStatuses(response?.data?.operationalStatuses ?? []);
      setCalibrationConditions(response?.data?.calibrationConditions ?? []);
    }).catch((reason) => setError(apiMessage(reason)));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      gaugeApi.list({ search, operationalStatus, calibrationCondition, page, pageSize: PAGE_SIZE }),
      gaugeApi.alerts(),
    ])
      .then(([response, alertResponse]) => {
        if (!active) return;
        const nextRows = response?.data ?? [];
        setRows(nextRows);
        setTotal(Number(response?.meta?.total || 0));
        setAlerts(alertResponse?.data ?? null);
        setSelectedIds((current) => current.filter((id) => nextRows.some((row: GaugeRow) => row.gaugeMasterId === id)));
      })
      .catch((reason) => active && setError(apiMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [search, operationalStatus, calibrationCondition, page, refreshKey]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.gaugeMasterId)), [rows, selectedIds]);
  const selectedStatus = selectedRows[0]?.operationalStatus || "";
  const selectedAction: BulkAction | null = selectedStatus === "AVAILABLE" ? "issue" : selectedStatus === "ISSUED" ? "return" : null;
  const returnHandover = selectedRows[0] ? `${selectedRows[0].currentLocation || ""}|${selectedRows[0].assignedTo || ""}` : "";
  const issuedRows = rows.filter((row) => row.operationalStatus === "ISSUED");
  const firstIssuedHandover = issuedRows[0] ? `${issuedRows[0].currentLocation || ""}|${issuedRows[0].assignedTo || ""}` : "";
  const eligibleRows = operationalStatus === "AVAILABLE" ? rows.filter(canIssue) : operationalStatus === "ISSUED" ? issuedRows.filter((row) => `${row.currentLocation || ""}|${row.assignedTo || ""}` === firstIssuedHandover) : [];
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.includes(row.gaugeMasterId));

  const resetBulk = () => { setSelectedIds([]); setBulkAction(null); setBulkForm(blankBulkForm()); };
  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); resetBulk(); };
  const toggleRow = (row: GaugeRow) => {
    const selected = selectedIds.includes(row.gaugeMasterId);
    if (selected) { setSelectedIds((current) => current.filter((id) => id !== row.gaugeMasterId)); setBulkAction(null); return; }
    if (selectedStatus && row.operationalStatus !== selectedStatus) return;
    if (row.operationalStatus === "ISSUED" && selectedStatus === "ISSUED" && `${row.currentLocation || ""}|${row.assignedTo || ""}` !== returnHandover) return;
    if (!canIssue(row) && row.operationalStatus !== "ISSUED") return;
    setSelectedIds((current) => [...current, row.gaugeMasterId]);
    setBulkAction(null);
  };
  const rowDisabled = (row: GaugeRow) => {
    if (selectedIds.includes(row.gaugeMasterId)) return false;
    if (selectedStatus && row.operationalStatus !== selectedStatus) return true;
    if (row.operationalStatus === "ISSUED" && selectedStatus === "ISSUED" && `${row.currentLocation || ""}|${row.assignedTo || ""}` !== returnHandover) return true;
    return !canIssue(row) && row.operationalStatus !== "ISSUED";
  };
  const openBulkAction = (action: BulkAction) => {
    const sharedStorageLocations = [...new Set(selectedRows.map((row) => String(row.storageLocation || "").trim()).filter(Boolean))];
    setBulkForm({ ...blankBulkForm(), returnLocation: action === "return" && sharedStorageLocations.length === 1 ? sharedStorageLocations[0] : "" });
    setBulkAction(action);
    setError("");
  };
  const updateBulkForm = (name: keyof BulkForm, value: string) => setBulkForm((current) => ({ ...current, [name]: value }));
  const executeBulk = async () => {
    if (!bulkAction || !selectedRows.length) return;
    if (bulkAction === "issue" && (!bulkForm.issuedTo.trim() || !bulkForm.issueLocation.trim())) {
      setError("Issued To and Issue Location are required.");
      return;
    }
    if (bulkAction === "return" && !bulkForm.returnLocation.trim()) {
      setError("Return Location is required.");
      return;
    }
    const actionLabel = bulkAction === "issue" ? "issue" : "return";
    const confirmed = await confirmAction({
      title: `Confirm bulk ${actionLabel}`,
      message: `${actionLabel === "issue" ? "Issue" : "Return"} ${selectedRows.length} selected Gauge ID${selectedRows.length === 1 ? "" : "s"}? Each gauge will receive an individual lifecycle-history entry.`,
      confirmLabel: actionLabel === "issue" ? "Issue gauges" : "Return gauges",
    });
    if (!confirmed) return;
    try {
      setSavingBulk(true); setError("");
      const response = bulkAction === "issue"
        ? await gaugeApi.bulkIssue({ gaugeMasterIds: selectedIds, issuedTo: bulkForm.issuedTo, issueLocation: bulkForm.issueLocation, issueDate: bulkForm.issueDate, remarks: bulkForm.remarks })
        : await gaugeApi.bulkReturn({ gaugeMasterIds: selectedIds, returnLocation: bulkForm.returnLocation, remarks: bulkForm.remarks });
      const result = response?.data;
      showSuccess(`${result?.gaugeCount || selectedRows.length} gauge${selectedRows.length === 1 ? "" : "s"} ${bulkAction === "issue" ? "issued" : "returned"}${result?.movementNumber ? ` under ${result.movementNumber}` : ""}.`);
      resetBulk();
      setRefreshKey((current) => current + 1);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSavingBulk(false); }
  };

  return <div className="page-container master-list-page gauge-master-page">
    <section className="master-list-header"><div><p className="page-eyebrow">MASTERS / GAUGE MASTER</p>
      <h1>Gauge Master</h1><span>Register every physical instrument received through GRN and maintain its calibration lifecycle.</span></div>
      <div className="gauge-master-header-actions"><button type="button" className="secondary-action-button" onClick={() => navigate("/masters/gauges/workflow")}><ClipboardList size={17}/>Calibration Workflow</button><button type="button" className="primary-action-button" onClick={() => navigate("/masters/gauges/register")}><Plus size={17}/>Register Gauges from GRN</button></div>
    </section>
    <section className="master-list-card">
      {error && <Alert type="error" message={error}/>} 
      <div className="gauge-master-info"><Gauge size={18}/><span>Inventory records the received quantity. Gauge Master holds one Gauge ID for every physical instrument and blocks duplicate registration above the accepted GRN quantity.</span></div>
      {alerts && (alerts.dueWithinTenDays > 0 || alerts.expiredCount > 0) && <div className="gauge-calibration-alert" role="status"><AlertTriangle size={19}/><div><strong>Calibration attention required</strong><span>{alerts.dueWithinTenDays ? `${alerts.dueWithinTenDays} gauge${alerts.dueWithinTenDays === 1 ? " is" : "s are"} due within 10 days.` : ""}{alerts.dueTodayCount ? ` ${alerts.dueTodayCount} due today.` : ""}{alerts.expiredCount ? ` ${alerts.expiredCount} expired.` : ""}</span></div><button type="button" onClick={() => setFilter(setCalibrationCondition, "DUE_SOON")}>View due soon</button></div>}
      <div className="gauge-filter-grid app-list-toolbar"><div className="master-search-box"><Search size={18}/><input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search Gauge ID, instrument, serial, GRN or location"/></div>
        <select value={calibrationCondition} onChange={(event) => setFilter(setCalibrationCondition, event.target.value)}><option value="">All Calibration Conditions</option>{calibrationConditions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select value={operationalStatus} onChange={(event) => setFilter(setOperationalStatus, event.target.value)}><option value="">All Operational Statuses</option>{operationalStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      
        <Pagination page={page} total={total} onPageChange={(nextPage) => { setPage(nextPage); resetBulk(); }} itemLabel="gauges" disabled={loading}/>
      </div>
      <div className="gauge-bulk-selection-bar"><div><strong>{selectedRows.length ? `${selectedRows.length} gauge${selectedRows.length === 1 ? "" : "s"} selected` : "No gauges selected"}</strong><span>{selectedAction === "issue" ? "Ready to issue to one user and location." : selectedAction === "return" ? "Ready to return from the same user and location." : "Select eligible Available or Issued gauges to continue."}</span></div><div className="gauge-bulk-selection-actions"><button type="button" className="secondary-action-button" disabled={!selectedRows.length} onClick={resetBulk}>Clear</button><button type="button" className="primary-action-button" disabled={selectedAction !== "issue"} title={selectedAction === "issue" ? "Issue selected gauges" : "Select eligible Available gauges"} onClick={() => openBulkAction("issue")}><Send size={16}/>Issue Selected</button><button type="button" className="primary-action-button" disabled={selectedAction !== "return"} title={selectedAction === "return" ? "Return selected gauges" : "Select compatible Issued gauges"} onClick={() => openBulkAction("return")}><CheckCircle2 size={16}/>Return Selected</button></div></div>
      {bulkAction && <section className="gauge-bulk-action-card"><header><div><h2>{bulkAction === "issue" ? "Issue selected gauges" : "Return selected gauges"}</h2><p>{selectedRows.map((row) => row.gaugeId).join(", ")}</p></div><button type="button" aria-label="Close bulk action" onClick={() => setBulkAction(null)}><X size={18}/></button></header>
        <div className="master-form-grid">
          {bulkAction === "issue" ? <><label className="master-field"><span>Issued To <b>*</b></span><input value={bulkForm.issuedTo} onChange={(event) => updateBulkForm("issuedTo", event.target.value)} placeholder="User or department"/></label><label className="master-field"><span>Issue Location <b>*</b></span><input value={bulkForm.issueLocation} onChange={(event) => updateBulkForm("issueLocation", event.target.value)} placeholder="Working location"/></label><label className="master-field"><span>Issue Date</span><DateInput type="date" value={bulkForm.issueDate} onChange={(event) => updateBulkForm("issueDate", event.target.value)}/></label></> : <><label className="master-field"><span>Return Location <b>*</b></span><input value={bulkForm.returnLocation} onChange={(event) => updateBulkForm("returnLocation", event.target.value)} placeholder="Main Stores / Gauge Rack"/></label><label className="master-field"><span>Return Date</span><DateInput type="date" value={today()} readOnly/><small>Return date is always recorded as today.</small></label><div className="gauge-bulk-handover"><strong>Issued from</strong><span>{selectedRows[0]?.currentLocation || "—"}</span><small>{selectedRows[0]?.assignedTo ? `Issued to ${selectedRows[0].assignedTo}` : "No user recorded"}</small></div></>}
          <label className="master-field span-2"><span>Remarks</span><textarea rows={2} value={bulkForm.remarks} onChange={(event) => updateBulkForm("remarks", event.target.value)} placeholder="Optional handover, purpose or job reference"/></label>
        </div>
        <footer><span>One voucher will be created; each Gauge ID keeps its own history entry.</span><button type="button" className="primary-action-button" disabled={savingBulk} onClick={() => void executeBulk()}>{savingBulk ? "Saving..." : `${bulkAction === "issue" ? "Confirm Issue" : "Confirm Return"} (${selectedRows.length})`}</button></footer>
      </section>}
      <div className="master-table-wrapper"><table className="master-data-table gauge-master-table"><thead><tr><th className="gauge-select-column"><input type="checkbox" aria-label="Select all eligible gauges on this page" checked={allEligibleSelected} disabled={!eligibleRows.length} title={operationalStatus ? "Select all eligible gauges on this page" : "Filter by Available or Issued to select all"} onChange={(event) => { setSelectedIds(event.target.checked ? eligibleRows.map((row) => row.gaugeMasterId) : []); setBulkAction(null); }}/></th><th>Gauge ID</th><th>Instrument</th><th>GRN</th><th>Manufacturer Serial</th><th>Calibration</th><th>Due Date</th><th>Operational Status</th><th>Location / User</th><th className="master-actions-column">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={10}><div className="master-table-message">Loading gauges...</div></td></tr> : rows.length === 0 ? <tr><td colSpan={10}><div className="master-empty-state"><div className="master-empty-icon"><Gauge size={30}/></div><h3>No Gauge Master records found</h3><p>Post an Instruments &amp; Gauges GRN, then register each physical gauge here.</p><button type="button" className="primary-action-button" onClick={() => navigate("/masters/gauges/register")}><Plus size={17}/>Register Gauges</button></div></td></tr> : rows.map((row) => { const disabled = rowDisabled(row); const selected = selectedIds.includes(row.gaugeMasterId); const selectionReason = !canIssue(row) && row.operationalStatus !== "ISSUED" ? "Only gauges with a current calibration can be issued." : selectedStatus === "ISSUED" && row.operationalStatus === "ISSUED" ? "Bulk return requires the same issued user and location." : "Select this gauge"; return <tr key={row.gaugeMasterId} className={selected ? "gauge-selected-row" : ""}><td className="gauge-select-column"><input type="checkbox" checked={selected} disabled={disabled} title={selectionReason} aria-label={`Select ${row.gaugeId}`} onChange={() => toggleRow(row)}/></td><td><strong>{row.gaugeId}</strong></td><td><strong>{row.instrumentName}</strong><small>{row.itemCode}</small></td><td>{row.grnNumber}</td><td>{row.manufacturerSerialNumber || "—"}</td><td><span className={conditionClass(row.calibrationCondition)}>{label(row.calibrationCondition)}</span>{row.calibrationCondition === "DUE_TODAY" && <small>Usable today</small>}</td><td>{row.calibrationDueDate || "—"}{row.daysLeft !== null && row.daysLeft !== undefined && <small>{row.daysLeft} day{Math.abs(row.daysLeft) === 1 ? "" : "s"}</small>}</td><td><div className="gauge-status-cell"><span className="gauge-badge operational">{label(row.operationalStatus)}</span></div></td><td>{row.currentLocation}<small>{row.assignedTo ? `Issued to ${row.assignedTo}` : row.storageLocation ? `Home: ${row.storageLocation}` : ""}</small></td><td><div className="master-row-actions"><button type="button" title="View Gauge Master" aria-label={`View ${row.gaugeId}`} onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=view`)}><Eye size={16}/></button><button type="button" title="Edit Gauge Master" aria-label={`Edit ${row.gaugeId}`} onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=edit`)}><Pencil size={16}/></button></div></td></tr>; })}</tbody>
      </table></div>
      
    </section>
  </div>;
}
