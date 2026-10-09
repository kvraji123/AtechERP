import { Printer, X } from "lucide-react";
import type { PurchaseOrderFormState, PurchaseOrderLine } from "../purchaseOrderTypes";

type PurchaseOrderPreviewDialogProps = {
  open: boolean;
  value: PurchaseOrderFormState;
  lines: PurchaseOrderLine[];
  onClose: () => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseOrderPreviewDialog({ open, value, lines, onClose }: PurchaseOrderPreviewDialogProps) {
  if (!open) return null;
  const subtotal = lines.reduce((total, line) => total + Math.max(0, line.quantity * line.rate - (line.discount || 0)), 0);
  const tax = lines.reduce((total, line) => { const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0)); return total + taxable * line.taxPercent / 100; }, 0);
  const freightAndOther = value.mode === "DIRECT_PR"
    ? Number(value.packingCharges || 0) + Number(value.freightCharges || 0) + Number(value.otherCharges || 0)
    : lines.reduce((total, line) => total + (line.freightAndOther || 0), 0);
  return (
    <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="purchase-po-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-po-preview-title">
        <header><div><h2 id="purchase-po-preview-title">Purchase Order Preview</h2><p>{value.poNumber} · {value.supplierName}</p></div><button type="button" className="purchase-dialog-close" aria-label="Close PO preview" onClick={onClose}><X size={18} /></button></header>
        <div className="purchase-po-document"><div className="purchase-po-document-head"><div><strong>ATECH AUTOMATION</strong><span>Coimbatore, Tamil Nadu</span></div><div><strong>PURCHASE ORDER</strong><span>{value.poNumber}</span></div></div><div className="purchase-po-document-meta"><div><span>Supplier</span><strong>{value.supplierName}</strong></div><div><span>PO Date</span><strong>{value.poDate}</strong></div><div><span>Delivery</span><strong>{value.expectedDelivery}</strong></div><div><span>Payment</span><strong>{value.paymentTerms}</strong></div></div><div className="purchase-po-table-wrap"><table className="purchase-po-preview-table"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Tax</th><th>Freight</th><th>Amount</th></tr></thead><tbody>{lines.map((line) => { const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0)); return <tr key={line.id}><td><strong>{line.itemName}</strong><small>{line.specification}</small></td><td>{line.quantity} {line.uom}</td><td>{money.format(line.rate)}</td><td>{money.format(line.discount || 0)}</td><td>{line.taxPercent}%</td><td>{money.format(line.freightAndOther || 0)}</td><td>{money.format(taxable)}</td></tr>; })}</tbody></table></div><div className="purchase-po-preview-total"><span>Total including GST and charges</span><strong>{money.format(subtotal + tax + freightAndOther)}</strong></div></div>
        <footer><button type="button" className="purchase-secondary-button" onClick={() => window.print()}><Printer size={16} /> Print</button><button type="button" className="purchase-secondary-button" onClick={onClose}>Close Preview</button></footer>
      </section>
    </div>
  );
}
