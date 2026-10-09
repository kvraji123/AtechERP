import DateInput from "../../../../components/DateInput";
import { CheckCircle2, Circle } from "lucide-react";
import type { PurchaseOrderFormState, PurchaseOrderMode } from "../purchaseOrderTypes";

type PurchaseOrderSourceDetailsProps = {
  value: PurchaseOrderFormState;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | "REJECTED";
  onChange: (patch: Partial<PurchaseOrderFormState>) => void;
};

const supplierNames = ["Prime Motion Systems · SUP-002", "Nova Industrial Supply · SUP-001", "MechPro Components · SUP-004", "Axis Automation · SUP-003"];

export default function PurchaseOrderSourceDetails({ value, status = "DRAFT", onChange }: PurchaseOrderSourceDetailsProps) {
  const changeMode = (mode: PurchaseOrderMode) => onChange({ mode, sourceReference: mode === "COMPARISON" ? "RFQ/PE/0024/26-27 · Approved supplier decisions" : "Multiple — PE/0024/26-27 & PE/0027/26-27" });
  const isDirectPr = value.mode === "DIRECT_PR";
  const sourceLocked = value.mode === "COMPARISON" || isDirectPr;
  return (
    <section className="purchase-po-section">
      <header><div><h2>PO Source & Supplier</h2><p>{isDirectPr ? "Supplier and approved items are populated from existing-item purchase requests." : "Supplier and accepted items are populated from the saved comparison decision."}</p></div><span className={`purchase-po-draft ${status !== "DRAFT" ? "submitted" : ""}`}>{status === "SUBMITTED" ? "Submitted" : status === "APPROVED" ? "Approved" : status === "RETURNED" ? "Returned" : status === "REJECTED" ? "Rejected" : "Draft"}</span></header>
      <div className="purchase-po-fields">
        <div className="purchase-po-mode">
          <button type="button" disabled={isDirectPr} className={value.mode === "COMPARISON" ? "active" : ""} onClick={() => changeMode("COMPARISON")}>{value.mode === "COMPARISON" ? <CheckCircle2 size={16} /> : <Circle size={16} />}<span><strong>From Supplier Selection</strong><small>Populate approved items and commercial values from quotation comparison.</small></span></button>
          <button type="button" disabled={isDirectPr} className={value.mode === "ENQUIRY" ? "active" : ""} onClick={() => changeMode("ENQUIRY")}>{value.mode === "ENQUIRY" ? <CheckCircle2 size={16} /> : <Circle size={16} />}<span><strong>From Purchase Enquiries</strong><small>Manually select one or more enquiries and their items.</small></span></button>
          {isDirectPr && <button type="button" className="active"><CheckCircle2 size={16} /><span><strong>From Existing-item PR</strong><small>RFQ is not required; use approved quantities and the preferred supplier.</small></span></button>}
        </div>
        <label className="purchase-field"><span>PO Number <em>Auto</em></span><input value={value.poNumber} readOnly /></label>
        <label className="purchase-field"><span>PO Date <b>*</b></span><DateInput type="date" value={value.poDate} onChange={(event) => onChange({ poDate: event.target.value })} /></label>
        <label className="purchase-field span-2"><span>Supplier Name <b>*</b>{sourceLocked && <em>Locked from source</em>}</span><input list="purchase-po-suppliers" value={value.supplierName} readOnly={sourceLocked} onChange={(event) => onChange({ supplierName: event.target.value })} placeholder="Search supplier name or code" /><datalist id="purchase-po-suppliers">{supplierNames.map((supplier) => <option key={supplier} value={supplier} />)}</datalist></label>
        <label className="purchase-field span-2"><span>{isDirectPr ? "Purchase Request Number(s)" : value.mode === "COMPARISON" ? "Quotation Comparison Reference" : "Purchase Enquiry Numbers"} <b>*</b></span>{sourceLocked ? <input value={value.sourceReference} readOnly /> : <select value={value.sourceReference} onChange={(event) => onChange({ sourceReference: event.target.value })}><option>Multiple — PE/0024/26-27 & PE/0027/26-27</option><option>PE/0024/26-27</option><option>PE/0027/26-27</option></select>}</label>
        <label className="purchase-field"><span>Expected Delivery <b>*</b></span><DateInput type="date" value={value.expectedDelivery} onChange={(event) => onChange({ expectedDelivery: event.target.value })} /></label>
        <label className="purchase-field"><span>Payment Terms</span>{value.mode === "COMPARISON" ? <input value={value.paymentTerms} readOnly /> : <select value={value.paymentTerms} onChange={(event) => onChange({ paymentTerms: event.target.value })}><option>45 days from GRN</option><option>30 days from invoice</option><option>Advance payment</option></select>}</label>
      </div>
    </section>
  );
}
