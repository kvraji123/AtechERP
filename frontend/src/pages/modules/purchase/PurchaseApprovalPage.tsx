import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppFeedback } from "../../../components/AppFeedback";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import PurchaseApprovalDecision from "./components/PurchaseApprovalDecision";
import PurchaseApprovalLineFeasibility, { type ApprovalFeasibilityLine } from "./components/PurchaseApprovalLineFeasibility";
import PurchaseFormSection from "./components/PurchaseFormSection";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import type { PurchaseApprovalRequest } from "./types";
import "./PurchaseFlow.css";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const toInputDate = (value: string) => {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

type ApprovalApiDetail = {
  purchase_request_id: number;
  pr_number: string;
  plant_code: string;
  floor_department: string;
  requested_by: string;
  requisition_type: string;
  priority: string;
  required_date: string;
  estimated_total_amount: number;
  pr_status: string;
  preferred_supplier_name?: string | null;
  preferred_supplier_code?: string | null;
  items: Array<{
    purchase_request_item_id: number;
    item_type_name: string;
    item_group_name: string;
    item_description: string;
    item_specification?: string;
    requested_quantity: number;
    uom_code: string;
    purpose: string;
    estimated_total_amount: number;
    approval_status: "PENDING" | "APPROVED" | "NOT_APPROVED" | "CLARIFICATION";
    approved_quantity?: number | null;
    approval_reason?: string | null;
    required_date?: string;
  }>;
};

export default function PurchaseApprovalPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const { showSuccess } = useAppFeedback();
  const [request, setRequest] = useState<PurchaseApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [comments, setComments] = useState("");
  const [validationError, setValidationError] = useState("");
  const [decision, setDecision] = useState<"PENDING" | "APPROVED" | "RETURNED" | "REJECTED">("PENDING");
  const [lineDecisions, setLineDecisions] = useState<ApprovalFeasibilityLine[]>([]);
  const [saving, setSaving] = useState(false);

  const unsaved = useUnsavedChanges({comments,lineDecisions});

  useEffect(() => {
    if (!requestId) return;
    let active = true;
    setLoading(true); setLoadError("");
    purchaseApi.getApproval(requestId)
      .then((response) => {
        if (!active) return;
        const detail = response?.data as ApprovalApiDetail;
        const mapped: PurchaseApprovalRequest = {
          id: String(detail.purchase_request_id), prNumber: detail.pr_number,
          plant: detail.plant_code || "-", department: detail.floor_department || "-",
          requestedBy: detail.requested_by || "-", submittedDate: detail.required_date || "-",
          submittedTime: "", itemCount: detail.items?.length || 0,
          requiredDate: detail.required_date || "-", amount: Number(detail.estimated_total_amount || 0),
          priority: String(detail.priority || "MEDIUM").toLowerCase().replace(/^./, (value) => value.toUpperCase()) as PurchaseApprovalRequest["priority"],
          status: detail.pr_status === "RETURNED" ? "Returned" : "Pending",
          requisitionType: detail.requisition_type === "NEW_ITEM" ? "New Item" : "Existing Item",
          preferredSupplier: detail.preferred_supplier_name ? { name: detail.preferred_supplier_name, code: detail.preferred_supplier_code || "" } : undefined,
        };
        setRequest(mapped);
        setLineDecisions((detail.items || []).map((line) => ({
          id: Number(line.purchase_request_item_id), itemType: line.item_type_name,
          group: line.item_group_name, description: line.item_description,
          specification: line.item_specification || "", quantity: Number(line.requested_quantity),
          uom: line.uom_code, purpose: line.purpose, amount: Number(line.estimated_total_amount || 0),
          selected: false, status: line.approval_status || "PENDING",
          locked: String(line.approval_status || "").toUpperCase() === "APPROVED",
          approvedQuantity: line.approved_quantity == null ? "" : Number(line.approved_quantity),
          requiredDate: toInputDate(line.required_date || detail.required_date), reason: line.approval_reason || "",
        })));
      })
      .catch((loadFailure) => { if (active) setLoadError(apiMessage(loadFailure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId]);
  const approvedCount = lineDecisions.filter((line) => line.status === "APPROVED").length;
  const hasClarification = lineDecisions.some((line) => line.status === "CLARIFICATION");
  const hasNotApproved = lineDecisions.some((line) => line.status === "NOT_APPROVED");
  const approveLabel = approvedCount && hasClarification ? "Approve Selected & Return Clarifications" : approvedCount && hasNotApproved ? "Approve Selected & Reject Others" : "Approve Selected Items";

  const decide = async (nextDecision: "APPROVED" | "RETURNED" | "REJECTED") => {
    const savedSnapshot = unsaved.snapshot();

    if (!requestId || !request) return;
    if (nextDecision === "APPROVED") {
      const approvedLines = lineDecisions.filter((line) => line.status === "APPROVED");
      const invalidQuantity = approvedLines.find((line) => !Number.isFinite(Number(line.approvedQuantity)) || Number(line.approvedQuantity) <= 0 || Number(line.approvedQuantity) > line.quantity);
      const missingReason = lineDecisions.find((line) => ["NOT_APPROVED", "CLARIFICATION"].includes(line.status) && !line.reason.trim());
      if (!approvedLines.length) {
        setValidationError("Mark at least one line item as approved before processing the PR.");
        return;
      }
      if (lineDecisions.some((line) => line.status === "PENDING")) {
        setValidationError("Select a status for every line item before processing the PR.");
        return;
      }
      if (invalidQuantity) {
        setValidationError(`Enter a valid approved quantity for ${invalidQuantity.itemType}.`);
        return;
      }
      if (missingReason) {
        setValidationError(`Enter a correction or rejection reason for ${missingReason.itemType}.`);
        return;
      }
    }
    if (nextDecision !== "APPROVED" && !comments.trim()) {
      setValidationError(nextDecision === "REJECTED" ? "Rejection reason is required." : "Correction reason is required.");
      return;
    }
    setValidationError(""); setSaving(true);
    const payloadLines = nextDecision === "RETURNED"
      ? lineDecisions.map((line) => ({ purchaseRequestItemId: line.id, status: "CLARIFICATION" as const, approvedQuantity: null, reason: comments.trim() }))
      : nextDecision === "REJECTED"
        ? lineDecisions.map((line) => ({ purchaseRequestItemId: line.id, status: "NOT_APPROVED" as const, approvedQuantity: null, reason: comments.trim() }))
        : lineDecisions.map((line) => ({ purchaseRequestItemId: line.id, status: line.status as "APPROVED" | "NOT_APPROVED" | "CLARIFICATION", approvedQuantity: line.status === "APPROVED" ? Number(line.approvedQuantity) : null, reason: line.reason.trim() || null }));
    try {
      await purchaseApi.decideApproval(requestId, { reason: comments.trim() || undefined, items: payloadLines });
      setDecision(nextDecision);
      unsaved.markSaved(savedSnapshot); showSuccess(nextDecision === "APPROVED" ? approvedCount === lineDecisions.length ? "Purchase request approved and made available for enquiry." : `${approvedCount} line item(s) approved and made available for enquiry.` : nextDecision === "RETURNED" ? "Purchase request returned for correction." : "Purchase request rejected.");
      navigate("/purchase/approvals", { replace: true });
    } catch (saveError) { setValidationError(apiMessage(saveError)); } finally { setSaving(false); }
  };

  if (loading) return <div className="purchase-page"><div className="purchase-po-approval-empty">Loading purchase request...</div></div>;
  if (!request) return <div className="purchase-page"><div className="marketing-form-alert error" role="alert">{loadError || "Purchase request could not be loaded."}</div></div>;

  return (
    <div className="purchase-page">
      <header className="purchase-page-header">
        <div className="purchase-title-group"><button type="button" className="purchase-back-button" aria-label="Return to approval queue" onClick={() => navigate("/purchase/approvals")}><ArrowLeft size={19} /></button><div><p>Purchase / Approvals</p><h1>PR Approval</h1><span>Review submitted purchase request and record the manager decision</span></div></div>
        <span className={`purchase-approval-detail-status ${decision.toLowerCase()}`}>{decision === "PENDING" ? "Pending Approval" : decision === "APPROVED" ? "Approved" : decision === "RETURNED" ? "Returned for Correction" : "Rejected"}</span>
      </header>

      <PurchaseModuleTabs />

      <div className="purchase-form">
        <PurchaseFormSection title="Purchase Request Review" description={`${request.prNumber} · Submitted for Purchase Manager approval`} icon={<ClipboardCheck size={19} />}>
          <div className="purchase-approval-review-grid single">
            <div className="purchase-approval-summary purchase-approval-summary-row">
              <div><span>PR Number</span><strong>{request.prNumber}</strong></div>
              <div><span>Requested By</span><strong>{request.requestedBy}</strong></div>
              <div><span>Plant</span><strong>{request.plant}</strong></div>
              <div><span>Department</span><strong>{request.department}</strong></div>
              <div><span>Requisition Type</span><strong>{request.requisitionType}</strong></div>
              <div><span>Preferred Supplier</span><strong>{request.preferredSupplier?.name || "No preference"}</strong>{request.preferredSupplier?.code && <small>{request.preferredSupplier.code}</small>}</div>
              <div><span>Priority</span><strong>{request.priority}</strong></div>
              <div><span>Required Date</span><strong>{request.requiredDate}</strong></div>
            </div>
          </div>

          <PurchaseApprovalLineFeasibility lines={lineDecisions} money={money} onChange={(lines) => { setLineDecisions(lines); if (validationError) setValidationError(""); }} />

          <PurchaseApprovalDecision
            comments={comments}
            validationError={validationError}
            onCommentsChange={(value) => {
              setComments(value);
              if (validationError) setValidationError("");
            }}
            onDecision={(next) => { void decide(next); }}
            approveLabel={approveLabel}
          />
        </PurchaseFormSection>
      </div>
    </div>
  );
}
