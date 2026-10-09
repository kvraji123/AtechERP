import { ArrowRight } from "lucide-react";
import type { QuotationComparisonItem, QuotationComparisonSupplier } from "../quotationComparisonData";

type SupplierDecisionPanelProps = {
  items: QuotationComparisonItem[];
  selectedSuppliers: Record<string, string>;
  supplier: QuotationComparisonSupplier;
  reason: string;
  error: string;
  onReasonChange: (value: string) => void;
  onContinue: () => void;
  busy?: boolean;
};

export default function SupplierDecisionPanel({ items, selectedSuppliers, supplier, reason, error, onReasonChange, onContinue, busy = false }: SupplierDecisionPanelProps) {
  const override = !supplier.isRecommended;
  const allocations = [...items.reduce((result, item) => {
    const selected = item.quotations.find((quote) => quote.supplierId === selectedSuppliers[item.id]);
    if (selected) result.set(selected.supplierId, { name: selected.supplierName, count: (result.get(selected.supplierId)?.count || 0) + 1 });
    return result;
  }, new Map<string, { name: string; count: number }>()).values()];
  const selectedCount = items.filter((item) => Boolean(selectedSuppliers[item.id])).length;
  return (
    <section className="purchase-comparison-section">
      <header><div><h2>Selection summary</h2><p>{selectedCount} of {items.length} item{items.length === 1 ? "" : "s"} allocated. The summary updates as you select a supplier in the comparison table.</p></div></header>
      <div className="purchase-comparison-decision">
        <div className="purchase-comparison-allocation-summary"><span>Supplier allocation</span><strong>{allocations.length ? "Current selections" : "No supplier selected"}</strong><div>{allocations.map((entry) => <em key={entry.name}>{entry.name} · {entry.count} item{entry.count === 1 ? "" : "s"}</em>)}</div><small className={override ? "override" : ""}>{override ? `Active item: ${supplier.supplierName} is an override — reason required` : `Active item: ${supplier.supplierName} matches the recommendation`}</small></div>
        <label><span>{override ? "Override Reason *" : "Decision Note (Optional)"}</span><textarea value={reason} aria-invalid={Boolean(error)} onChange={(event) => onReasonChange(event.target.value)} placeholder="Negotiation or selection note" />{error && <small className="purchase-comparison-error">{error}</small>}</label>
      </div>
      <footer><button type="button" className="purchase-primary-button" disabled={busy} onClick={onContinue}><ArrowRight size={16} /> {busy ? "Submitting & Creating PO…" : "Submit & Continue to PO"}</button></footer>
    </section>
  );
}
