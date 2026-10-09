import { Check, RotateCcw, X } from "lucide-react";

type PurchaseApprovalDecisionProps = {
  comments: string;
  validationError?: string;
  onCommentsChange: (value: string) => void;
  onDecision: (decision: "APPROVED" | "RETURNED" | "REJECTED") => void;
  approveLabel?: string;
};

export default function PurchaseApprovalDecision({ comments, validationError, onCommentsChange, onDecision, approveLabel = "Approve PR" }: PurchaseApprovalDecisionProps) {
  return (
    <div className="purchase-approval-decision">
      <label>
        <span>Decision Reason / Comments <small>* Required for return or rejection</small></span>
        <textarea
          value={comments}
          onChange={(event) => onCommentsChange(event.target.value)}
          placeholder="Required for correction or rejection; optional for approval"
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? "purchase-decision-error" : undefined}
        />
        {validationError && <small id="purchase-decision-error" className="purchase-decision-error" role="alert">{validationError}</small>}
      </label>
      <div className="purchase-decision-actions">
        <button type="button" className="purchase-decision-approve" onClick={() => onDecision("APPROVED")}><Check size={16} /> {approveLabel}</button>
        <button type="button" className="purchase-decision-return" onClick={() => onDecision("RETURNED")}><RotateCcw size={16} /> Return for Correction</button>
        <button type="button" className="purchase-decision-reject" onClick={() => onDecision("REJECTED")}><X size={16} /> Reject PR</button>
      </div>
    </div>
  );
}
