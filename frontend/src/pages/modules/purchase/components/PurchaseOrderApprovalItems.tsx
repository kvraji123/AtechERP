import type { PurchaseOrderLine } from "../purchaseOrderTypes";

type PurchaseOrderApprovalItemsProps = {
  lines: PurchaseOrderLine[];
  originalLines: PurchaseOrderLine[];
  otherCharges?: number;
  onChange: (lineId: number, patch: Partial<PurchaseOrderLine>) => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseOrderApprovalItems({ lines, originalLines, otherCharges = 0, onChange }: PurchaseOrderApprovalItemsProps) {
  const subtotal = lines.reduce((total, line) => total + line.quantity * line.rate, 0);
  const tax = lines.reduce((total, line) => total + line.quantity * line.rate * line.taxPercent / 100, 0);
  const changedCount = lines.filter((line) => {
    const original = originalLines.find((entry) => entry.id === line.id);
    return original && (original.quantity !== line.quantity || original.rate !== line.rate);
  }).length;

  return <section className="purchase-po-approval-section">
    <header><div><h2>PO Items Review</h2><p>Approver may correct quantity and rate before accepting the PO.</p></div><span className={changedCount ? "purchase-po-change-count changed" : "purchase-po-change-count"}>{changedCount} modified</span></header>
    <div className="purchase-po-table-wrap"><table className="purchase-po-table purchase-po-approval-table"><thead><tr><th>S.No</th><th>Enquiry / Item</th><th>Specification</th><th>Original Qty</th><th>Approved Qty</th><th>Original Rate</th><th>Approved Rate</th><th>Tax %</th><th>Amount</th></tr></thead><tbody>{lines.map((line, index) => {
      const original = originalLines.find((entry) => entry.id === line.id) || line;
      const quantityChanged = original.quantity !== line.quantity;
      const rateChanged = original.rate !== line.rate;
      return <tr key={line.id}><td>{index + 1}</td><td><strong>{line.itemName}</strong><small>{line.enquiryNumber} · {line.itemCode}</small></td><td>{line.specification}</td><td>{original.quantity} {line.uom}</td><td><input className={quantityChanged ? "modified" : ""} type="number" min="1" step="1" inputMode="numeric" value={line.quantity} onChange={(event) => onChange(line.id, { quantity: event.target.value === "" ? 0 : Math.trunc(Number(event.target.value)) })} /></td><td>{money.format(original.rate)}</td><td><input className={rateChanged ? "modified" : ""} type="number" min="0" step="any" inputMode="decimal" value={line.rate} onChange={(event) => onChange(line.id, { rate: Number(event.target.value) })} /></td><td>{line.taxPercent}%</td><td className="money">{money.format(line.quantity * line.rate)}</td></tr>;
    })}</tbody></table></div>
    <div className="purchase-po-summary"><dl><dt>Subtotal</dt><dd>{money.format(subtotal)}</dd><dt>GST</dt><dd>{money.format(tax)}</dd><dt>Freight / Other Charges</dt><dd>{money.format(otherCharges)}</dd><dt className="total">PO Total</dt><dd className="total">{money.format(subtotal + tax + otherCharges)}</dd></dl></div>
  </section>;
}
