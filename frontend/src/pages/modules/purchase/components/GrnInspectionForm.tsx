import { ArrowLeft, ExternalLink, ScanSearch, Trash2 } from "lucide-react";
import type { GrnInspectionCharacteristic, GrnItem, GrnRecord, InspectionDisposition, InspectionResult } from "../grnData";

export type RejectionReasonOption = {
  rejectionReasonId:number;
  reasonCode:string;
  reasonName:string;
  applicableReceiptTypes:string;
  defaultDispositionId:number | null;
  requireRemarks:"Y"|"N";
  requireAttachment:"Y"|"N";
};

export type RejectionDispositionOption = {
  rejectionDispositionId:number;
  dispositionCode:string;
  dispositionName:string;
  partyAction:"SUPPLIER"|"CUSTOMER"|"INTERNAL";
  stockAction:string;
};

type Props = {
  value:GrnRecord;
  error:string;
  readOnly?:boolean;
  rejectionReasons:RejectionReasonOption[];
  rejectionDispositions:RejectionDispositionOption[];
  onItemChange:(itemId:number,patch:Partial<GrnItem>) => void;
  onCharacteristicChange:(itemId:number,characteristicId:number,patch:Partial<GrnInspectionCharacteristic>) => void;
  onUploadAttachment:(itemId:number,file:File) => void;
  onRemoveAttachment:(itemId:number,attachmentId:number) => void;
  uploadingAttachmentItemId?:number | null;
  onBack:() => void;
  onComplete:() => void;
};

const quantity = (value:string) => value === "" ? 0 : Math.trunc(Number(value));
const limits = (row:GrnInspectionCharacteristic) => row.lsl !== null || row.usl !== null ? `${row.lsl ?? "—"} to ${row.usl ?? "—"}` : row.toleranceMinus !== null || row.tolerancePlus !== null ? `${row.toleranceMinus ?? "—"} / +${row.tolerancePlus ?? "—"}` : "—";
const applies = (reason:RejectionReasonOption,receiptType:string) => !reason.applicableReceiptTypes || reason.applicableReceiptTypes === "ALL" || reason.applicableReceiptTypes.split(",").includes(receiptType);

