import { Plus, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import GateEntryDashboard from "./components/GateEntryDashboard";
import GateEntryFilters from "./components/GateEntryFilters";
import GateEntryTable from "./components/GateEntryTable";
import MaterialMovementTabs from "./components/MaterialMovementTabs";
import type { GateEntryListFilter, GateEntryRecord } from "./gateEntryData";
import { mapGateEntry } from "./purchaseReceiptMappers";
import "./PurchaseFlow.css";

export default function GateEntryListPage() {
  const navigate = useNavigate(); const { showSuccess } = useAppFeedback(); const [records, setRecords] = useState<GateEntryRecord[]>([]); const [summary, setSummary] = useState({ total: 0, gateEntered: 0, pendingGrnCreation: 0, grnCreated: 0, stockPosted: 0 }); const [search, setSearch] = useState(""); const [status, setStatus] = useState<GateEntryListFilter>("ALL"); const [supplier, setSupplier] = useState("ALL"); const [dateRange, setDateRange] = useState("ALL"); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [error, setError] = useState(""); const [suppliers, setSuppliers] = useState<string[]>([]);
  const load = async (notify = false) => { try { setError(""); const [response, summaryResponse] = await Promise.all([purchaseApi.listGateEntries({ page, pageSize: PAGE_SIZE, search, status: status === "ALL" ? "" : status, supplier: supplier === "ALL" ? "" : supplier, dateRange: dateRange === "ALL" ? "" : dateRange }), purchaseApi.gateEntrySummary()]); setRecords((response?.data || []).map(mapGateEntry)); setTotal(Number(response?.meta?.total || 0)); setSummary(summaryResponse?.data || {}); if (notify) showSuccess("Gate entry list refreshed."); } catch (reason) { setError(apiMessage(reason)); } };
  useEffect(() => { void load(); }, [page, search, status, supplier, dateRange]);
  useEffect(() => { void purchaseApi.listGateEntrySuppliers().then((response) => setSuppliers(Array.isArray(response?.data) ? response.data.filter(Boolean) : [])).catch((reason) => setError(apiMessage(reason))); }, []);
  const filtered = records;
  const openRecord = (record: GateEntryRecord) => { if (record.status === "DRAFT" || record.entryType === "OTHER_SERVICES") navigate(`/gate-entry/new?id=${record.id}`); else if (record.status === "GATE_ENTERED") navigate(`/grn-inward/new?gateEntryId=${record.id}`); else navigate("/grn-inward"); };
  return <div className="purchase-page"><header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-back-button"><Warehouse size={19} /></span><div><p>Material Movement / Gate Entry</p><h1>Gate Entry</h1><span>Record incoming vehicle and material arrivals before GRN Inward</span></div></div></header><MaterialMovementTabs /><div className="purchase-gate-page"><GateEntryDashboard summary={summary} status={status} onStatusChange={(value) => { setStatus(value); setPage(1); }} /><section className="purchase-gate-list"><header><div><h2>Gate Entry List</h2><p>Draft, entered and GRN-completed inward records.</p></div><div className="purchase-list-head-actions"><span>{total} records</span><button type="button" className="purchase-primary-button" onClick={() => navigate("/gate-entry/new")}><Plus size={15} /> Create Gate Entry</button></div></header>{error && <p className="purchase-gate-form-error">{error}</p>}<GateEntryFilters suppliers={suppliers} search={search} status={status} supplier={supplier} dateRange={dateRange} onSearchChange={(value) => { setSearch(value); setPage(1); }} onStatusChange={(value) => { setStatus(value); setPage(1); }} onSupplierChange={(value) => { setSupplier(value); setPage(1); }} onDateRangeChange={(value) => { setDateRange(value); setPage(1); }} onRefresh={() => { void load(true); }}  pagination={<Pagination page={page} total={total} onPageChange={setPage} itemLabel="gate entries" />} /><GateEntryTable records={filtered} onAction={openRecord} /></section></div></div>;
}
