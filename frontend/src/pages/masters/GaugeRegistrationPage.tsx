import DateInput from "../../components/DateInput";
import GaugeStorageLocation, { type StorageLocation } from "../../components/GaugeStorageLocation";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import { ArrowLeft, Gauge, Save } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { gaugeApi } from "../../api/gauge.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import "./CustomerFormPage.css";
import "./GaugeMasterPage.css";

type RegistrationSource = {
  grnItemId: number; grnNumber: string; grnDate: string; itemId: number; itemCode: string;
  itemDescription: string; itemTypePrefix?: string | null; makeName?: string | null; modelNumber?: string | null;
  measurementRange?: string | null; leastCount?: string | null; accuracy?: string | null;
  calibrationFrequencyMonths?: number | null; calibrationAgency?: string | null;
  warehouseCode?: string | null; binLocation?: string | null;
  acceptedQuantity: number; registeredQuantity: number; inventoryQuantity: number; registrationAvailable: number;
};

const calculateDueDate = (lastCalibrationDate: string, frequencyMonths: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastCalibrationDate) || !/^\d+$/.test(frequencyMonths) || Number(frequencyMonths) < 1) return "";
  const [year, month, day] = lastCalibrationDate.split("-").map(Number);
  const monthIndex = month - 1 + Number(frequencyMonths);
  const dueYear = year + Math.floor(monthIndex / 12);
  const dueMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate();
  return `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

const blank = {
  storageLocationId: "",
  sourceGrnItemId: "", quantity: "1", instrumentAbbreviation: "", makeName: "", modelNumber: "",
  measurementRange: "", leastCount: "", accuracy: "", calibrationFrequencyMonths: "12",
  lastCalibrationDate: "", calibrationDueDate: "", calibrationAgency: "", currentLocation: "", remarks: "",
};

export default function GaugeRegistrationPage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [sources, setSources] = useState<RegistrationSource[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [form, setForm] = useState(blank);
  const [serialNumbers, setSerialNumbers] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const unsaved = useUnsavedChanges({ form, serialNumbers });

  useEffect(() => {
    void gaugeApi.lookups().then((response) => { setSources(response?.data?.registrationSources ?? []); setLocations(response?.data?.storageLocations ?? []); })
      .catch((reason) => setError(apiMessage(reason))).finally(() => setLoading(false));
  }, []);

  const source = useMemo(() => sources.find((entry) => entry.grnItemId === Number(form.sourceGrnItemId)), [sources, form.sourceGrnItemId]);
  const set = (name: keyof typeof blank, value: string) => {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "lastCalibrationDate" || name === "calibrationFrequencyMonths") next.calibrationDueDate = calculateDueDate(next.lastCalibrationDate, next.calibrationFrequencyMonths);
      return next;
    });
    setError("");
  };
  const setQuantity = (value: string) => {
    const maximum = Number(source?.registrationAvailable || 1000);
    const next = Math.max(1, Math.min(Number.parseInt(value || "1", 10) || 1, maximum));
    set("quantity", String(next));
    setSerialNumbers((current) => Array.from({ length: next }, (_, index) => current[index] ?? ""));
  };
  const selectSource = (value: string) => {
    const selected = sources.find((entry) => entry.grnItemId === Number(value));
    setForm({
      ...blank,
      sourceGrnItemId: value, quantity: String(selected?.registrationAvailable || 1),
      storageLocationId: String(locations.find((entry) => entry.warehouseCode === selected?.warehouseCode && entry.binLocation === selected?.binLocation)?.locationId || ""),
      instrumentAbbreviation: String(selected?.itemTypePrefix || "GAUGE").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12) || "GAUGE",
      makeName: selected?.makeName || "",
      modelNumber: selected?.modelNumber || "",
      measurementRange: selected?.measurementRange || "",
      leastCount: selected?.leastCount || "",
      accuracy: selected?.accuracy || "",
      calibrationFrequencyMonths: String(selected?.calibrationFrequencyMonths || 12),
      calibrationAgency: selected?.calibrationAgency || "",
      currentLocation: [selected?.warehouseCode, selected?.binLocation].filter(Boolean).join(" / "),
    });
    setSerialNumbers(Array.from({ length: Number(selected?.registrationAvailable || 1) }, () => ""));
    setError("");
  };
  const updateSerial = (index: number, value: string) => setSerialNumbers((current) => current.map((entry, row) => row === index ? value : entry));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const savedSnapshot = unsaved.snapshot();
    if (!source) { setError("Select a posted Instruments & Gauges GRN item."); return; }
    if (Number(form.quantity) > Number(source.registrationAvailable)) { setError("Quantity cannot exceed the physical gauges currently available in inventory."); return; }
    try {
      setSaving(true); setError("");
      const response = await gaugeApi.register({
        ...form, sourceGrnItemId: Number(form.sourceGrnItemId), quantity: Number(form.quantity),
        calibrationFrequencyMonths: Number(form.calibrationFrequencyMonths), serialNumbers,
      });
      unsaved.markSaved(savedSnapshot);
      showSuccess(`${response?.data?.records?.length || form.quantity} Gauge Master record(s) created from ${source.grnNumber}.`);
      navigate("/masters/gauges");
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-container"><div className="master-table-message">Loading posted GRN instruments...</div></div>;
  return <div className="page-container master-form-page customer-form-compact gauge-registration-page">
    <section className="master-form-page-header"><div className="master-form-title-group"><Gauge size={22}/><h1>Register Gauges from GRN</h1></div>
      <div className="master-form-actions"><button type="button" className="customer-cancel-link" onClick={() => navigate("/masters/gauges")}><ArrowLeft size={15}/>Cancel</button><button type="submit" form="gauge-registration-form" className="primary-action-button" disabled={saving}><Save size={17}/>{saving ? "Registering..." : "Create Gauge IDs"}</button></div>
    </section>
    {error && <Alert type="error" message={error}/>} 
    <form id="gauge-registration-form" className="master-entry-form" onSubmit={save}>
      <section className="master-form-section"><div className="master-section-header"><div><h2>Posted GRN Source</h2><p>Select a posted Instruments &amp; Gauges receipt. One Gauge Master record is created for each physical instrument.</p></div></div>
        <div className="master-form-grid"><label className="master-field span-2"><span>Posted GRN Item <b>*</b></span><select value={form.sourceGrnItemId} onChange={(event) => selectSource(event.target.value)}><option value="">Select posted GRN item</option>{sources.map((entry) => <option key={entry.grnItemId} value={entry.grnItemId}>{entry.grnNumber} · {entry.itemCode} · {entry.itemDescription} ({entry.registrationAvailable} physical gauges in inventory)</option>)}</select></label>
          {source && <div className="gauge-source-summary span-2"><strong>{source.itemDescription}</strong><span>{source.itemCode} · Inventory stock: {source.inventoryQuantity} · Already registered: {source.registeredQuantity} · Available for registration: {source.registrationAvailable}</span></div>}
        </div>
      </section>
      <section className="master-form-section"><div className="master-section-header"><div><h2>Individual Gauge Registration</h2><p>Gauge IDs are generated as <strong>ATA–abbreviation–running serial number</strong>.</p></div></div>
        <div className="master-form-grid"><label className="master-field"><span>Number of Physical Gauges <b>*</b></span><input type="number" min="1" max={source?.registrationAvailable || 1} disabled={!source} value={form.quantity} onChange={(event) => setQuantity(event.target.value)}/><small>Prefilled from available inventory stock. You can register a smaller quantity.</small></label>
          <label className="master-field"><span>Instrument Abbreviation <b>*</b></span><input value={form.instrumentAbbreviation} maxLength={12} disabled={!source} onChange={(event) => set("instrumentAbbreviation", event.target.value.toUpperCase())} placeholder="e.g. HG"/><small>Used in each Gauge ID</small></label>
          <label className="master-field"><span>Make</span><input value={form.makeName} disabled={!source} onChange={(event) => set("makeName", event.target.value)}/></label>
          <label className="master-field"><span>Model</span><input value={form.modelNumber} disabled={!source} onChange={(event) => set("modelNumber", event.target.value)}/></label>
          <label className="master-field"><span>Measurement Range</span><input value={form.measurementRange} disabled={!source} onChange={(event) => set("measurementRange", event.target.value)}/></label>
          <label className="master-field"><span>Least Count</span><input value={form.leastCount} disabled={!source} onChange={(event) => set("leastCount", event.target.value)}/></label>
          <label className="master-field"><span>Accuracy</span><input value={form.accuracy} disabled={!source} onChange={(event) => set("accuracy", event.target.value)}/></label>
          <label className="master-field"><span>Calibration Frequency (Months) <b>*</b></span><input type="number" min="1" max="120" value={form.calibrationFrequencyMonths} disabled={!source} onChange={(event) => set("calibrationFrequencyMonths", event.target.value)}/></label>
          <label className="master-field"><span>Last Calibration Date</span><DateInput type="date" value={form.lastCalibrationDate} disabled={!source} onChange={(event) => set("lastCalibrationDate", event.target.value)}/></label>
          <label className="master-field"><span>Calibration Due Date</span><DateInput type="date" value={form.calibrationDueDate} disabled={!source} readOnly/><small>Calculated from Last Calibration Date and Frequency.</small></label>
          <label className="master-field"><span>Calibration Agency</span><input value={form.calibrationAgency} disabled={!source} onChange={(event) => set("calibrationAgency", event.target.value)}/></label>
          <GaugeStorageLocation locations={locations} value={form.storageLocationId} disabled={!source} onChange={(value) => set("storageLocationId", value)}/>
          <label className="master-field"><span>Initial Location <b>*</b></span><input value={form.currentLocation} disabled={!source} onChange={(event) => set("currentLocation", event.target.value)} placeholder="Main Stores / Gauge Room"/></label>
          <label className="master-field span-2"><span>Remarks</span><textarea rows={3} value={form.remarks} disabled={!source} onChange={(event) => set("remarks", event.target.value)}/></label>
        </div>
        {source && <div className="gauge-serial-section"><h3>Manufacturer Serial Numbers</h3><p>Optional. The generated Gauge ID remains the ERP serial number for every physical gauge.</p><div className="gauge-serial-grid">{serialNumbers.map((serial, index) => <label key={index}><span>{index + 1}. ATA-{form.instrumentAbbreviation || "…"}-<em>auto</em></span><input value={serial} maxLength={120} onChange={(event) => updateSerial(index, event.target.value)} placeholder="Manufacturer serial number (optional)"/></label>)}</div></div>}
      </section>
    </form>
  </div>;
}
