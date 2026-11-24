import { ClipboardList, LogOut, Plus, Search, Send, Truck, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import { materialOutwardApi, type GateExitCreateInput } from "../../../api/materialOutward.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { dateTimeLocalNowInAppTimeZone, formatDateTime } from "../../../utils/formatDateTime";
import MaterialMovementTabs from "../purchase/components/MaterialMovementTabs";
import "./GateExitPage.css";

type Row = Record<string, unknown>;

const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const quantity = (value: unknown) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const purpose = (value: unknown) => ({
  FINISHED_GOODS: "Finished Goods Delivery",
  OUTSOURCE_ISSUE: "Outsource Issue",
  CALIBRATION_DISPATCH: "Calibration Dispatch",
  TOOL_REGRIND: "Tool Regrinding",
}[String(value)] || text(value));

export default function GateExitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmAction, showSuccess } = useAppFeedback();
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(searchParams.get("materialOutwardDocumentId")));
  const [selectedDocumentId, setSelectedDocumentId] = useState(searchParams.get("materialOutwardDocumentId") || "");
  const [exitDateTime, setExitDateTime] = useState(dateTimeLocalNowInAppTimeZone());
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [drivingLicenceNumber, setDrivingLicenceNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [courierReceiptNumber, setCourierReceiptNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [candidateResponse, recordResponse] = await Promise.all([
        materialOutwardApi.gateExitCandidates({ search, pageSize: 100 }),
        materialOutwardApi.listGateExits({ search, pageSize: 100 }),
      ]);
      setCandidates(Array.isArray(candidateResponse?.data) ? candidateResponse.data : []);
      setRecords(Array.isArray(recordResponse?.data) ? recordResponse.data : []);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => candidates.find((candidate) => String(candidate.materialOutwardDocumentId) === selectedDocumentId) || null, [candidates, selectedDocumentId]);
  const isCourier = String(selected?.transportMode || "").toUpperCase() === "COURIER";

  const resetForm = () => {
    setFormOpen(false); setSelectedDocumentId(""); setExitDateTime(dateTimeLocalNowInAppTimeZone());
    setVehicleNumber(""); setDriverName(""); setDrivingLicenceNumber(""); setCourierName(""); setCourierReceiptNumber(""); setRemarks("");
    if (searchParams.get("materialOutwardDocumentId")) navigate("/gate-exit", { replace: true });
  };

  const chooseDocument = (documentId: string) => {
    setSelectedDocumentId(documentId); setVehicleNumber(""); setDriverName(""); setDrivingLicenceNumber(""); setCourierName(""); setCourierReceiptNumber("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) { setError("Select an approved GRN Outward document."); return; }
    if (!exitDateTime) { setError("Enter the gate exit date and time."); return; }
    if (isCourier ? (!courierName.trim() || !courierReceiptNumber.trim()) : (!vehicleNumber.trim() || !driverName.trim())) {
      setError(isCourier ? "Enter courier name and Courier Receipt number." : "Enter vehicle number and driver name.");
      return;
    }
    if (!await confirmAction({
      title: "Record Gate Exit and Dispatch?",
      message: `${text(selected.outwardNumber)} will be recorded in Gate Exit. Approved stock will be dispatched and cannot be reversed from this screen.`,
      confirmLabel: "Record gate exit",
    })) return;

    const body: GateExitCreateInput = {
      materialOutwardDocumentId: Number(selected.materialOutwardDocumentId), exitDateTime,
      vehicleNumber: vehicleNumber.trim(), driverName: driverName.trim(), drivingLicenceNumber: drivingLicenceNumber.trim(),
      courierName: courierName.trim(), courierReceiptNumber: courierReceiptNumber.trim(), remarks: remarks.trim(),
    };
    try {
      setSaving(true); setError("");
      const response = await materialOutwardApi.createGateExit(body);
      showSuccess(`Gate Exit ${text(response?.data?.gateExitNumber)} recorded for ${text(selected.outwardNumber)}.`);
      resetForm(); await load();
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return <main className="gate-exit-page">
    <header className="gate-exit-header">
      <div><p>Material Movement / Gate Exit</p><h1>Gate Exit</h1><span>Fetch an approved GRN Outward document, record its physical exit, then dispatch stock.</span></div>
      <button type="button" onClick={() => { setFormOpen(true); setError(""); }}><Plus size={16} /> Record Gate Exit</button>
    </header>
    <MaterialMovementTabs />

    <section className="gate-exit-flow" aria-label="Gate exit workflow">
      <div><ClipboardList size={20} /><strong>1. GRN Outward</strong><span>Create and approve the outward document.</span></div>
      <div><LogOut size={20} /><strong>2. Gate Exit</strong><span>Record vehicle or courier departure.</span></div>
      <div><Send size={20} /><strong>3. Stock dispatched</strong><span>Stock and outsource WIP update on exit.</span></div>
    </section>

    {error && <p className="gate-exit-error">{error}</p>}

    {formOpen && <form className="gate-exit-form" onSubmit={submit}>
      <header><div><h2>Record Gate Exit</h2><p>Select the GRN Outward document. Party, items and transport are fetched automatically.</p></div><button type="button" aria-label="Close Gate Exit form" onClick={resetForm}><X size={18} /></button></header>
      <div className="gate-exit-form-grid">
        <label className="gate-exit-wide">Approved GRN Outward<select value={selectedDocumentId} onChange={(event) => chooseDocument(event.target.value)} required><option value="">Select GRN Outward ready for exit</option>{candidates.map((candidate) => <option key={String(candidate.materialOutwardDocumentId)} value={String(candidate.materialOutwardDocumentId)}>{text(candidate.outwardNumber)} · {purpose(candidate.outwardType)} · {text(candidate.partyName)}{candidate.documentStatus === "DISPATCHED" ? " · already dispatched" : ""}</option>)}</select></label>
        <label>Exit date &amp; time<input type="datetime-local" value={exitDateTime} onChange={(event) => setExitDateTime(event.target.value)} required /></label>
        <label>Transport mode<input value={text(selected?.transportMode) === "—" ? "" : String(selected?.transportMode)} readOnly placeholder="Fetched from GRN Outward" /></label>
        {isCourier ? <><label>Courier name<input value={courierName} onChange={(event) => setCourierName(event.target.value)} required /></label><label>Courier Receipt no.<input value={courierReceiptNumber} onChange={(event) => setCourierReceiptNumber(event.target.value)} required /></label></> : <><label>Vehicle number<input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} required /></label><label>Driver name<input value={driverName} onChange={(event) => setDriverName(event.target.value)} required /></label><label>Driving licence no. <small>(optional)</small><input value={drivingLicenceNumber} onChange={(event) => setDrivingLicenceNumber(event.target.value.toUpperCase())} /></label></>}
        <label className="gate-exit-wide">Gate remarks <small>(optional)</small><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Security, delivery or handling notes" /></label>
      </div>
      {selected && <div className="gate-exit-selection"><strong>{text(selected.outwardNumber)}</strong><span>{purpose(selected.outwardType)} · {text(selected.partyCode)} {text(selected.partyName)}</span><small>{text(selected.itemSummary)} · {quantity(selected.totalQuantity)} across {quantity(selected.itemCount)} line(s)</small></div>}
      <footer><button type="button" onClick={resetForm}>Cancel</button><button type="submit" disabled={saving || !selected}><LogOut size={16} />{saving ? "Recording…" : "Record Gate Exit & Dispatch"}</button></footer>
    </form>}

    <section className="gate-exit-register">
      <header><div><h2>Gate Exit Register</h2><p>Each gate exit links to one GRN Outward document.</p></div><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Gate Exit, outward, party or vehicle" /></label></header>
      <div className="gate-exit-pending"><strong>Awaiting Gate Exit</strong><span>{loading ? "Loading…" : `${candidates.length} GRN Outward document(s) ready to exit`}</span></div>
      <div className="gate-exit-table-wrap"><table><thead><tr><th>Gate Exit</th><th>GRN Outward</th><th>Party / purpose</th><th>Vehicle / courier</th><th>Items</th><th>Exit time</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading Gate Exit register…</td></tr> : records.length ? records.map((record) => <tr key={String(record.materialGateExitId)}><td><strong>{text(record.gateExitNumber)}</strong><small>{text(record.createdBy)}</small></td><td><strong>{text(record.outwardNumber)}</strong><small>{text(record.outwardDate)}</small></td><td><strong>{purpose(record.outwardType)}</strong><small>{text(record.partyCode)} · {text(record.partyName)}</small></td><td><strong>{text(record.vehicleNumber || record.courierName)}</strong><small>{text(record.driverName || record.courierReceiptNumber)}</small></td><td>{text(record.itemSummary)}<small>{quantity(record.totalQuantity)} across {quantity(record.itemCount)} line(s)</small></td><td>{formatDateTime(record.exitDateTime)}</td></tr>) : <tr><td colSpan={6}>No Gate Exit records found.</td></tr>}</tbody></table></div>
    </section>
    {!loading && !candidates.length && !records.length && <div className="gate-exit-empty"><Truck size={22} />No GRN Outward documents are currently ready for Gate Exit.</div>}
  </main>;
}
