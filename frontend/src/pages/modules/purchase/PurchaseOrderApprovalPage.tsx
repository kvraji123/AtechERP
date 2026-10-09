import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi, type PurchaseOrderDetail } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseOrderApprovalDecision from "./components/PurchaseOrderApprovalDecision";
import PurchaseOrderApprovalItems from "./components/PurchaseOrderApprovalItems";
import PurchaseOrderApprovalSummary, { type PurchaseOrderApprovalAddressState } from "./components/PurchaseOrderApprovalSummary";
import { mapPurchaseOrderApprovalDetail } from "./purchaseOrderApprovalApi";
import type { PurchaseOrderApprovalRecord } from "./purchaseFlowStore";
import type { PurchaseOrderLine } from "./purchaseOrderTypes";
import "./PurchaseFlow.css";

export default function PurchaseOrderApprovalPage() {
  const navigate = useNavigate();
  const { poId } = useParams();
  const { showSuccess } = useAppFeedback();
  const [record, setRecord] = useState<PurchaseOrderApprovalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [addresses, setAddresses] = useState<PurchaseOrderApprovalAddressState>({ billingSource: "ATECH-COIMBATORE", billingAddress: "Atech Automation, Coimbatore, Tamil Nadu", deliverySource: "ATECH-COIMBATORE", deliveryAddress: "Atech Automation, Coimbatore, Tamil Nadu" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [deciding, setDeciding] = useState(false);

  const unsaved = useUnsavedChanges({lines,addresses,reason});

  useEffect(() => {
    if (!poId) { setLoading(false); return; }
    let active = true;
    const loadRecord = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await purchaseApi.getPurchaseOrderApproval(poId);
        const mapped = mapPurchaseOrderApprovalDetail(response?.data as PurchaseOrderDetail);
        if (!active) return;
        setRecord(mapped);
        setLines(mapped.lines.map((line) => ({ ...line })));
        setAddresses({ billingSource: "ATECH-COIMBATORE", billingAddress: mapped.form.billingAddress || "Atech Automation, Coimbatore, Tamil Nadu", deliverySource: "ATECH-COIMBATORE", deliveryAddress: mapped.form.deliveryAddress || "Atech Automation, Coimbatore, Tamil Nadu" });
        setReason(mapped.decisionReason || "");
      } catch (loadError) {
        if (active) setError(apiMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadRecord();
    return () => { active = false; };
  }, [poId]);

  if (loading) return <div className="purchase-page"><section className="purchase-po-approval-section"><div className="purchase-po-approval-empty">Loading purchase order for approval…</div></section></div>;
  if (!record) return <div className="purchase-page"><section className="purchase-po-approval-section"><div className="purchase-po-approval-empty">{error || "Purchase order not found."}</div><footer className="purchase-po-approval-actions"><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/orders/approval")}>Back to PO Approval</button></footer></section></div>;
  const originalLines = record.lines.map((line) => ({ ...line }));

  const decide = async (decision: "APPROVED" | "RETURNED" | "REJECTED") => {
    const savedSnapshot = unsaved.snapshot();

    if (["RETURNED", "REJECTED"].includes(decision) && !reason.trim()) { setError("Decision reason is required when returning or rejecting a purchase order."); return; }
    if (lines.some((line) => line.quantity <= 0 || line.rate < 0)) { setError("Approved quantity and rate must contain valid values."); return; }
    setDeciding(true);
    setError("");
    try {
      const action = decision === "APPROVED" ? "approve" : decision === "RETURNED" ? "return" : "reject";
      await purchaseApi.decidePurchaseOrderApproval(record.backendId || record.id, action, { reason: reason.trim() });
      unsaved.markSaved(savedSnapshot); showSuccess(decision === "APPROVED" ? "Purchase order approved." : decision === "RETURNED" ? "Purchase order returned for correction." : "Purchase order rejected.");
      navigate("/purchase/orders/approval", { replace: true });
    } catch (decisionError) {
      setError(apiMessage(decisionError));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className="purchase-page">
      <header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" aria-label="Return to PO approval list" onClick={() => navigate("/purchase/orders/approval")}><ArrowLeft size={19} /></button><div><p>Purchase / Purchase Order Approval</p><h1>PO Approval Review</h1><span>Review supplier PO, modify quantity or rate and record the approval decision</span></div></div><span className="purchase-po-approval-role"><ShieldCheck size={17} /> Purchase Approver</span></header>
      <PurchaseModuleTabs />
      <div className="purchase-po-approval-page"><PurchaseOrderApprovalSummary record={record} value={addresses} onChange={(patch) => setAddresses((current) => ({ ...current, ...patch }))} /><PurchaseOrderApprovalItems lines={lines} originalLines={originalLines} otherCharges={record.otherChargesAmount} onChange={(lineId, patch) => setLines((current) => current.map((line) => line.id === lineId ? { ...line, ...patch } : line))} />{record.status === "SUBMITTED" ? <PurchaseOrderApprovalDecision reason={reason} error={deciding ? "Recording decision…" : error} onReasonChange={(value) => { setReason(value); setError(""); }} onDecision={(decision) => { if (!deciding) void decide(decision); }} /> : <section className="purchase-po-approval-section"><header><div><h2>Decision Details</h2><p>This purchase order decision is complete.</p></div></header><div className="purchase-po-approval-decision-body"><label className="purchase-field"><span>Decision Reason</span><textarea value={reason || "No reason recorded"} readOnly /></label></div><footer className="purchase-po-approval-actions"><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/orders/approval")}>Back to PO Approval List</button></footer></section>}</div>
    </div>
  );
}
