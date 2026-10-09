import DateInput from "../../components/DateInput";
import GaugeStorageLocation, { type StorageLocation } from "../../components/GaugeStorageLocation";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import { ArrowLeft, CheckCircle2, Gauge, Save, Send, Wrench } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { todayInAppTimeZone } from "../../utils/formatDateTime";
import { apiMessage } from "../../api/client";
import { gaugeApi } from "../../api/gauge.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerFormPage.css";
import "./GaugeMasterPage.css";

type GaugeDetail = Record<string, any> & { gaugeMasterId: number; gaugeId: string; operationalStatus: string; history: any[] };
type Action = "" | "issue" | "return" | "collect" | "start" | "calibrate" | "service";
const today = todayInAppTimeZone;
const label = (value?: string) => String(value || "-").toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase());
const calculateDueDate = (lastCalibrationDate: string, frequencyMonths: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastCalibrationDate) || !/^\d+$/.test(frequencyMonths) || Number(frequencyMonths) < 1) return "";
  const [year, month, day] = lastCalibrationDate.split("-").map(Number);
  const monthIndex = month - 1 + Number(frequencyMonths);
  const dueYear = year + Math.floor(monthIndex / 12); const dueMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
  return `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

function formFromGauge(gauge: GaugeDetail) {
  return {
    storageLocationId: String(gauge.storageLocationId || ""),
    manufacturerSerialNumber: gauge.manufacturerSerialNumber || "", makeName: gauge.makeName || "", modelNumber: gauge.modelNumber || "",
    measurementRange: gauge.measurementRange || "", leastCount: gauge.leastCount || "", accuracy: gauge.accuracy || "",
    calibrationFrequencyMonths: String(gauge.calibrationFrequencyMonths || 12), lastCalibrationDate: gauge.lastCalibrationDate || "",
    calibrationDueDate: gauge.calibrationDueDate || "", calibrationAgency: gauge.calibrationAgency || "",
    currentLocation: gauge.currentLocation || "", remarks: gauge.remarks || "",
  };
}

export default function GaugeDetailPage() {
  const navigate = useNavigate();
  const { gaugeMasterId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const isReadOnly = searchParams.get("mode") !== "edit";
  const { showSuccess } = useAppFeedback();
  const [gauge, setGauge] = useState<GaugeDetail | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [action, setAction] = useState<Action>("");
  const [eventForm, setEventForm] = useState<Record<string, string>>({ eventDate: today(), returnLocation: "", calibrationResult: "PASS" });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unsaved = useUnsavedChanges(form);

  const applyGauge = (next: GaugeDetail) => { setGauge(next); setForm(formFromGauge(next)); };
  const load = async () => {
    try { setLoading(true); setError(""); const [response,lookups] = await Promise.all([gaugeApi.getById(Number(gaugeMasterId)),gaugeApi.lookups()]); applyGauge(response.data); setLocations(lookups.data.storageLocations || []); }
    catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [gaugeMasterId]);

  const set = (name: string, value: string) => { setForm((current) => { const next = { ...current, [name]: value }; if (name === "lastCalibrationDate" || name === "calibrationFrequencyMonths") next.calibrationDueDate = calculateDueDate(next.lastCalibrationDate, next.calibrationFrequencyMonths); return next; }); setError(""); };
  const setEvent = (name: string, value: string) => { setEventForm((current) => ({ ...current, [name]: value })); setError(""); };
  const openAction = (next: Action) => {
    setAction(next);
    setCertificateFile(null);
    setEventForm({ eventDate: today(), issueDate: today(), returnDate: today(), collectionDate: today(), startDate: today(), serviceDate: today(), calibrationDate: today(), calibrationResult: "PASS", returnLocation: gauge?.storageLocation || gauge?.currentLocation || "", calibrationAgency: gauge?.calibrationAgency || "" });
  };
  useEffect(() => {
    const requestedAction = searchParams.get("action") as Action;
    if (!gauge || isReadOnly || action || !["issue", "return", "collect", "start", "calibrate", "service"].includes(requestedAction)) return;
    if ((requestedAction === "issue" || requestedAction === "collect") && gauge.operationalStatus === "AVAILABLE") openAction(requestedAction);
    if (requestedAction === "return" && gauge.operationalStatus === "ISSUED") openAction("return");
    if (requestedAction === "start" && gauge.operationalStatus === "COLLECTED_FOR_CALIBRATION") openAction("start");
    if (requestedAction === "calibrate" && ["UNDER_CALIBRATION", "UNDER_SERVICE"].includes(gauge.operationalStatus)) openAction("calibrate");
    if (requestedAction === "service" && gauge.operationalStatus === "REJECTED") openAction("service");
  }, [action, gauge, isReadOnly, searchParams]);
  useEffect(() => {
    if (!action) return;
    window.requestAnimationFrame(() => document.getElementById("gauge-lifecycle")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [action]);
  const persistGaugeDetails = async () => {
    const savedSnapshot = unsaved.snapshot();
    const response = await gaugeApi.update(Number(gaugeMasterId), { ...form, calibrationFrequencyMonths: Number(form.calibrationFrequencyMonths) });
    unsaved.markSaved(savedSnapshot);
    return response.data;
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (isReadOnly) return;
    try { setSaving(true); setError(""); applyGauge(await persistGaugeDetails()); showSuccess("Gauge Master details updated."); }
    catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };
  const executeAction = async () => {
    if (!gauge || !action) return;
    let detailsSaved = false;
    try {
      setSaving(true); setError("");
      if (unsaved.snapshot() !== unsaved.baseline()) {
        await persistGaugeDetails();
        detailsSaved = true;
      }
      const calls: Record<Exclude<Action, "">, () => Promise<any>> = {
        issue: () => gaugeApi.issue(gauge.gaugeMasterId, { issuedTo: eventForm.issuedTo, issueLocation: eventForm.issueLocation, issueDate: eventForm.issueDate, remarks: eventForm.remarks }),
        return: () => gaugeApi.returnGauge(gauge.gaugeMasterId, { returnLocation: eventForm.returnLocation, returnDate: eventForm.returnDate, remarks: eventForm.remarks }),
        collect: () => gaugeApi.collectForCalibration(gauge.gaugeMasterId, { collectionLocation: eventForm.collectionLocation, collectionDate: eventForm.collectionDate, remarks: eventForm.remarks }),
        start: () => gaugeApi.startCalibration(gauge.gaugeMasterId, { calibrationLocation: eventForm.calibrationLocation, startDate: eventForm.startDate, calibrationAgency: eventForm.calibrationAgency, remarks: eventForm.remarks }),
        calibrate: () => {
          const body = new FormData();
          Object.entries({ calibrationResult: eventForm.calibrationResult, calibrationDate: eventForm.calibrationDate, returnLocation: eventForm.returnLocation, calibrationAgency: eventForm.calibrationAgency, certificateNumber: eventForm.certificateNumber, remarks: eventForm.remarks })
            .forEach(([key, value]) => { if (value) body.append(key, value); });
          if (certificateFile) body.append("certificate", certificateFile);
          return gaugeApi.recordCalibration(gauge.gaugeMasterId, body);
        },
        service: () => gaugeApi.startService(gauge.gaugeMasterId, { serviceLocation: eventForm.serviceLocation, serviceDate: eventForm.serviceDate, remarks: eventForm.remarks }),
      };
      const response = await calls[action]();
      applyGauge(response.data); setAction(""); setCertificateFile(null); showSuccess("Gauge lifecycle updated.");
    } catch (reason) { setError(detailsSaved ? `Gauge Details were saved, but the lifecycle event could not be recorded. ${apiMessage(reason)}` : apiMessage(reason)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="master-table-message">Loading Gauge Master...</div></div>;
  if (!gauge) return <div className="page-container"><Alert type="error" message={error || "Gauge Master record not found."}/></div>;
  const status = gauge.operationalStatus;
  const conditionClass = `gauge-badge ${String(gauge.calibrationCondition).toLowerCase().replace(/_/g, "-")}`;
  const activeCalibrationFrequency = form.calibrationFrequencyMonths || String(gauge.calibrationFrequencyMonths || "");
  const calculatedNextDueDate = eventForm.calibrationResult === "FAIL" ? "" : calculateDueDate(eventForm.calibrationDate || "", activeCalibrationFrequency);

  return <div className="page-container master-form-page customer-form-compact gauge-detail-page">
    <section className="master-form-page-header"><div className="master-form-title-group"><Gauge size={22}/><div><h1>{gauge.gaugeId}</h1><span>{gauge.instrumentName} · {gauge.itemCode} · {isReadOnly ? "View only" : "Edit"}</span></div></div>
      <div className="master-form-actions"><button type="button" className="customer-cancel-link" onClick={() => navigate("/masters/gauges")}><ArrowLeft size={15}/>Back</button>{!isReadOnly && <button type="submit" form="gauge-detail-form" className="primary-action-button" disabled={saving}><Save size={17}/>{saving ? "Saving..." : "Save Details"}</button>}</div>
    </section>
    {error && <Alert type="error" message={error}/>} 
    <section className="gauge-detail-overview"><div><small>Operational Status</small><strong className="gauge-badge operational">{label(status)}</strong></div><div><small>Calibration Condition</small><strong className={conditionClass}>{label(gauge.calibrationCondition)}</strong>{gauge.calibrationCondition === "DUE_TODAY" && <span>Usable today</span>}</div><div><small>Calibration Due Date</small><strong>{gauge.calibrationDueDate || "Not scheduled"}</strong><span>{gauge.daysLeft ?? ""}{gauge.daysLeft !== null && gauge.daysLeft !== undefined ? " days left" : ""}</span></div><div><small>Received Through</small><strong>{gauge.grnNumber}</strong><span>{gauge.grnDate}</span></div></section>
    <form id="gauge-detail-form" className="master-entry-form" onSubmit={save}>
      <section className="master-form-section"><div className="master-section-header"><div><h2>Gauge Details</h2><p>Gauge ID and GRN source are permanent. Update the physical and calibration details below.</p></div></div>
        <div className="master-form-grid"><label className="master-field"><span>Gauge ID</span><input value={gauge.gaugeId} readOnly/></label><label className="master-field"><span>Instrument</span><input value={gauge.instrumentName} readOnly/></label>
          <GaugeStorageLocation locations={locations} value={form.storageLocationId || ""} disabled={isReadOnly} onChange={(value) => set("storageLocationId", value)}/>
          <label className="master-field"><span>Manufacturer Serial Number</span><input value={form.manufacturerSerialNumber} readOnly={isReadOnly} onChange={(event) => set("manufacturerSerialNumber", event.target.value)}/></label><label className="master-field"><span>Make</span><input value={form.makeName} readOnly={isReadOnly} onChange={(event) => set("makeName", event.target.value)}/></label>
          <label className="master-field"><span>Model</span><input value={form.modelNumber} readOnly={isReadOnly} onChange={(event) => set("modelNumber", event.target.value)}/></label><label className="master-field"><span>Measurement Range</span><input value={form.measurementRange} readOnly={isReadOnly} onChange={(event) => set("measurementRange", event.target.value)}/></label>
          <label className="master-field"><span>Least Count</span><input value={form.leastCount} readOnly={isReadOnly} onChange={(event) => set("leastCount", event.target.value)}/></label><label className="master-field"><span>Accuracy</span><input value={form.accuracy} readOnly={isReadOnly} onChange={(event) => set("accuracy", event.target.value)}/></label>
          <label className="master-field"><span>Calibration Frequency (Months)</span><input type="number" min="1" max="120" value={form.calibrationFrequencyMonths} readOnly={isReadOnly} onChange={(event) => set("calibrationFrequencyMonths", event.target.value)}/></label><label className="master-field"><span>Last Calibration Date</span><DateInput type="date" value={form.lastCalibrationDate} readOnly={isReadOnly} onChange={(event) => set("lastCalibrationDate", event.target.value)}/></label>
          <label className="master-field"><span>Calibration Due Date</span><DateInput type="date" value={form.calibrationDueDate} readOnly/><small>Calculated from Last Calibration Date and Frequency.</small></label><label className="master-field"><span>Calibration Agency</span><input value={form.calibrationAgency} readOnly={isReadOnly} onChange={(event) => set("calibrationAgency", event.target.value)}/></label>
          <label className="master-field"><span>Current Location</span><input value={form.currentLocation} readOnly={isReadOnly} onChange={(event) => set("currentLocation", event.target.value)}/></label><label className="master-field span-2"><span>Remarks</span><textarea rows={3} value={form.remarks} readOnly={isReadOnly} onChange={(event) => set("remarks", event.target.value)}/></label>
        </div>
      </section>
    </form>
    {!isReadOnly && <section id="gauge-lifecycle" className="master-form-section gauge-lifecycle-section"><div className="master-section-header"><div><h2>Gauge Lifecycle</h2><p>Due Today gauges can be issued. Failed calibration sets the gauge to Rejected and blocks use.</p></div></div>
      <div className="gauge-action-buttons">{status === "AVAILABLE" && <><button type="button" onClick={() => openAction("issue")}><Send size={16}/>Issue for Use</button><button type="button" onClick={() => openAction("collect")}><Gauge size={16}/>Collect for Calibration</button></>}{status === "ISSUED" && <button type="button" onClick={() => openAction("return")}><CheckCircle2 size={16}/>Return Gauge</button>}{status === "COLLECTED_FOR_CALIBRATION" && <button type="button" onClick={() => openAction("start")}><Gauge size={16}/>Start Calibration</button>}{["UNDER_CALIBRATION", "UNDER_SERVICE"].includes(status) && <button type="button" onClick={() => openAction("calibrate")}><CheckCircle2 size={16}/>Record Calibration Result</button>}{status === "REJECTED" && <button type="button" onClick={() => openAction("service")}><Wrench size={16}/>Start Service</button>}</div>
      {action && <div className="gauge-action-form"><div className="gauge-action-heading"><strong>{label(action)} gauge</strong><button type="button" onClick={() => { setAction(""); setCertificateFile(null); navigate(`/masters/gauges/${gauge.gaugeMasterId}?mode=edit`, { replace: true }); }}>Cancel</button></div><div className="master-form-grid">
        {action === "issue" && <><label className="master-field"><span>Issued To <b>*</b></span><input value={eventForm.issuedTo || ""} onChange={(event) => setEvent("issuedTo", event.target.value)}/></label><label className="master-field"><span>Issue Location <b>*</b></span><input value={eventForm.issueLocation || ""} onChange={(event) => setEvent("issueLocation", event.target.value)}/></label><label className="master-field"><span>Issue Date</span><DateInput type="date" value={eventForm.issueDate || ""} onChange={(event) => setEvent("issueDate", event.target.value)}/></label></>}
        {action === "return" && <><label className="master-field"><span>Return Location <b>*</b></span><input value={eventForm.returnLocation || ""} onChange={(event) => setEvent("returnLocation", event.target.value)}/></label><label className="master-field"><span>Return Date</span><DateInput type="date" value={today()} readOnly/><small>Return date is recorded as today.</small></label></>}
        {action === "collect" && <><label className="master-field"><span>Collection Location</span><input value={eventForm.collectionLocation || ""} placeholder="Calibration collection area" onChange={(event) => setEvent("collectionLocation", event.target.value)}/></label><label className="master-field"><span>Collection Date</span><DateInput type="date" value={eventForm.collectionDate || ""} onChange={(event) => setEvent("collectionDate", event.target.value)}/></label></>}
        {action === "start" && <><label className="master-field"><span>Calibration Location</span><input value={eventForm.calibrationLocation || ""} placeholder="Calibration agency / lab" onChange={(event) => setEvent("calibrationLocation", event.target.value)}/></label><label className="master-field"><span>Calibration Agency</span><input value={eventForm.calibrationAgency || ""} onChange={(event) => setEvent("calibrationAgency", event.target.value)}/></label><label className="master-field"><span>Start Date</span><DateInput type="date" value={eventForm.startDate || ""} onChange={(event) => setEvent("startDate", event.target.value)}/></label></>}
        {action === "calibrate" && <><label className="master-field"><span>Calibration Result <b>*</b></span><select value={eventForm.calibrationResult || "PASS"} onChange={(event) => setEvent("calibrationResult", event.target.value)}><option value="PASS">Pass</option><option value="FAIL">Fail / Rejected</option></select></label><label className="master-field"><span>Calibration Date <b>*</b></span><DateInput type="date" value={eventForm.calibrationDate || ""} onChange={(event) => setEvent("calibrationDate", event.target.value)}/></label>{eventForm.calibrationResult !== "FAIL" && <label className="master-field"><span>Next Due Date</span><DateInput type="date" value={calculatedNextDueDate} readOnly/><small>Calculated from the calibration date and the saved {activeCalibrationFrequency}-month frequency.</small></label>}<label className="master-field"><span>Return / Hold Location <b>*</b></span><input value={eventForm.returnLocation || ""} onChange={(event) => setEvent("returnLocation", event.target.value)}/></label><label className="master-field"><span>Calibration Agency</span><input value={eventForm.calibrationAgency || ""} onChange={(event) => setEvent("calibrationAgency", event.target.value)}/></label><label className="master-field"><span>Certificate Number</span><input value={eventForm.certificateNumber || ""} onChange={(event) => setEvent("certificateNumber", event.target.value)}/></label><label className="master-field span-2"><span>Certificate PDF</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setCertificateFile(event.target.files?.[0] || null)}/><small>{certificateFile ? `${certificateFile.name} selected.` : "Optional PDF only, maximum 10 MB."}</small></label></>}
        {action === "service" && <><label className="master-field"><span>Service Location</span><input value={eventForm.serviceLocation || ""} placeholder="Service provider / hold location" onChange={(event) => setEvent("serviceLocation", event.target.value)}/></label><label className="master-field"><span>Service Date</span><DateInput type="date" value={eventForm.serviceDate || ""} onChange={(event) => setEvent("serviceDate", event.target.value)}/></label></>}
        <label className="master-field span-2"><span>Remarks</span><textarea rows={2} value={eventForm.remarks || ""} onChange={(event) => setEvent("remarks", event.target.value)}/></label>
      </div><div className="gauge-action-submit"><button type="button" className="primary-action-button" disabled={saving} onClick={() => void executeAction()}>{saving ? "Saving..." : "Save Lifecycle Event"}</button></div></div>}
    </section>}
    <section className="master-form-section"><div className="master-section-header"><div><h2>History Card</h2><p>Complete traceability for registration, movement, calibration, and service.</p></div></div><div className="master-table-wrapper"><table className="master-data-table gauge-history-table"><thead><tr><th>Date</th><th>Event</th><th>Status</th><th>Location / User</th><th>Calibration</th><th>Certificate</th><th>Remarks</th></tr></thead><tbody>{gauge.history?.length ? gauge.history.map((row: any) => <tr key={row.gaugeHistoryId}><td>{row.eventDate}</td><td><strong>{label(row.eventType)}</strong></td><td>{label(row.operationalStatus)}</td><td>{row.locationName || "—"}<small>{row.assignedTo || ""}</small></td><td>{row.calibrationResult ? label(row.calibrationResult) : "—"}<small>{row.calibrationDueDate || ""}</small></td><td>{row.certificateNumber || "—"}{row.certificateFileUrl && <a className="gauge-certificate-link" href={row.certificateFileUrl} target="_blank" rel="noreferrer">View PDF</a>}</td><td>{row.remarks || "—"}</td></tr>) : <tr><td colSpan={7}><div className="master-table-message">No history has been recorded.</div></td></tr>}</tbody></table></div></section>
  </div>;
}
