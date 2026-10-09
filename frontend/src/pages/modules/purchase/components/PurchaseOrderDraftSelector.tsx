import { CheckCircle2, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import type { SupplierPurchaseOrderDraft } from "../purchaseOrderTypes";

type PurchaseOrderDraftSelectorProps = {
  drafts: SupplierPurchaseOrderDraft[];
  activeDraftId: string;
  onSelect: (draftId: string) => void;
  action?: ReactNode;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseOrderDraftSelector({ drafts, activeDraftId, onSelect, action }: PurchaseOrderDraftSelectorProps) {
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || drafts[0];
  const lineTotal = activeDraft.lines.reduce((sum, line) => {
    const taxable = Math.max(0, line.quantity * line.rate - (line.discount || 0));
    return sum + taxable + taxable * line.taxPercent / 100 + (line.freightAndOther || 0);
  }, 0);
  const directCharges = activeDraft.form.mode === "DIRECT_PR"
    ? Number(activeDraft.form.packingCharges || 0) + Number(activeDraft.form.freightCharges || 0) + Number(activeDraft.form.otherCharges || 0)
    : 0;
  const total = lineTotal + directCharges;

  return (
    <section className="purchase-po-draft-selector">
      <header><div><ShoppingBag size={18} /><span><strong>Supplier-wise PO Drafts</strong><small>{drafts.length} separate {drafts.length === 1 ? "PO" : "POs"} generated from approved item decisions</small></span></div><div className="purchase-po-draft-actions"><em>{drafts.length} drafts</em>{action}</div></header>
      <div className="purchase-po-draft-picker">
        <label className="purchase-field"><span>Select Supplier-wise PO Draft <b>*</b></span><select value={activeDraft.id} onChange={(event) => onSelect(event.target.value)}>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.form.poNumber} — {draft.form.supplierName.split(" · ")[0]} ({draft.lines.length} {draft.lines.length === 1 ? "item" : "items"})</option>)}</select></label>
        <div className="purchase-po-selected-draft"><CheckCircle2 size={18} /><div><span>Selected Draft</span><strong>{activeDraft.form.supplierName}</strong><small>{activeDraft.form.poNumber} · {activeDraft.lines.length} {activeDraft.lines.length === 1 ? "item" : "items"}</small></div><em>{money.format(total)}</em></div>
      </div>
    </section>
  );
}
