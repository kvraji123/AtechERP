import { X } from "lucide-react";
import { formatDate } from "../../../../utils/formatDateTime";

export type SupplierRfqItem = {
  enquiryItemId?: number;
  prNumber: string;
  itemCode: string;
  itemName: string;
  specification: string;
  quantity: number;
  uom: string;
};

export type SupplierRfqPreview = {
  supplierName: string;
  supplierCode: string;
  rfqNumber: string;
  itemCount: number;
  items: SupplierRfqItem[];
};

export type SupplierRfqDetails = {
  enquiryNumber: string;
  enquiryDate: string;
  dueDate: string;
  subject: string;
  deliveryRequiredDate: string;
  deliveryLocation: string;
  commercialTerms: string;
  supplierNotes: string;
};

type SupplierRfqPreviewDialogProps = {
  document: SupplierRfqPreview | null;
  details: SupplierRfqDetails;
  onClose: () => void;
};

const displayDate = formatDate;

export default function SupplierRfqPreviewDialog({ document, details, onClose }: SupplierRfqPreviewDialogProps) {
  if (!document) return null;

  return (
    <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="purchase-rfq-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-rfq-preview-title">
        <header>
          <div>
            <h2 id="purchase-rfq-preview-title">RFQ Preview</h2>
            <p>{document.supplierName} · {document.rfqNumber}</p>
          </div>
          <button type="button" className="purchase-dialog-close" aria-label="Close RFQ preview" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="purchase-rfq-document-preview">
          <div className="purchase-rfq-document-head">
            <div><strong>ATECH AUTOMATION</strong><span>Coimbatore, Tamil Nadu</span></div>
            <div><strong>REQUEST FOR QUOTATION</strong><span>{document.rfqNumber}</span></div>
          </div>
          <div className="purchase-rfq-document-subject"><span>Subject</span><strong>{details.subject || "—"}</strong></div>
          <div className="purchase-rfq-document-meta">
            <div><span>Supplier</span><strong>{document.supplierName}</strong><small>{document.supplierCode}</small></div>
            <div><span>RFQ / Purchase Enquiry No.</span><strong>{details.enquiryNumber}</strong></div>
            <div><span>Enquiry Date</span><strong>{displayDate(details.enquiryDate)}</strong></div>
            <div><span>Quotation Due</span><strong>{displayDate(details.dueDate)}</strong></div>
            <div><span>Delivery Required By</span><strong>{displayDate(details.deliveryRequiredDate)}</strong></div>
            <div><span>Delivery Location</span><strong>{details.deliveryLocation || "—"}</strong></div>
            <div><span>Items Included</span><strong>{document.itemCount}</strong></div>
          </div>
          <div className="purchase-rfq-instruction"><span>Commercial Terms Requested</span><p>{details.commercialTerms || "Please submit unit price, tax, freight, payment terms, delivery lead time and quotation validity."}</p></div>
          <div className="purchase-rfq-items-wrap">
            <table className="purchase-rfq-items-table">
              <thead><tr><th>S.No</th><th>Item</th><th>Specification</th><th>Quantity</th></tr></thead>
              <tbody>
                {document.items.map((item, index) => (
                  <tr key={`${item.prNumber}-${item.itemCode}`}>
                    <td>{index + 1}</td>
                    <td><strong>{item.itemName}</strong><small>{item.itemCode}</small></td>
                    <td>{item.specification}</td>
                    <td><strong>{item.quantity} {item.uom}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {details.supplierNotes && <div className="purchase-rfq-instruction notes"><span>Notes to Supplier</span><p>{details.supplierNotes}</p></div>}
        </div>
        <footer><button type="button" className="purchase-primary-button" onClick={onClose}><X size={15} /> Close</button></footer>
      </section>
    </div>
  );
}
