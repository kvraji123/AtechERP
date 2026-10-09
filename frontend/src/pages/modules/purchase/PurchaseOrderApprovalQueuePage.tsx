import { BadgeCheck, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi, type PurchaseOrderListRow } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseOrderApprovalDashboard from "./components/PurchaseOrderApprovalDashboard";
import PurchaseOrderApprovalFilters from "./components/PurchaseOrderApprovalFilters";
import PurchaseOrderApprovalTable from "./components/PurchaseOrderApprovalTable";
import { mapPurchaseOrderApprovalRow } from "./purchaseOrderApprovalApi";
import type { PurchaseOrderApprovalRecord } from "./purchaseFlowStore";
import "./PurchaseFlow.css";

export default function PurchaseOrderApprovalQueuePage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [records, setRecords] = useState<PurchaseOrderApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("SUBMITTED");
  const [supplier, setSupplier] = useState("ALL");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: { count: 0, value: 0 }, pending: { count: 0, value: 0 }, approved: { count: 0, value: 0 } });
  const loadSummary = async () => {
    try { const response = await purchaseApi.purchaseOrderApprovalSummary(); setSummary(response?.data || { total: { count: 0, value: 0 }, pending: { count: 0, value: 0 }, approved: { count: 0, value: 0 } }); }
    catch (error) { setLoadError(apiMessage(error)); }
  };
  const loadRecords = async (notify = false) => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await purchaseApi.listPurchaseOrderApprovals({ page, pageSize: PAGE_SIZE, search, status: status === "ALL" ? "" : status, supplier: supplier === "ALL" ? "" : supplier, dateRange: dateRange === "ALL" ? "" : dateRange });
      const rows = Array.isArray(response?.data) ? response.data as PurchaseOrderListRow[] : [];
      setRecords(rows.map(mapPurchaseOrderApprovalRow));
      setTotal(Number(response?.meta?.total || 0));
      if (notify) showSuccess("Purchase order approval list refreshed.");
    } catch (error) {
      setRecords([]);
      setLoadError(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadRecords(); }, [page, search, status, supplier, dateRange]);
  useEffect(() => {
    void loadSummary();
    void purchaseApi.listPurchaseOrderSuppliers()
      .then((response) => setSuppliers(Array.isArray(response?.data) ? response.data.filter(Boolean) : []))
      .catch((reason) => setLoadError(apiMessage(reason)));
  }, []);
  const filtered = records;

  return <div className="purchase-page"><header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-back-button"><BadgeCheck size={19} /></span><div><p>Purchase / Purchase Order Approval</p><h1>PO Approval</h1><span>Review supplier-wise purchase orders and record approval decisions</span></div></div><span className="purchase-po-approval-role"><ShieldCheck size={17} /> Purchase Approver</span></header><PurchaseModuleTabs /><div className="purchase-po-approval-page"><PurchaseOrderApprovalDashboard summary={summary} status={status} onStatusChange={(value) => { setStatus(value); setPage(1); }} /><section className="purchase-po-approval-list-section"><header><div><h2>Purchase Orders</h2><p>Pending orders appear first, followed by completed decisions.</p></div><span>{total} records</span></header><PurchaseOrderApprovalFilters suppliers={suppliers} search={search} status={status} supplier={supplier} dateRange={dateRange} onSearchChange={(value) => { setSearch(value); setPage(1); }} onStatusChange={(value) => { setStatus(value); setPage(1); }} onSupplierChange={(value) => { setSupplier(value); setPage(1); }} onDateRangeChange={(value) => { setDateRange(value); setPage(1); }} onRefresh={() => { void loadRecords(true); void loadSummary(); }}  pagination={<Pagination page={page} total={total} onPageChange={setPage} itemLabel="purchase orders" disabled={loading} />} />{loadError && <p className="purchase-order-list-error" role="alert">{loadError}</p>}<PurchaseOrderApprovalTable records={filtered} onReview={(record) => navigate(`/purchase/orders/approval/${record.id}`)} />{loading && <div className="purchase-po-approval-empty">Loading purchase orders for approval…</div>}</section></div></div>;
}
