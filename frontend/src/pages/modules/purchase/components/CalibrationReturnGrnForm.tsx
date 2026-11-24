import { ArrowLeft, ClipboardCheck, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiMessage } from "../../../../api/client";
import { gaugeApi } from "../../../../api/gauge.api";
import DateInput from "../../../../components/DateInput";
import { todayInAppTimeZone } from "../../../../utils/formatDateTime";
import type { GateEntryRecord } from "../gateEntryData";

type Dispatch = {
  calibrationDispatchId: number;
  dispatchNumber?: string;
  challanNumber?: string;
  calibrationAgency?: string;
  dispatchDate?: string;
  expectedReturnDate?: string;
  dispatchStatus?: string;
  gaugeCount?: number;
};

type DispatchItem = {
  gaugeMasterId: number;
  gaugeId: string;
  instrumentName?: string | null;
  manufacturerSerialNumber?: string | null;
  operationalStatus?: string | null;
  calibrationReturnId?: number | null;
};

type DispatchDetail = Dispatch & { items: DispatchItem[] };
type ReturnItem = {
  gaugeMasterId: number;
  gaugeId: string;
  instrumentName?: string | null;
  manufacturerSerialNumber?: string | null;
  received: boolean;
  calibrationResult: "PASS" | "FAIL";
  calibrationDate: string;
  certificateNumber: string;
  certificateFile: File | null;
  remarks: string;
};

type Props = {
  gate: GateEntryRecord;
  onBack: () => void;
  onComplete: (returnGrnNumber: string) => void;
};

const label = (dispatch: Dispatch) => `${dispatch.challanNumber || dispatch.dispatchNumber || "Dispatch challan"} · ${dispatch.calibrationAgency || "Calibration agency"} · ${dispatch.gaugeCount || 0} Gauge ID(s)`;

