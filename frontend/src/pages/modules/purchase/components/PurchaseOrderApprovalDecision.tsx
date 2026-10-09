import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

type PurchaseOrderApprovalDecisionProps = {
  reason: string;
  error: string;
  onReasonChange: (value: string) => void;
  onDecision: (decision: "APPROVED" | "RETURNED" | "REJECTED") => void;
};

export default function PurchaseOrderApprovalDecision({ reason, error, onReasonChange, onDecision }: PurchaseOrderApprovalDecisionProps) {
  return (
    <section className="purchase-po-approval-section">
      <header><div><h2>Approval Decision</h2><p>A decision reason is optional for approval and required for return or rejection.</p></div></header>
      <div className="purchase-po-approval-decision-body"><label className="purchase-field"><span>Decision Reason</span><textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Enter approval notes or required return/rejection instructions" /></label>{error && <p className="purchase-dialog-error" role="alert">{error}</p>}</div>
      <footer className="purchase-po-approval-actions"><button type="button" className="purchase-approve-button" onClick={() => onDecision("APPROVED")}><CheckCircle2 size={16} /> Approve PO</button><button type="button" className="purchase-correction-button" onClick={() => onDecision("RETURNED")}><RotateCcw size={16} /> Return for Correction</button><button type="button" className="purchase-reject-button" onClick={() => onDecision("REJECTED")}><XCircle size={16} /> Reject PO</button></footer>
    </section>
  );
}
