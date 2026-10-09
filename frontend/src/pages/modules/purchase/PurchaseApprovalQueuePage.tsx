import { Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppFeedback } from "../../../components/AppFeedback";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { supplierApi } from "../../../api/supplier.api";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseApprovalFilters, { type ApprovalFilters } from "./components/PurchaseApprovalFilters";
import PurchaseApprovalTable from "./components/PurchaseApprovalTable";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import HighPriorityStampIcon from "./components/HighPriorityStampIcon";
import PendingApprovalStampIcon from "./components/PendingApprovalStampIcon";
import { loadPurchaseApprovalQueue, mapApprovalRequest } from "./purchaseApprovalState";
import "./PurchaseFlow.css";

type ApprovalSupplierOption = { id: string; label: string };

export default function PurchaseApprovalQueuePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { showSuccess } = useAppFeedback();
  const [requests, setRequests] = useState<ReturnType<typeof loadPurchaseApprovalQueue>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState<ApprovalSupplierOption[]>([]);
  const filters = useMemo<ApprovalFilters>(() => ({ search: params.get("search") || "", plant: params.get("plant") || "ALL", department: params.get("department") || "ALL", priority: params.get("priority") || "ALL", supplier: params.get("supplier") || "ALL", status: params.get("status") || "ALL" }), [params]);
  const setFilters = (value: ApprovalFilters) => { setPage(1); setParams(Object.fromEntries(Object.entries(value).filter(([, entry]) => entry && entry !== "ALL"))); };
  const [counts, setCounts] = useState({ pending: 0, high: 0 });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await purchaseApi.listApprovals({ page, pageSize: PAGE_SIZE, search: filters.search, status: filters.status === "ALL" ? "" : filters.status, plant: filters.plant === "ALL" ? "" : filters.plant, department: filters.department === "ALL" ? "" : filters.department, priority: filters.priority === "ALL" ? "" : filters.priority, supplier: filters.supplier === "ALL" ? "" : filters.supplier });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setRequests(rows.map(mapApprovalRequest));
      setTotal(Number(response?.meta?.total || 0));
    } catch (loadError) { setError(apiMessage(loadError)); } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [page, filters]);
  useEffect(() => {
    let active = true;
    void supplierApi.list({ page: 1, pageSize: 100 }).then((response) => {
      if (!active) return;
      setSuppliers((response?.data || []).map((supplier: any) => ({
        id: String(supplier.supplierId),
        label: [supplier.supplierCode, supplier.supplierName].filter(Boolean).join(" · ") || "Unnamed supplier",
      })));
    }).catch((loadError) => active && setError(apiMessage(loadError)));
    return () => { active = false; };
  }, []);
  const loadCounts = async () => {
    try {
      const [pending, high] = await Promise.all([purchaseApi.listApprovals({ status: "PENDING", pageSize: 1 }), purchaseApi.listApprovals({ priority: "HIGH", pageSize: 1 })]);
      setCounts({ pending: Number(pending.meta?.total || 0), high: Number(high.meta?.total || 0) });
    } catch (reason) { setError(apiMessage(reason)); }
  };
  useEffect(() => { void loadCounts(); }, []);
  const openCard = (kind: "pending" | "high") => {
    setFilters({ search: "", plant: "ALL", department: "ALL", priority: kind === "high" ? "High" : "ALL", supplier: "ALL", status: kind === "pending" ? "PENDING" : "ALL" });
    document.getElementById("pr-approval-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredRequests = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return requests.filter((request) =>
      (!query || request.prNumber.toLowerCase().includes(query)) &&
      (filters.plant === "ALL" || request.plant === filters.plant) &&
      (filters.department === "ALL" || request.department === filters.department) &&
      (filters.priority === "ALL" || request.priority === filters.priority) &&
      (filters.supplier === "ALL" || request.preferredSupplierId === filters.supplier)
    );
  }, [filters, requests]);

  return (
    <div className="purchase-page">
      <header className="purchase-page-header">
        <div className="purchase-title-group"><span className="purchase-approval-title-icon"><Inbox size={20} /></span><div><p>Purchase / Approvals</p><h1>PR Approval Queue</h1><span>Review purchase requests received from all plants and floor managers</span></div></div>
      </header>

      <PurchaseModuleTabs />

      <div className="purchase-approval-stats">
        <button type="button" className="danger" onClick={() => openCard("pending")} aria-label="View pending purchase requests"><span className="purchase-approval-stat-icon"><PendingApprovalStampIcon size={24} /></span><div><span>Pending Approval</span><strong>{counts.pending}</strong><em>Requests awaiting review</em></div></button>
        <button type="button" className="warning" onClick={() => openCard("high")} aria-label="View high priority purchase requests"><span className="purchase-approval-stat-icon"><HighPriorityStampIcon size={24} /></span><div><span>High Priority Requests</span><strong>{counts.high}</strong><em>Require priority action</em></div></button>
      </div>

      <section id="pr-approval-list" className="purchase-form-section">
        <header className="purchase-approval-list-head"><div><h2>Submitted Purchase Requests</h2><p>High-priority and earliest required-date requests are shown first</p></div><span>{total} request{total === 1 ? "" : "s"}</span></header>
        <PurchaseApprovalFilters value={filters} requests={requests} suppliers={suppliers} onChange={setFilters} onRefresh={() => { void load(); void loadCounts(); showSuccess("Purchase request queue refreshed."); }}  pagination={<Pagination page={page} total={total} onPageChange={setPage} itemLabel="purchase requests" disabled={loading} />} />
        {error && <div className="marketing-form-alert error" role="alert">{error}</div>}
        {loading ? <div className="purchase-po-approval-empty">Loading approval queue...</div> : <PurchaseApprovalTable requests={filteredRequests} onReview={(request) => navigate(`/purchase/approvals/${request.id}`)} />}
        
      </section>
    </div>
  );
}
