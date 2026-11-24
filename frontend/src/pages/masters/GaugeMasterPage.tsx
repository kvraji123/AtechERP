import { AlertTriangle, CheckCircle2, ClipboardList, Filter, Gauge, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayInAppTimeZone } from "../../utils/formatDateTime";
import { apiMessage } from "../../api/client";
import { gaugeApi } from "../../api/gauge.api";
import { listAllActiveLocationMasters, type LocationMasterRow } from "../../api/locationMaster.api";
import Alert from "../../components/Alert";
import DateInput from "../../components/DateInput";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerPage.css";
import "./GaugeMasterPage.css";

type GaugeRow = {
  gaugeMasterId: number; gaugeId: string; instrumentName: string; itemCode: string;
  grnNumber: string; calibrationDueDate?: string | null;
  calibrationCondition: string; operationalStatus: string; effectiveOperationalStatus?: string; currentLocation: string; assignedTo?: string | null;
  storageLocation?: string | null; daysLeft?: number | null;
};
type Option = { value: string; label: string };
type BulkAction = "issue" | "return";
type BulkForm = { issuedTo: string; issueLocation: string; issueDate: string; returnLocation: string; remarks: string };
type CalibrationAlerts = { dueSoonCount: number; dueTodayCount: number; expiredCount: number; dueWithinTenDays: number };
type HeaderFilterKey = "instrument" | "calibrationCondition" | "operationalStatus" | "location";
type HeaderFilters = Record<HeaderFilterKey, string>;

const label = (value?: string | null) => String(value || "-").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const conditionClass = (value: string) => `gauge-badge ${String(value).toLowerCase().replace(/_/g, "-")}`;
const today = todayInAppTimeZone;
const canIssue = (row: GaugeRow) => row.operationalStatus === "AVAILABLE" && ["ON_TIME", "DUE_SOON", "DUE_TODAY"].includes(row.calibrationCondition);
const blankBulkForm = (): BulkForm => ({ issuedTo: "", issueLocation: "", issueDate: today(), returnLocation: "", remarks: "" });
const blankHeaderFilters = (): HeaderFilters => ({ instrument: "", calibrationCondition: "", operationalStatus: "", location: "" });
const locationLabel = (location: LocationMasterRow) => `${location.warehouseName} / ${location.locationName}`;

