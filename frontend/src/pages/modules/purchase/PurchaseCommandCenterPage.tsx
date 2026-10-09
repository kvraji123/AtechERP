import { FileClock, FilePlus2, LayoutDashboard, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import PurchaseAttentionList, { type PurchaseAttentionRecord } from "./components/PurchaseAttentionList";
import PurchaseCommandMetrics, { type PurchaseCommandMetric } from "./components/PurchaseCommandMetrics";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PendingApprovalStampIcon from "./components/PendingApprovalStampIcon";
import { mapApprovalRequest, type PurchaseApprovalApiRow } from "./purchaseApprovalState";
import { loadPurchaseOrderApprovals } from "./purchaseFlowStore";
import { loadRfqPurchaseRequests } from "./purchaseRfqRequests";
import "./PurchaseFlow.css";

export default function PurchaseCommandCenterPage() {
  const navigate = useNavigate();
  const [approvalRequests, setApprovalRequests] = useState<ReturnType<typeof mapApprovalRequest>[]>([]);
  const [error, setError] = useState("");
  const [rfqRequests] = useState(loadRfqPurchaseRequests);
  const [poApprovals] = useState(loadPurchaseOrderApprovals);

  useEffect(() => {
    let active = true;
    purchaseApi.listApprovals({ page: 1, pageSize: 100 })
      .then((response: { data?: PurchaseApprovalApiRow[] }) => {
        if (active) setApprovalRequests((response.data || []).map(mapApprovalRequest));
      })
      .catch((requestError) => { if (active) setError(apiMessage(requestError)); });
    return () => { active = false; };
  }, []);

  const pendingPrCount = approvalRequests.filter((request) => request.status === "Pending").length;
  const pendingRfqCount = rfqRequests.filter((request) => request.status === "APPROVED" && request.rfqStatus === "NOT_CREATED").length;
  const comparisonPendingCount = 0;
  const pendingPoCount = poApprovals.filter((record) => record.status === "SUBMITTED").length;

  const attentionRecords = useMemo<PurchaseAttentionRecord[]>(() => approvalRequests
    .filter((request) => request.status === "Pending")
    .sort((left, right) => {
      const rank = { High: 0, Medium: 1, Low: 2 };
      return rank[left.priority] - rank[right.priority];
    })
    .map((request) => ({
      id: request.id,
      reference: request.prNumber,
      requester: request.requestedBy,
      submittedDate: request.submittedDate,
      department: request.department,
      plant: request.plant,
      itemCount: request.itemCount,
      requiredDate: request.requiredDate,
      priority: request.priority,
      route: `/purchase/approvals/${request.id}`,
    })), []);

  const metrics = useMemo<PurchaseCommandMetric[]>(() => [
    { label: "PR Approval Pending", value: pendingPrCount, detail: `${approvalRequests.filter((request) => request.priority === "High").length} high-priority requests`, route: "/purchase/approvals", icon: PendingApprovalStampIcon, tone: "danger" },
    { label: "RFQ Response Pending", value: pendingRfqCount, detail: "Supplier responses to follow up", route: "/purchase/rfqs", icon: FileClock, tone: "warning" },
    { label: "Comparison Pending", value: comparisonPendingCount, detail: "Supplier decisions required", route: "/purchase/quotation-comparison", icon: Scale, tone: "success" },
    { label: "PO Approval Pending", value: pendingPoCount, detail: "Supplier-wise orders", route: "/purchase/orders/approval", icon: PendingApprovalStampIcon, tone: "purple" },
  ], [approvalRequests, pendingPoCount, pendingPrCount, pendingRfqCount]);

  return (
    <div className="purchase-page purchase-command-page">
      <header className="purchase-page-header purchase-command-header">
        <div className="purchase-title-group"><span className="purchase-command-title-icon"><LayoutDashboard size={20} /></span><div><p>Purchase / Command Center</p><h1>Purchase Command Center</h1><span>Track approvals, supplier enquiries, comparisons and purchase orders</span></div></div>
      </header>

      <PurchaseModuleTabs activeIndex={1} />

      <PurchaseCommandMetrics metrics={metrics} onOpen={navigate} />

      {error && <p className="purchase-form-error" role="alert">{error}</p>}

      <div className="purchase-command-content">
        <PurchaseAttentionList records={attentionRecords} onOpen={navigate} action={<button type="button" className="purchase-primary-button" onClick={() => navigate("/purchase/requests/new")}><FilePlus2 size={16} /> Purchase Request</button>} />
      </div>
    </div>
  );
}
