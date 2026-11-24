import { ArrowLeft, Send, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { apiMessage } from "../../../../api/client";
import { toolingApi } from "../../../../api/tooling.api";
import DateInput from "../../../../components/DateInput";
import { todayInAppTimeZone } from "../../../../utils/formatDateTime";
import type { GateEntryRecord } from "../gateEntryData";

type BatchRow = {
  toolingRegrindBatchId: number;
  dcNumber: string;
  supplierName: string;
  dispatchDate: string;
  expectedReturnDate?: string | null;
  status: string;
  itemCount?: number | string;
  dispatchedQuantity?: number | string;
};

type BatchItem = {
  toolingRegrindBatchItemId: number;
  itemCode: string;
  itemDescription: string;
  uomCode?: string | null;
  dispatchedQuantity: number | string;
};

type BatchDetail = BatchRow & { items: BatchItem[] };

type Props = {
  gate: GateEntryRecord;
  onBack: () => void;
  onComplete: (returnGrnNumber: string) => void;
};

const quantity = (value: number | string | undefined | null) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const label = (batch: BatchRow) => `${batch.dcNumber} · ${batch.supplierName} · dispatched ${batch.dispatchDate}`;

export default function ToolReturnGrnForm({ gate, onBack, onComplete }: Props) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState("");
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [returnDate, setReturnDate] = useState(todayInAppTimeZone());
  const [receiptReference, setReceiptReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    toolingApi.regrindBatches().then((response) => {
      if (!active) return;
      const rows = Array.isArray(response?.data) ? response.data as BatchRow[] : [];
      setBatches(rows.filter((row) => row.status === "DISPATCHED"));
    }).catch((reason) => active && setError(apiMessage(reason))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selectBatch = async (value: string) => {
    setBatchId(value); setBatch(null); setReceivedQuantities({}); setError("");
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) return;
    try {
      setLoading(true);
      const response = await toolingApi.regrindBatch(id);
      const detail = response?.data as BatchDetail;
      if (!detail || detail.status !== "DISPATCHED") {
        setError("This Tool Regrinding DC is no longer available for receipt.");
        return;
      }
      setBatch(detail);
      setReceivedQuantities(Object.fromEntries((detail.items || []).map((item) => [item.toolingRegrindBatchItemId, String(item.dispatchedQuantity)])));
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!batch) { setError("Select the original Tool Regrinding DC."); return; }
    const items = batch.items.map((item) => ({
      batchItemId: item.toolingRegrindBatchItemId,
      receivedQuantity: Number(receivedQuantities[item.toolingRegrindBatchItemId]),
    }));
    if (!returnDate || items.some((item) => !Number.isFinite(item.receivedQuantity) || item.receivedQuantity <= 0)) {
      setError("Enter a positive received quantity for every returned tool item.");
      return;
    }
    if (items.some((item, index) => item.receivedQuantity > Number(batch.items[index].dispatchedQuantity) + 0.0001)) {
      setError("Received quantity cannot exceed the dispatched quantity.");
      return;
    }
    try {
      setSaving(true); setError("");
      const response = await toolingApi.receiveRegrind(batch.toolingRegrindBatchId, {
        gateEntryId: Number(gate.id), receiptDate: returnDate, receiptReference: receiptReference.trim(), remarks: remarks.trim(), items,
      });
      onComplete(String(response?.data?.returnGrnNumber || ""));
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  return <section className="purchase-grn-form-section calibration-return-grn-form">
    <header><div className="purchase-grn-form-title"><span><Wrench size={18} /></span><div><h2>Tool Return GRN</h2><p>Select the original Tool Regrinding DC and record the quantity returned by the supplier.</p></div></div></header>
    <div className="purchase-grn-reference-grid"><div><small>Return GRN Number</small><strong>Generated on submit</strong></div><div><small>Gate Entry</small><strong>{gate.gateEntryNumber}</strong></div><div><small>Service Type</small><strong>Tool Return</strong></div><div><small>Service Document</small><strong>{gate.referenceNumber || "—"}</strong></div></div>
    <div className="purchase-grn-field-grid purchase-grn-inward-field-grid">
      <label className="purchase-field purchase-grn-receipt-type"><span>Receipt Type</span><input value="Tool Return" readOnly /><small>Received tools remain pending until Tooling inspection accepts them into Tool Crib stock.</small></label>
      <label className="purchase-field"><span>Original Tool Regrinding DC <b>*</b></span><select value={batchId} disabled={loading || saving} onChange={(event) => { void selectBatch(event.target.value); }}><option value="">Select Tool Regrinding DC</option>{batches.map((row) => <option key={row.toolingRegrindBatchId} value={row.toolingRegrindBatchId}>{label(row)}</option>)}</select></label>
      <label className="purchase-field"><span>Return Date <b>*</b></span><DateInput type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label>
      <label className="purchase-field"><span>Supplier Return Reference</span><input value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} placeholder="Delivery challan or supplier reference" /></label>
    </div>
    {batch && <div className="purchase-grn-ownership"><span>Regrinding supplier: <strong>{batch.supplierName}</strong></span><span>Dispatched {batch.dispatchDate} · Expected return {batch.expectedReturnDate || "—"}</span></div>}
    <div className="purchase-grn-table-wrap purchase-grn-inward-lines"><div className="purchase-grn-lines-head"><strong>Returned Tool Items</strong><small>{batch ? `${batch.items.length} item(s) from ${batch.dcNumber}` : "Select a Tool Regrinding DC to prefill the dispatched quantities"}</small></div><table className="purchase-grn-items-table"><thead><tr><th>Tool Item</th><th>Dispatched Quantity</th><th>Received Quantity</th></tr></thead><tbody>{batch?.items?.length ? batch.items.map((item) => <tr key={item.toolingRegrindBatchItemId}><td><strong>{item.itemCode}</strong><small>{item.itemDescription}</small></td><td>{quantity(item.dispatchedQuantity)} {item.uomCode || ""}</td><td><input type="number" min="0.001" max={String(item.dispatchedQuantity)} step="0.001" value={receivedQuantities[item.toolingRegrindBatchItemId] || ""} onChange={(event) => setReceivedQuantities((current) => ({ ...current, [item.toolingRegrindBatchItemId]: event.target.value }))} /></td></tr>) : <tr><td colSpan={3}>{loading ? "Loading Tool Regrinding DCs…" : "No dispatched tool items are selected."}</td></tr>}</tbody></table></div>
    <div className="purchase-grn-remarks"><label className="purchase-field"><span>GRN Remarks</span><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional Tool Return GRN remarks" /></label></div>
    {error && <p className="purchase-grn-error" role="alert">{error}</p>}
    <footer className="purchase-grn-form-footer"><button type="button" className="purchase-secondary-button" onClick={onBack}><ArrowLeft size={15} /> Back</button><button type="button" className="purchase-primary-button" disabled={saving || !batch} onClick={() => { void submit(); }}><Send size={15} /> {saving ? "Creating Tool Return GRN…" : "Create Tool Return GRN"}</button></footer>
  </section>;
}
