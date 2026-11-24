import { X } from "lucide-react";
import type { PurchaseOrderDetail } from "../../../../api/purchase.api";
import { amountInWords } from "../../../../utils/amountInWords";

type Props = {
  detail: PurchaseOrderDetail;
  onClose: () => void;
};

type RecordValue = Record<string, unknown>;

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const read = (record: RecordValue, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
};

const text = (record: RecordValue, ...keys: string[]) => {
  const value = read(record, ...keys);
  return value === null ? "—" : String(value);
};

const amount = (record: RecordValue, ...keys: string[]) => Number(read(record, ...keys) || 0);

const date = (value: unknown) => {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-GB");
};

const statusLabel = (value: string) => ({
  DRAFT: "Draft", RETURNED: "Returned", SUBMITTED: "Pending Approval", APPROVED: "Approved",
  PARTIALLY_RECEIVED: "Partial Receipt", COMPLETED: "Completed", REJECTED: "Rejected", CANCELLED: "Cancelled",
}[value] || value.replace(/_/g, " "));

export default function PurchaseOrderFullViewDialog({ detail, onClose }: Props) {
  const record = detail as RecordValue;
  const items = Array.isArray(detail.items) ? detail.items.filter((item): item is RecordValue => Boolean(item && typeof item === "object")) : [];
  const history = Array.isArray(detail.approvalHistory) ? detail.approvalHistory.filter((item): item is RecordValue => Boolean(item && typeof item === "object")) : [];
  const status = text(record, "status").toUpperCase();
  const supplierName = text(record, "supplier_name_snapshot", "supplierName");
  const supplierCode = text(record, "supplier_code_snapshot", "supplierCode");

  return <div className="purchase-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="purchase-order-full-view-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-order-full-view-title">
      <header>
        <div><h2 id="purchase-order-full-view-title">{text(record, "po_number", "poNumber")}</h2><p>{supplierName}{supplierCode !== "—" ? ` · ${supplierCode}` : ""}</p></div>
        <button type="button" aria-label="Close purchase order details" onClick={onClose}><X size={18} /></button>
      </header>

      <div className="purchase-order-full-view-body">
        <section className="purchase-order-full-view-section">
          <h3>Purchase Order Details</h3>
          <dl className="purchase-order-full-view-grid">
            <div><dt>PO Date</dt><dd>{date(read(record, "po_date", "poDate"))}</dd></div>
            <div><dt>Expected Delivery</dt><dd>{date(read(record, "expected_delivery_date", "expectedDeliveryDate"))}</dd></div>
            <div><dt>Status</dt><dd><span className={`purchase-order-list-status ${status.toLowerCase()}`}>{statusLabel(status)}</span></dd></div>
            <div><dt>Source Reference</dt><dd>{text(record, "source_reference", "sourceReference")}</dd></div>
            <div><dt>Payment Terms</dt><dd>{text(record, "payment_terms", "paymentTerms")}</dd></div>
            <div><dt>Delivery Terms</dt><dd>{text(record, "delivery_terms", "deliveryTerms")}</dd></div>
            <div><dt>Transport Mode</dt><dd>{text(record, "transport_mode", "transportMode")}</dd></div>
            <div><dt>Supplier GSTIN</dt><dd>{text(record, "supplier_gst_snapshot")}</dd></div>
          </dl>
        </section>

        <section className="purchase-order-full-view-section purchase-order-full-view-addresses">
          <h3>Addresses</h3>
          <div><small>Supplier Address</small><p>{text(record, "supplier_address_snapshot")}</p></div>
          <div><small>Billing Address</small><p>{text(record, "billing_address_snapshot", "billingAddress")}</p></div>
          <div><small>Delivery Address</small><p>{text(record, "delivery_address_snapshot", "deliveryAddress")}</p></div>
        </section>

        <section className="purchase-order-full-view-section">
          <h3>PO Items</h3>
          <div className="purchase-po-table-wrap"><table className="purchase-order-full-view-items"><thead><tr><th>#</th><th>Item</th><th>Specification</th><th>Other Specification</th><th>Qty / UOM</th><th>Rate</th><th>Discount</th><th>Tax</th><th>Charges</th><th>Line Total</th><th>Required Date</th><th>Line Status</th></tr></thead><tbody>{items.map((item, index) => {
            const charges = amount(item, "packing_amount") + amount(item, "freight_amount") + amount(item, "other_charges_amount");
            const lineTotal = amount(item, "line_total_amount");
            return <tr key={String(read(item, "purchase_order_item_id", "id") || index)}><td>{text(item, "line_number") === "—" ? index + 1 : text(item, "line_number")}</td><td><strong>{text(item, "item_description_snapshot", "itemDescription")}</strong><small>{text(item, "item_code_snapshot", "itemCode")}</small></td><td>{text(item, "item_specification_snapshot", "specification")}</td><td>{text(item, "other_specification", "otherSpecification")}</td><td>{text(item, "ordered_quantity", "quantity")} {text(item, "uom_code_snapshot", "uom")}</td><td>{money.format(amount(item, "unit_price", "rate"))}</td><td>{money.format(amount(item, "discount_amount", "discount"))}</td><td>{text(item, "tax_percent", "taxPercent")}%<small>{money.format(amount(item, "tax_amount"))}</small></td><td>{money.format(charges)}</td><td><strong>{money.format(lineTotal)}</strong><small className="purchase-amount-words">{amountInWords(lineTotal)}</small></td><td>{date(read(item, "required_date", "requiredDate"))}</td><td>{text(item, "line_status")}</td></tr>;
          })}</tbody></table>{!items.length && <p className="purchase-order-full-view-empty">No PO items are available.</p>}</div>
        </section>

        <section className="purchase-order-full-view-section purchase-order-full-view-bottom-grid">
          <div><h3>Charges Summary</h3><dl className="purchase-order-full-view-totals"><dt>Subtotal</dt><dd>{money.format(amount(record, "subtotal_amount", "subtotalAmount"))}</dd><dt>Discount</dt><dd>− {money.format(amount(record, "discount_amount", "discountAmount"))}</dd><dt>GST</dt><dd>{money.format(amount(record, "tax_amount", "taxAmount"))}</dd><dt>Packing Charges</dt><dd>{money.format(amount(record, "packing_amount", "packingAmount"))}</dd><dt>Freight Charges</dt><dd>{money.format(amount(record, "freight_amount", "freightAmount"))}</dd><dt>Other Charges</dt><dd>{money.format(amount(record, "other_charges_amount", "otherChargesAmount"))}</dd><dt className="total">PO Total</dt><dd className="total">{money.format(amount(record, "grand_total_amount", "grandTotalAmount"))}</dd></dl><p className="purchase-total-amount-words"><span>Amount in words</span><strong>{amountInWords(amount(record, "grand_total_amount", "grandTotalAmount"))}</strong></p></div>
          <div><h3>Instructions</h3><div className="purchase-order-full-view-notes"><div><small>Remarks</small><p>{text(record, "remarks")}</p></div><div><small>Special Instructions</small><p>{text(record, "special_instructions", "specialInstructions")}</p></div></div></div>
        </section>

        {history.length > 0 && <section className="purchase-order-full-view-section"><h3>Approval History</h3><ol className="purchase-order-full-view-history">{history.map((entry, index) => <li key={String(read(entry, "id") || index)}><strong>{text(entry, "decision")}</strong><span>{text(entry, "performed_by")}</span><small>{date(read(entry, "performed_at"))}{text(entry, "reason") !== "—" ? ` · ${text(entry, "reason")}` : ""}</small></li>)}</ol></section>}
      </div>

      <footer><button type="button" className="purchase-secondary-button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