export default function GaugeMasterPage() {
  const navigate = useNavigate();
  const { showSuccess, confirmAction } = useAppFeedback();
  const [rows, setRows] = useState<GaugeRow[]>([]);
  const [operationalStatuses, setOperationalStatuses] = useState<Option[]>([]);
  const [calibrationConditions, setCalibrationConditions] = useState<Option[]>([]);
  const [issueLocations, setIssueLocations] = useState<LocationMasterRow[]>([]);
  const [issueLocationsLoading, setIssueLocationsLoading] = useState(true);
  const [issueLocationsError, setIssueLocationsError] = useState("");
  const [headerFilters, setHeaderFilters] = useState<HeaderFilters>(blankHeaderFilters);
  const [openHeaderFilter, setOpenHeaderFilter] = useState<HeaderFilterKey | null>(null);
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
    void listAllActiveLocationMasters()
      .then((locations) => active && setIssueLocations(locations))
      .catch((reason) => active && setIssueLocationsError(apiMessage(reason)))
      .finally(() => active && setIssueLocationsLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      gaugeApi.list({ ...headerFilters, page, pageSize: PAGE_SIZE }),
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
  }, [headerFilters, page, refreshKey]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.gaugeMasterId)), [rows, selectedIds]);
  const selectedInstrumentSummary = useMemo(() => {
    const instruments = [...new Set(selectedRows.map((row) => String(row.instrumentName || "").trim()).filter(Boolean))];
    if (instruments.length <= 2) return instruments.join(", ") || "—";
    return `${instruments.slice(0, 2).join(", ")} +${instruments.length - 2} more`;
  }, [selectedRows]);
  const selectedStatus = selectedRows[0]?.operationalStatus || "";
  const selectedAction: BulkAction | null = selectedStatus === "AVAILABLE" ? "issue" : selectedStatus === "ISSUED" ? "return" : null;
  const returnHandover = selectedRows[0] ? `${selectedRows[0].currentLocation || ""}|${selectedRows[0].assignedTo || ""}` : "";
  const issuedRows = rows.filter((row) => row.operationalStatus === "ISSUED");
  const firstIssuedHandover = issuedRows[0] ? `${issuedRows[0].currentLocation || ""}|${issuedRows[0].assignedTo || ""}` : "";
  const eligibleRows = headerFilters.operationalStatus === "AVAILABLE" ? rows.filter(canIssue) : ["ISSUED", "CALIBRATION_EXPIRED"].includes(headerFilters.operationalStatus) ? issuedRows.filter((row) => `${row.currentLocation || ""}|${row.assignedTo || ""}` === firstIssuedHandover) : [];
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.includes(row.gaugeMasterId));
  const alertAction = alerts?.expiredCount ? { label: "View expired", condition: "EXPIRED" } : alerts?.dueTodayCount ? { label: "View due today", condition: "DUE_TODAY" } : { label: "View due soon", condition: "DUE_SOON" };
  const calibrationAlertSummary = alerts ? [
    alerts.expiredCount ? `${alerts.expiredCount} expired` : "",
    alerts.dueTodayCount ? `${alerts.dueTodayCount} due today` : "",
    alerts.dueSoonCount ? `${alerts.dueSoonCount} due soon` : "",
  ].filter(Boolean).join(" · ") : "";

  const resetBulk = () => { setSelectedIds([]); setBulkAction(null); setBulkForm(blankBulkForm()); };
  const setHeaderFilter = (key: HeaderFilterKey, value: string) => {
    setHeaderFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    resetBulk();
  };
  const headerFilter = (key: HeaderFilterKey, columnLabel: string) => {
    const value = headerFilters[key];
    const usesSelect = key === "calibrationCondition" || key === "operationalStatus";
    return <th key={key}><div className="gauge-column-header"><span>{columnLabel}</span><div className="gauge-column-filter"><button type="button" className={value ? "active" : ""} aria-label={`Filter ${columnLabel}`} title={`Filter ${columnLabel}`} onClick={() => setOpenHeaderFilter((current) => current === key ? null : key)}><Filter size={12}/></button>{openHeaderFilter === key && <div className="gauge-column-filter-menu">{usesSelect ? <select aria-label={`Select ${columnLabel} filter`} value={value} onChange={(event) => { setHeaderFilter(key, event.target.value); setOpenHeaderFilter(null); }}><option value="">All</option>{(key === "calibrationCondition" ? calibrationConditions : operationalStatuses).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <><input aria-label={`Filter ${columnLabel}`} autoFocus type="search" value={value} onChange={(event) => setHeaderFilter(key, event.target.value)} placeholder="Contains…"/>{value && <button type="button" className="gauge-column-filter-clear" onClick={() => { setHeaderFilter(key, ""); setOpenHeaderFilter(null); }}>Clear</button>}</>}</div>}</div></div></th>;
  };
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
    if (bulkAction === "issue" && (issueLocationsLoading || !issueLocations.length)) {
      setError(issueLocationsError || "Active Location Master values are unavailable. Create an active location before issuing a gauge.");
      return;
    }
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
  const retire = async (row: GaugeRow) => {
    const confirmed = await confirmAction({
      title: "Retire Gauge Master?",
      message: `${row.gaugeId} will be retired and excluded from further issue or calibration. Its complete history will be retained.`,
      confirmLabel: "Retire Gauge",
    });
    if (!confirmed) return;
    try {
      setError("");
      const response = await gaugeApi.retire(row.gaugeMasterId);
      showSuccess(response?.message || "Gauge Master record retired.");
      setRefreshKey((current) => current + 1);
    } catch (retireError) { setError(apiMessage(retireError)); }
  };

  return <div className="page-container master-list-page gauge-master-page">
    <section className="master-list-header"><div><h1>Gauge Master</h1></div>
      <div className="gauge-master-header-actions"><button type="button" className="secondary-action-button" onClick={() => navigate("/masters/gauges/workflow")}><ClipboardList size={17}/>Calibration Workflow</button>{calibrationAlertSummary && <div className="gauge-header-alert" role="status"><AlertTriangle size={15}/><span>{calibrationAlertSummary}</span><button type="button" onClick={() => setHeaderFilter("calibrationCondition", alertAction.condition)} title={alertAction.label}>View</button></div>}<button type="button" className="primary-action-button" onClick={() => navigate("/masters/gauges/register")}><Plus size={17}/>Register Gauges from GRN</button></div>
    </section>
    <section className="master-list-card">
      {error && <Alert type="error" message={error}/>} 
      <div className="gauge-bulk-selection-bar"><div><strong>{selectedRows.length ? `${selectedRows.length} gauge${selectedRows.length === 1 ? "" : "s"} selected` : "No gauges selected"}</strong><span>{selectedAction === "issue" ? "Ready to issue to one user and location." : selectedAction === "return" ? "Ready to return from the same user and location." : "Select eligible Available or Issued gauges to continue."}</span></div><div className="gauge-bulk-selection-actions"><button type="button" className="secondary-action-button" disabled={!selectedRows.length} onClick={resetBulk}>Clear</button><button type="button" className="primary-action-button" disabled={selectedAction !== "issue"} title={selectedAction === "issue" ? "Issue selected gauges" : "Select eligible Available gauges"} onClick={() => openBulkAction("issue")}><Send size={16}/>Issue Selected</button><button type="button" className="primary-action-button" disabled={selectedAction !== "return"} title={selectedAction === "return" ? "Return selected gauges" : "Select compatible Issued gauges"} onClick={() => openBulkAction("return")}><CheckCircle2 size={16}/>Return Selected</button><Pagination page={page} total={total} onPageChange={(nextPage) => { setPage(nextPage); resetBulk(); }} itemLabel="gauges" disabled={loading}/></div></div>
      {bulkAction && <div className="gauge-bulk-action-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingBulk) setBulkAction(null); }}><section className="gauge-bulk-action-dialog" role="dialog" aria-modal="true" aria-labelledby="gauge-bulk-action-title"><header><div><h2 id="gauge-bulk-action-title">{bulkAction === "issue" ? selectedRows.length === 1 ? "Issue gauge" : "Issue selected gauges" : selectedRows.length === 1 ? "Return gauge" : "Return selected gauges"}</h2><p>{selectedRows.length === 1 ? selectedRows[0]?.gaugeId : `${selectedRows.length} Gauge IDs selected`} <span>• Instrument: {selectedInstrumentSummary}</span></p></div><button type="button" aria-label="Close action dialog" disabled={savingBulk} onClick={() => setBulkAction(null)}><X size={18}/></button></header>
        <div className="master-form-grid">
          {bulkAction === "issue" ? <><label className="master-field"><span>Issued To <b>*</b></span><input value={bulkForm.issuedTo} onChange={(event) => updateBulkForm("issuedTo", event.target.value)} placeholder="User or department"/></label><label className="master-field span-2 gauge-bulk-location-field"><span>Issue Location <b>*</b></span><select value={bulkForm.issueLocation} disabled={issueLocationsLoading || !issueLocations.length} onChange={(event) => updateBulkForm("issueLocation", event.target.value)}><option value="">{issueLocationsLoading ? "Loading locations…" : "Select issue location"}</option>{issueLocations.map((location) => <option key={location.locationMasterId} value={locationLabel(location)}>{locationLabel(location)}</option>)}</select><small>{issueLocationsError || "Active values are fetched from Location Master."}</small></label><label className="master-field"><span>Issue Date</span><DateInput type="date" value={bulkForm.issueDate} onChange={(event) => updateBulkForm("issueDate", event.target.value)}/></label></> : <><label className="master-field span-2 gauge-bulk-location-field"><span>Return Location <b>*</b></span><input value={bulkForm.returnLocation} onChange={(event) => updateBulkForm("returnLocation", event.target.value)} placeholder="Main Stores / Gauge Rack"/></label><label className="master-field"><span>Return Date</span><DateInput type="date" value={today()} readOnly/><small>Return date is always recorded as today.</small></label><div className="gauge-bulk-handover"><strong>Issued from</strong><span>{selectedRows[0]?.currentLocation || "—"}</span><small>{selectedRows[0]?.assignedTo ? `Issued to ${selectedRows[0].assignedTo}` : "No user recorded"}</small></div></>}
          <label className="master-field span-2"><span>Remarks</span><textarea rows={2} value={bulkForm.remarks} onChange={(event) => updateBulkForm("remarks", event.target.value)} placeholder="Optional handover, purpose or job reference"/></label>
        </div>
        <footer><span>One voucher will be created; each Gauge ID keeps its own history entry.</span><button type="button" className="primary-action-button" disabled={savingBulk || (bulkAction === "issue" && (issueLocationsLoading || !issueLocations.length))} onClick={() => void executeBulk()}>{savingBulk ? "Saving..." : `${bulkAction === "issue" ? "Confirm Issue" : "Confirm Return"} (${selectedRows.length})`}</button></footer>
      </section></div>}
      <div className="master-table-wrapper"><table className="master-data-table gauge-master-table"><thead><tr><th className="gauge-select-column"><input type="checkbox" aria-label="Select all eligible gauges on this page" checked={allEligibleSelected} disabled={!eligibleRows.length} title={headerFilters.operationalStatus ? "Select all eligible gauges on this page" : "Filter by Available or Issued to select all"} onChange={(event) => { setSelectedIds(event.target.checked ? eligibleRows.map((row) => row.gaugeMasterId) : []); setBulkAction(null); }}/></th><th>Gauge ID</th>{headerFilter("instrument", "Instrument")}<th>GRN</th>{headerFilter("calibrationCondition", "Calibration")}<th>Due Date</th>{headerFilter("operationalStatus", "Operational Status")}{headerFilter("location", "Location / User")}<th className="master-actions-column">Actions</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={9}><div className="master-table-message">Loading gauges...</div></td></tr> : rows.length === 0 ? <tr><td colSpan={9}><div className="master-empty-state"><div className="master-empty-icon"><Gauge size={30}/></div><h3>No Gauge Master records found</h3><p>Post an Instruments &amp; Gauges GRN, then register each physical gauge here.</p><button type="button" className="primary-action-button" onClick={() => navigate("/masters/gauges/register")}><Plus size={17}/>Register Gauges</button></div></td></tr> : rows.map((row) => { const disabled = rowDisabled(row); const selected = selectedIds.includes(row.gaugeMasterId); const selectionReason = !canIssue(row) && row.operationalStatus !== "ISSUED" ? "Only gauges with a current calibration can be issued." : selectedStatus === "ISSUED" && row.operationalStatus === "ISSUED" ? "Bulk return requires the same issued user and location." : "Select this gauge"; const canRetire = row.operationalStatus === "AVAILABLE"; const displayOperationalStatus = row.effectiveOperationalStatus || row.operationalStatus; return <tr key={row.gaugeMasterId} className={selected ? "gauge-selected-row" : ""}><td className="gauge-select-column"><input type="checkbox" checked={selected} disabled={disabled} title={selectionReason} aria-label={`Select ${row.gaugeId}`} onChange={() => toggleRow(row)}/></td><td><div className="master-record-cell"><button type="button" className="master-record-edit" title="Edit Gauge Master" aria-label={`Edit ${row.gaugeId}`} onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=edit`)}><Pencil size={15}/></button><button type="button" className="master-record-link" title="View Gauge Master" onClick={() => navigate(`/masters/gauges/${row.gaugeMasterId}?mode=view`)}>{row.gaugeId}</button></div></td><td><strong>{row.instrumentName}</strong><small>{row.itemCode}</small></td><td>{row.grnNumber}</td><td><span className={conditionClass(row.calibrationCondition)}>{label(row.calibrationCondition)}</span>{row.calibrationCondition === "DUE_TODAY" && <small>Usable today</small>}</td><td>{row.calibrationDueDate || "—"}{row.daysLeft !== null && row.daysLeft !== undefined && <small>{row.daysLeft} day{Math.abs(row.daysLeft) === 1 ? "" : "s"}</small>}</td><td><div className="gauge-status-cell"><span className={`gauge-badge operational ${displayOperationalStatus === "CALIBRATION_EXPIRED" ? "calibration-expired" : ""}`}>{label(displayOperationalStatus)}</span></div></td><td>{row.currentLocation}<small>{row.assignedTo ? `Issued to ${row.assignedTo}` : row.storageLocation ? `Home: ${row.storageLocation}` : ""}</small></td><td><div className="master-row-actions"><button type="button" title={canRetire ? "Delete gauge" : "Only an available gauge can be retired"} aria-label={`Delete ${row.gaugeId}`} disabled={!canRetire} onClick={() => void retire(row)}><Trash2 size={16}/></button></div></td></tr>; })}</tbody>
      </table></div>
      
    </section>
  </div>;
}