export default function GrnInspectionForm({ value,error,readOnly,rejectionReasons,rejectionDispositions,onItemChange,onCharacteristicChange,onUploadAttachment,onRemoveAttachment,uploadingAttachmentItemId,onBack,onComplete }:Props) {
  const responsibleParty = value.receiptType === "CUSTOMER_SUPPLIED" ? "CUSTOMER" : "SUPPLIER";
  const usableReasons = rejectionReasons.filter((reason) => applies(reason,value.receiptType));
  const usableDispositions = rejectionDispositions.filter((disposition) => disposition.partyAction === "INTERNAL" || disposition.partyAction === responsibleParty);
  return <section className="purchase-grn-form-section">
    <header><div className="purchase-grn-form-title"><span><ScanSearch size={18}/></span><div><h2>Incoming Material Inspection</h2><p>Characteristics are loaded from the active Item Master incoming inspection plan.</p></div></div><div className="purchase-section-actions"><button type="button" className="purchase-secondary-button" onClick={onBack}><ArrowLeft size={15}/> Back</button>{!readOnly && <button type="button" className="purchase-primary-button" onClick={onComplete}><ScanSearch size={15}/> Complete Inspection</button>}</div></header>
    <div className="purchase-grn-reference-grid"><div><small>GRN Number</small><strong>{value.grnNumber}</strong></div><div><small>{value.receiptType === "CUSTOMER_SUPPLIED" ? "Customer" : "Supplier"}</small><strong>{value.receiptType === "CUSTOMER_SUPPLIED" ? value.customerName : value.supplierName}</strong></div><div><small>PO Number</small><strong>{value.poNumber || "Not applicable"}</strong></div><div><small>Lot Status</small><strong>{value.status === "INSPECTION_HOLD" ? "Quality Hold" : "Inspection in progress"}</strong></div></div>
    <div className="purchase-grn-inspection-lines">{value.items.map((item) => {
      const characteristics = item.inspectionCharacteristics || [];
      const failed = characteristics.some((row) => row.inspectionResult === "FAIL");
      const planState = failed ? "Sample failed" : characteristics.length ? "Plan loaded" : "No inspection plan";
      const planClass = failed ? "failed" : characteristics.length ? "planned" : "unplanned";
      const selectedReason = usableReasons.find((reason) => reason.rejectionReasonId === item.rejectionReasonId);
      const attachments = item.rejectionAttachments || [];
      return <article className="purchase-grn-inspection-line" key={item.id}>
        <header><div><strong>{item.itemName}</strong><small>{item.itemCode || "Item code unavailable"}{item.specification ? ` · ${item.specification}` : ""}</small></div><div className="purchase-grn-inspection-line-meta"><span className="purchase-grn-inspection-received"><small>Received Qty</small><strong>{item.currentReceivedQuantity} {item.uom}</strong></span><span className={`purchase-grn-inspection-line-status ${planClass}`}>{planState}</span></div></header>
        {characteristics.length > 0 ? <div className="purchase-grn-table-wrap"><table className="purchase-grn-characteristic-table"><thead><tr><th>Characteristic</th><th>Specification / Limits</th><th>Gauge</th><th>Sample / Frequency</th><th>Actual Value</th><th>Result *</th><th>Remarks</th></tr></thead><tbody>{characteristics.map((row) => <tr key={row.id}><td><strong>{row.characteristicName}</strong><small>{row.characteristicCode} {row.drawingGrid ? `· Grid ${row.drawingGrid}` : ""}</small></td><td><strong>{row.specifiedDimension ?? "—"}</strong><small>{row.toleranceGrade || limits(row)}</small></td><td>{row.instrument || "—"}</td><td><strong>{row.sampleSize || "—"}</strong><small>{row.inspectionFrequency || "—"}</small></td><td><input disabled={readOnly} value={row.actualValue} onChange={(event) => onCharacteristicChange(item.id,row.id,{actualValue:event.target.value})} placeholder="Measured value"/></td><td><select disabled={readOnly} value={row.inspectionResult} onChange={(event) => onCharacteristicChange(item.id,row.id,{inspectionResult:event.target.value as GrnInspectionCharacteristic["inspectionResult"]})}><option value="PENDING">Pending</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></td><td><input disabled={readOnly} value={row.remarks} onChange={(event) => onCharacteristicChange(item.id,row.id,{remarks:event.target.value})} placeholder="Observation"/></td></tr>)}</tbody></table></div> : <p className="purchase-grn-no-plan">No active incoming inspection plan is available for this item. Record the final quantity decision below.</p>}
        {failed && <div className="purchase-grn-failure-decision"><strong>Sample failure: the received lot cannot move to stock until Quality records a disposition.</strong><label>Quality disposition<select disabled={readOnly} value={item.inspectionDisposition || "HOLD"} onChange={(event) => { const inspectionDisposition = event.target.value as InspectionDisposition; const received = item.currentReceivedQuantity; onItemChange(item.id,inspectionDisposition === "REJECT_LOT" ? {inspectionDisposition,acceptedQuantity:0,rejectedQuantity:received,onHoldQuantity:0} : inspectionDisposition === "DEVIATION_ACCEPT" ? {inspectionDisposition,acceptedQuantity:received,rejectedQuantity:0,onHoldQuantity:0} : inspectionDisposition === "PARTIAL_ACCEPT" ? {inspectionDisposition,acceptedQuantity:0,rejectedQuantity:0,onHoldQuantity:0} : {inspectionDisposition,acceptedQuantity:0,rejectedQuantity:0,onHoldQuantity:received}); }}><option value="HOLD">Hold entire lot</option><option value="FULL_INSPECTION">100% inspection</option><option value="REJECT_LOT">Reject entire lot</option><option value="PARTIAL_ACCEPT">Partially accept lot</option><option value="DEVIATION_ACCEPT">Accept with authorised deviation</option></select></label></div>}
        <div className="purchase-grn-decision-grid"><label>Accepted quantity<input type="number" min="0" step="1" inputMode="numeric" disabled={readOnly || (failed && !["PARTIAL_ACCEPT","DEVIATION_ACCEPT"].includes(item.inspectionDisposition || "HOLD"))} value={item.acceptedQuantity || ""} onChange={(event) => onItemChange(item.id,{acceptedQuantity:quantity(event.target.value)})}/></label><label>Rejected quantity<input type="number" min="0" step="1" inputMode="numeric" disabled={readOnly || (failed && !["PARTIAL_ACCEPT","REJECT_LOT"].includes(item.inspectionDisposition || "HOLD"))} value={item.rejectedQuantity || ""} onChange={(event) => onItemChange(item.id,{rejectedQuantity:quantity(event.target.value)})}/></label><label>On-hold quantity<input type="number" min="0" step="1" inputMode="numeric" disabled value={item.onHoldQuantity || ""}/></label><label>Inspection result<select disabled={readOnly || characteristics.length > 0} value={item.inspectionResult} onChange={(event) => onItemChange(item.id,{inspectionResult:event.target.value as InspectionResult})}><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="PARTIAL">Partially accepted</option><option value="REJECTED">Rejected</option><option value="ON_HOLD">On hold</option></select></label></div>
        <div className="purchase-grn-remarks-grid">
          {item.rejectedQuantity > 0 && <><label>Rejection reason *<select disabled={readOnly} value={item.rejectionReasonId || ""} onChange={(event) => { const reason = usableReasons.find((entry) => entry.rejectionReasonId === Number(event.target.value)); onItemChange(item.id,{rejectionReasonId:reason?.rejectionReasonId,rejectionReason:reason?.reasonName || "",rejectionDispositionId:reason?.defaultDispositionId || undefined}); }}><option value="">Select rejection reason</option>{usableReasons.map((reason) => <option key={reason.rejectionReasonId} value={reason.rejectionReasonId}>{reason.reasonName}</option>)}</select>{!usableReasons.length && <small className="purchase-grn-master-hint">No active rejection reason applies to this receipt type.</small>}</label><label>Follow-up action *<select disabled={readOnly} value={item.rejectionDispositionId || ""} onChange={(event) => onItemChange(item.id,{rejectionDispositionId:Number(event.target.value) || undefined})}><option value="">Select action</option>{usableDispositions.map((disposition) => <option key={disposition.rejectionDispositionId} value={disposition.rejectionDispositionId}>{disposition.dispositionName}</option>)}</select></label>{selectedReason?.requireAttachment === "Y" && <label className="purchase-grn-rejection-evidence">Rejection evidence *<input type="file" disabled={readOnly || uploadingAttachmentItemId === item.id} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadAttachment(item.id,file); event.currentTarget.value = ""; }}/><small>{uploadingAttachmentItemId === item.id ? "Uploading evidence…" : "Upload a photo, inspection report or supplier document."}</small>{attachments.map((attachment) => <span key={attachment.rejectionAttachmentId} className="purchase-grn-rejection-evidence-file"><a href={attachment.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{attachment.fileName}</a>{!readOnly && <button type="button" onClick={() => onRemoveAttachment(item.id,attachment.rejectionAttachmentId)} aria-label={`Remove ${attachment.fileName}`}><Trash2 size={13}/></button>}</span>)}</label>}</>}
          <label>Quality remarks{failed || selectedReason?.requireRemarks === "Y" ? " *" : ""}<textarea disabled={readOnly} value={item.qualityRemarks} onChange={(event) => onItemChange(item.id,{qualityRemarks:event.target.value})} placeholder="Failure assessment, disposition or deviation authorisation"/></label>
        </div>
      </article>;
    })}</div>
    {error && <p className="purchase-grn-error" role="alert">{error}</p>}
  </section>;
}
