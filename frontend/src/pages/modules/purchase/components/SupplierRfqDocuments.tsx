import { CheckCircle2, Clock3, Eye, FileOutput, Files, RefreshCw, Scale, Send } from "lucide-react";
import { useState } from "react";
import SupplierRfqPreviewDialog, { type SupplierRfqDetails, type SupplierRfqPreview } from "./SupplierRfqPreviewDialog";

export type SupplierRfqDocument = SupplierRfqPreview & {
  supplierId: string;
  status: "NOT_GENERATED" | "GENERATED" | "SENT";
  quotationName?: string;
  quotationUrl?: string;
};

type SupplierRfqDocumentsProps = {
  documents: SupplierRfqDocument[];
  details: SupplierRfqDetails;
  onGenerate: () => void;
  onSend: () => void;
  onOpenComparison: () => void;
};

export default function SupplierRfqDocuments({ documents, details, onGenerate, onSend, onOpenComparison }: SupplierRfqDocumentsProps) {
  const [previewDocument, setPreviewDocument] = useState<SupplierRfqPreview | null>(null);
  const [validationError, setValidationError] = useState("");
  const generatedCount = documents.filter((document) => document.status !== "NOT_GENERATED").length;
  const allGenerated = documents.length > 0 && generatedCount === documents.length;
  const allSent = allGenerated && documents.every((document) => document.status === "SENT");

  return (
    <section className="purchase-rfq-section">
      <header>
        <div className="purchase-rfq-section-title"><FileOutput size={18} /><div><h2>Supplier RFQ Documents</h2><p>One RFQ is generated for each assigned supplier.</p></div></div>
        <span className={`purchase-rfq-count ${allGenerated ? "ready" : ""}`}>{generatedCount} of {documents.length} generated</span>
      </header>

      {documents.length ? (
        <div className="purchase-rfq-grid">
          {documents.map((document) => (
            <article className="purchase-rfq-card" key={document.supplierId}>
              <h3 title={document.supplierName}>{document.supplierName}</h3>
              <small>{document.supplierCode} · {document.itemCount} {document.itemCount === 1 ? "item" : "items"}</small>
              <dl>
                <dt>RFQ / Purchase Enquiry No.</dt><dd>{document.status === "NOT_GENERATED" ? "Pending" : document.rfqNumber}</dd>
                <dt>Status</dt><dd className={document.status === "NOT_GENERATED" ? "pending" : "ready"}>{document.status === "NOT_GENERATED" ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}{document.status === "NOT_GENERATED" ? "Not generated" : document.status === "GENERATED" ? "Generated" : "Sent"}</dd>
                <dt>Quotation</dt><dd>{document.quotationName || (document.status === "SENT" ? "Awaiting response" : "Not received")}</dd>
              </dl>
              <div className="purchase-rfq-links">
                <button type="button" disabled={document.status === "NOT_GENERATED"} onClick={() => setPreviewDocument(document)}><Eye size={13} /> View RFQ</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="purchase-rfq-empty">Assign suppliers to the selected enquiry items to generate RFQ documents.</p>}

      <footer>
        {validationError && <span className="purchase-rfq-validation-error" role="alert">{validationError}</span>}
        {allSent ? <button type="button" className="purchase-secondary-button" onClick={onOpenComparison}><Scale size={16} /> Quote Comparison</button> : <button type="button" className="purchase-secondary-button" disabled={!allGenerated} onClick={onSend}><Send size={16} /> Send Enquiries</button>}
        <button
          type="button"
          className="purchase-primary-button"
          disabled={!documents.length || allGenerated}
          onClick={() => {
            const missingFields = [
              !details.subject.trim() && "Subject",
              !details.dueDate && "Quotation Due Date",
              !details.deliveryRequiredDate && "Delivery Required By",
            ].filter(Boolean);
            if (missingFields.length) {
              setValidationError(`Complete ${missingFields.join(", ")} before generating RFQs.`);
              return;
            }
            setValidationError("");
            onGenerate();
          }}
        >{allGenerated ? <RefreshCw size={16} /> : <Files size={16} />} {allGenerated ? "RFQ Draft Saved" : "Generate RFQ Draft"}</button>
      </footer>

      <SupplierRfqPreviewDialog document={previewDocument} details={details} onClose={() => setPreviewDocument(null)} />
    </section>
  );
}
