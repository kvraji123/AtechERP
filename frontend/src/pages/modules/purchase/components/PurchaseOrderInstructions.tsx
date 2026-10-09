import { ExternalLink, Paperclip, Printer, Save, Send } from "lucide-react";
import type { PurchaseOrderFormState } from "../purchaseOrderTypes";

type PurchaseOrderInstructionsProps = {
  value: PurchaseOrderFormState;
  attachmentName: string;
  attachmentUrl?: string;
  attachmentDisabled?: boolean;
  error: string;
  onChange: (patch: Partial<PurchaseOrderFormState>) => void;
  onAttachment: (file: File | null) => void;
  onPreview: () => void;
  onSave: () => void;
  onSubmit: () => void;
};

export default function PurchaseOrderInstructions({ value, attachmentName, attachmentUrl, attachmentDisabled = false, error, onChange, onAttachment, onPreview, onSave, onSubmit }: PurchaseOrderInstructionsProps) {
  return (
    <section className="purchase-po-section">
      <header><div><h2>Instructions & Attachment</h2><p>Supporting documents and supplier-facing instructions.</p></div></header>
      <div className="purchase-po-fields">
        <label className="purchase-field span-4"><span>Attachment</span><span className="purchase-po-file"><Paperclip size={15} />{attachmentName || "Attach specification, drawing or supporting document"}<input type="file" disabled={attachmentDisabled} onChange={(event) => onAttachment(event.target.files?.[0] || null)} /></span>{attachmentDisabled && <small>Create the purchase order draft before adding an attachment.</small>}{attachmentUrl && <a className="purchase-po-attachment-link" href={attachmentUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Open attachment</a>}</label>
        <label className="purchase-field span-2"><span>PO Remarks</span><textarea value={value.remarks} onChange={(event) => onChange({ remarks: event.target.value })} /></label>
        <label className="purchase-field span-2"><span>Special Instructions</span><textarea value={value.specialInstructions} onChange={(event) => onChange({ specialInstructions: event.target.value })} /></label>
      </div>
      <footer>{error && <span className="purchase-po-error" role="alert">{error}</span>}<button type="button" className="purchase-secondary-button" onClick={onPreview}><Printer size={16} /> Print Preview</button><button type="button" className="purchase-secondary-button" onClick={onSave}><Save size={16} /> Save Draft</button><button type="button" className="purchase-primary-button" onClick={onSubmit}><Send size={16} /> Submit for Approval</button></footer>
    </section>
  );
}
