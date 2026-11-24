import { FilePlus2, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import {
  customerPurchaseOrderApi,
  type CustomerPurchaseOrderListRow,
} from "../../../api/customerPurchaseOrder.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import "./CustomerPurchaseOrder.css";

type StatusFilter = "ALL" | "DRAFT" | "CONFIRMED" | "PARTIALLY_CONVERTED" | "CONVERTED" | "CANCELLED";

const date = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-GB");
};

const label = (status: string) => ({
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  PARTIALLY_CONVERTED: "Partially Converted",
  CONVERTED: "Converted",
  CANCELLED: "Cancelled",
}[status] || status.replace(/_/g, " "));

const money = (currency: string, value: number | string) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "INR"} ${Number(value || 0).toLocaleString("en-IN")}`;
  }
};

export default function CustomerPurchaseOrderListPage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [records, setRecords] = useState<CustomerPurchaseOrderListRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (notify = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await customerPurchaseOrderApi.list({
        page: 1,
        pageSize: 100,
        search,
        status: status === "ALL" ? "" : status,
      });
      setRecords(Array.isArray(response?.data) ? response.data : []);
      if (notify) showSuccess("Customer PO list refreshed.");
    } catch (loadError) {
      setRecords([]);
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [search, status]);

  return (
    <div className="customer-po-page">
      <header className="customer-po-header">
        <div className="customer-po-heading">
          <span className="customer-po-heading-icon"><ShoppingCart size={18} /></span>
          <div><p>Sales / Customer PO</p><h1>Customer Purchase Orders</h1><span>Create confirmed customer POs from Order Received enquiries and convert them to Sales Orders.</span></div>
        </div>
        <button type="button" className="customer-po-primary" onClick={() => navigate("/sales/customer-pos/new")}><FilePlus2 size={15} />Create Customer PO</button>
      </header>

      {error && <p className="customer-po-error" role="alert">{error}</p>}

      <section className="customer-po-list">
        <header className="customer-po-list-header"><div><h2>Customer PO register</h2><p>Draft, confirm and follow conversion into Sales Orders.</p></div><span>{records.length} records</span></header>
        <div className="customer-po-filters">
          <label className="customer-po-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search CPO, customer PO, enquiry or customer" aria-label="Search customer purchase orders" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter Customer PO by status">
            <option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="CONFIRMED">Confirmed</option><option value="PARTIALLY_CONVERTED">Partially converted</option><option value="CONVERTED">Converted</option><option value="CANCELLED">Cancelled</option>
          </select>
          <button type="button" className="customer-po-secondary" disabled={loading} onClick={() => { void load(true); }}><RefreshCw size={14} />Refresh</button>
        </div>
        <div className="customer-po-table-wrap">
          <table className="customer-po-table">
            <thead><tr><th>Customer PO</th><th>Customer</th><th>Enquiry / quotation</th><th>Order type</th><th>PO date</th><th>Delivery date</th><th>Items</th><th className="money">Value</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{records.map((record) => <tr key={record.id}>
              <td><strong>{record.cpoNumber}</strong><small>{record.customerPoNumber || "Customer PO no. pending"}</small></td>
              <td><strong>{record.customerName}</strong><small>{record.customerCode || "—"}</small></td>
              <td><strong>{record.enquiryDocNo}</strong><small>{record.quotationNo || "Finalized quotation"}</small></td>
              <td>{record.orderType}</td><td>{date(record.customerPoDate)}</td><td>{date(record.requiredDeliveryDate)}</td>
              <td className="center">{Number(record.itemCount || 0)}</td><td className="money">{money(record.currencyCode, record.grandTotalAmount)}</td>
              <td><span className={`customer-po-status ${String(record.status).toLowerCase()}`}>{label(record.status)}</span></td>
              <td><button type="button" className="customer-po-action" onClick={() => navigate(`/sales/customer-pos/${record.id}`)}>{record.status === "DRAFT" ? "Edit draft" : "View PO"}</button></td>
            </tr>)}</tbody>
          </table>
          {loading && <div className="customer-po-empty">Loading Customer POs…</div>}
          {!loading && !records.length && <div className="customer-po-empty">No Customer Purchase Orders match the selected criteria.</div>}
        </div>
      </section>
    </div>
  );
}