export default function CalibrationReturnGrnForm({ gate, onBack, onComplete }: Props) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [dispatchId, setDispatchId] = useState("");
  const [dispatch, setDispatch] = useState<DispatchDetail | null>(null);
  const [returnDate, setReturnDate] = useState(todayInAppTimeZone());
  const [returnLocation, setReturnLocation] = useState("Main Stores / Calibration Hold / Dispatch Rack");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const outstandingCount = useMemo(() => items.filter((item) => item.received).length, [items]);

  useEffect(() => {
    let active = true;
    gaugeApi.listCalibrationDispatches({ pageSize: 100 }).then((response) => {
      if (!active) return;
      const rows = Array.isArray(response?.data) ? response.data : [];
      setDispatches(rows.filter((row: Dispatch) => ["DISPATCHED", "PARTIALLY_RETURNED"].includes(String(row.dispatchStatus || "DISPATCHED"))));
    }).catch((reason) => active && setError(apiMessage(reason))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selectDispatch = async (value: string) => {
    setDispatchId(value); setDispatch(null); setItems([]); setError("");
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) return;
    try {
      setLoading(true);
      const response = await gaugeApi.getCalibrationDispatch(id);
      const detail = response?.data as DispatchDetail;
      const outstanding = (detail?.items || []).filter((item) => item.operationalStatus === "UNDER_CALIBRATION" && !item.calibrationReturnId);
      setDispatch(detail);
      setItems(outstanding.map((item) => ({
        gaugeMasterId: Number(item.gaugeMasterId), gaugeId: item.gaugeId, instrumentName: item.instrumentName,
        manufacturerSerialNumber: item.manufacturerSerialNumber, received: true, calibrationResult: "PASS",
        calibrationDate: returnDate, certificateNumber: "", certificateFile: null, remarks: "",
      })));
      if (!outstanding.length) setError("All Gauge IDs on this dispatch challan have already been received.");
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  };

  const updateItem = (gaugeMasterId: number, patch: Partial<ReturnItem>) => setItems((current) => current.map((item) => item.gaugeMasterId === gaugeMasterId ? { ...item, ...patch } : item));

  const submit = async () => {
    const receivedItems = items.filter((item) => item.received);
    if (!dispatch || !receivedItems.length) { setError("Select a dispatch challan and at least one returned Gauge ID."); return; }
    if (!returnLocation.trim()) { setError("Return or holding location is required."); return; }
    if (receivedItems.some((item) => !item.calibrationDate || !item.certificateNumber.trim() || !item.certificateFile)) { setError("Enter the calibration date and certificate number, then upload one certificate PDF for every received Gauge ID."); return; }
    try {
      setSaving(true); setError("");
      const payload = {
        gateEntryId: Number(gate.id), returnDate, returnLocation: returnLocation.trim(), remarks: remarks.trim(),
        items: receivedItems.map((item) => ({ gaugeMasterId: item.gaugeMasterId, calibrationResult: item.calibrationResult, calibrationDate: item.calibrationDate, certificateNumber: item.certificateNumber.trim(), remarks: item.remarks.trim() })),
      };
      const form = new FormData();
      form.append("payload", JSON.stringify(payload));
      receivedItems.forEach((item) => { if (item.certificateFile) form.append(`certificate_${item.gaugeMasterId}`, item.certificateFile); });
      const response = await gaugeApi.createCalibrationReturnGrn(dispatch.calibrationDispatchId, form);
      onComplete(String(response?.data?.returnGrnNumber || ""));
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  return <section className="purchase-grn-form-section calibration-return-grn-form">
    <header><div className="purchase-grn-form-title"><span><ClipboardCheck size={18} /></span><div><h2>Calibration Return GRN</h2><p>Select the original dispatch challan. Its outstanding Gauge IDs are prefilled for receipt.</p></div></div></header>
    <div className="purchase-grn-reference-grid"><div><small>Return GRN Number</small><strong>Generated on submit</strong></div><div><small>Gate Entry</small><strong>{gate.gateEntryNumber}</strong></div><div><small>Service Type</small><strong>Calibration Return</strong></div><div><small>Service Document</small><strong>{gate.referenceNumber || "—"}</strong></div></div>
    <div className="purchase-grn-field-grid purchase-grn-inward-field-grid">
      <label className="purchase-field purchase-grn-receipt-type"><span>Receipt Type</span><input value="Calibration Return" readOnly /><small>Linked Gauge-ID return; no material inventory is created.</small></label>
      <label className="purchase-field"><span>Original Dispatch Challan <b>*</b></span><select value={dispatchId} disabled={loading || saving} onChange={(event) => { void selectDispatch(event.target.value); }}><option value="">Select calibration dispatch challan</option>{dispatches.map((row) => <option key={row.calibrationDispatchId} value={row.calibrationDispatchId}>{label(row)}</option>)}</select></label>
      <label className="purchase-field"><span>Return Date <b>*</b></span><DateInput type="date" value={returnDate} onChange={(event) => { const value = event.target.value; setReturnDate(value); setItems((current) => current.map((item) => item.calibrationDate || item.calibrationDate === "" ? { ...item, calibrationDate: value } : item)); }} /></label>
      <label className="purchase-field"><span>Return / Holding Location <b>*</b></span><input value={returnLocation} onChange={(event) => setReturnLocation(event.target.value)} /></label>
    </div>
    {dispatch && <div className="purchase-grn-ownership"><span>Calibration Agency: <strong>{dispatch.calibrationAgency || "—"}</strong></span><span>Dispatched {dispatch.dispatchDate || "—"} · Expected return {dispatch.expectedReturnDate || "—"}</span></div>}
    <div className="purchase-grn-table-wrap purchase-grn-inward-lines"><div className="purchase-grn-lines-head"><strong>Returned Gauge IDs</strong><small>{dispatch ? `${items.length} outstanding from ${dispatch.challanNumber || dispatch.dispatchNumber}` : "Select a dispatch challan to prefill Gauge IDs"}</small></div><table className="purchase-grn-items-table calibration-return-grn-items"><thead><tr><th>Receive</th><th>Gauge ID</th><th>Calibration Result</th><th>Calibration Date</th><th>Certificate Number</th><th>Certificate PDF</th><th>Remarks</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={item.gaugeMasterId}><td><input type="checkbox" checked={item.received} onChange={(event) => updateItem(item.gaugeMasterId, { received: event.target.checked })} /></td><td><strong>{item.gaugeId}</strong><small>{item.instrumentName || "Gauge"}{item.manufacturerSerialNumber ? ` · ${item.manufacturerSerialNumber}` : ""}</small></td><td><select value={item.calibrationResult} disabled={!item.received} onChange={(event) => updateItem(item.gaugeMasterId, { calibrationResult: event.target.value as "PASS" | "FAIL" })}><option value="PASS">Pass — return to Available</option><option value="FAIL">Fail — move to Rejected / Service</option></select></td><td><DateInput type="date" value={item.calibrationDate} readOnly={!item.received} onChange={(event) => updateItem(item.gaugeMasterId, { calibrationDate: event.target.value })} /></td><td><input value={item.certificateNumber} readOnly={!item.received} onChange={(event) => updateItem(item.gaugeMasterId, { certificateNumber: event.target.value })} placeholder="Certificate number" /></td><td><label className="calibration-return-certificate-upload"><input type="file" accept="application/pdf,.pdf" disabled={!item.received} onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.type && file.type !== "application/pdf") { setError("Only PDF calibration certificates can be uploaded."); event.target.value = ""; return; } updateItem(item.gaugeMasterId, { certificateFile: file }); setError(""); }} /><span>{item.certificateFile?.name || "Upload PDF"}</span></label></td><td><input value={item.remarks} readOnly={!item.received} onChange={(event) => updateItem(item.gaugeMasterId, { remarks: event.target.value })} placeholder="Optional" /></td></tr>) : <tr><td colSpan={7}>{loading ? "Loading dispatch challans…" : "No outstanding Gauge IDs are available for the selected dispatch."}</td></tr>}</tbody></table></div>
    <div className="purchase-grn-remarks"><label className="purchase-field"><span>GRN Remarks</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional calibration return remarks" /></label></div>
    {error && <p className="purchase-grn-error" role="alert">{error}</p>}
    <footer className="purchase-grn-form-footer"><button type="button" className="purchase-secondary-button" onClick={onBack}><ArrowLeft size={15} /> Back</button><button type="button" className="purchase-primary-button" disabled={saving || !dispatch || !outstandingCount} onClick={() => { void submit(); }}><Send size={15} /> {saving ? "Creating Return GRN…" : `Create Return GRN${outstandingCount ? ` (${outstandingCount})` : ""}`}</button></footer>
  </section>;
}
