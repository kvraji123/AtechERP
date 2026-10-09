import type { PurchaseOrderFormState, PurchaseOrderLine } from "../purchaseOrderTypes";

type PurchaseOrderLineItemsProps = {
  lines: PurchaseOrderLine[];
  value: PurchaseOrderFormState;
  onChange: (lineId: number, patch: Partial<PurchaseOrderLine>) => void;
  onFormChange: (patch: Partial<PurchaseOrderFormState>) => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseOrderLineItems({ lines, value, onChange, onFormChange }: PurchaseOrderLineItemsProps) {
  const subtotal = lines.reduce((total, line) => total + Math.max(0, line.quantity * line.rate - (line.discount || 0)), 0);
  const tax = lines.reduce((total, line) => { const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0)); return total + taxable * line.taxPercent / 100; }, 0);
  const totalDiscount = lines.reduce((total, line) => total + (line.discount || 0), 0);
  const quotationCharges = lines.reduce((total, line) => total + (line.freightAndOther || 0), 0);
  const packingCharges = value.mode === "DIRECT_PR" ? Number(value.packingCharges || 0) : 0;
  const freightCharges = value.mode === "DIRECT_PR" ? Number(value.freightCharges || 0) : quotationCharges;
  const otherCharges = value.mode === "DIRECT_PR" ? Number(value.otherCharges || 0) : 0;
  const totalCharges = packingCharges + freightCharges + otherCharges;
  const updateQuantity = (lineId: number, rawValue: string) => onChange(lineId, { quantity: rawValue === "" ? 0 : Math.trunc(Number(rawValue)) });
  return <section className="purchase-po-section">
    <header><div><h2>PO Items</h2><p>Quantity and rate can be modified before approval.</p></div><span className="purchase-po-draft">{lines.length} items</span></header>
    <div className="purchase-po-table-wrap"><table className="purchase-po-table"><thead><tr><th>S.No</th><th>Enquiry / Item</th><th>Specification</th><th>Quantity</th><th>UOM</th><th>Accepted Rate</th><th>Discount</th><th>Tax %</th>{value.mode !== "DIRECT_PR" && <th>Freight / Other</th>}<th>Taxable Amount</th></tr></thead><tbody>{lines.map((line, index) => { const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0)); return <tr key={line.id}><td>{index + 1}</td><td><strong>{line.itemName}</strong><small>{line.enquiryNumber} · {line.itemCode}</small></td><td>{line.specification}</td><td><input type="number" min="1" step="1" inputMode="numeric" value={line.quantity} onChange={(event) => updateQuantity(line.id, event.target.value)} /></td><td>{line.uom}</td><td><input type="number" min="0" step="any" inputMode="decimal" value={line.rate} onChange={(event) => onChange(line.id, { rate: Number(event.target.value) })} /></td><td>{money.format(line.discount || 0)}</td><td>{line.taxPercent}%</td>{value.mode !== "DIRECT_PR" && <td>{money.format(line.freightAndOther || 0)}</td>}<td className="money">{money.format(taxable)}</td></tr>; })}</tbody></table></div>
    <div className="purchase-po-summary"><dl><dt>Gross Amount</dt><dd>{money.format(subtotal + totalDiscount)}</dd><dt>Quotation Discount</dt><dd>− {money.format(totalDiscount)}</dd><dt>Taxable Subtotal</dt><dd>{money.format(subtotal)}</dd><dt>GST</dt><dd>{money.format(tax)}</dd>{value.mode === "DIRECT_PR" ? <><dt><label htmlFor="po-packing-charges">Packing Charges</label></dt><dd><input id="po-packing-charges" className="purchase-po-charge-input" type="number" min="0" step="0.01" value={value.packingCharges || 0} onChange={(event) => onFormChange({ packingCharges: Math.max(0, Number(event.target.value)) })} /></dd><dt><label htmlFor="po-freight-charges">Freight Charges</label></dt><dd><input id="po-freight-charges" className="purchase-po-charge-input" type="number" min="0" step="0.01" value={value.freightCharges || 0} onChange={(event) => onFormChange({ freightCharges: Math.max(0, Number(event.target.value)) })} /></dd><dt><label htmlFor="po-other-charges">Other Charges</label></dt><dd><input id="po-other-charges" className="purchase-po-charge-input" type="number" min="0" step="0.01" value={value.otherCharges || 0} onChange={(event) => onFormChange({ otherCharges: Math.max(0, Number(event.target.value)) })} /></dd></> : <><dt>Freight / Other Charges</dt><dd>{money.format(totalCharges)}</dd></>}<dt className="total">PO Total</dt><dd className="total">{money.format(subtotal + tax + totalCharges)}</dd></dl></div>
  </section>;
}
