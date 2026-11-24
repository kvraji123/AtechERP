import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import { customerPurchaseOrderApi, type SalesOrder } from "../../../api/customerPurchaseOrder.api";
import "./CustomerPurchaseOrder.css";

const money = (currency: string, value: number | string) => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `${currency || "INR"} ${Number(value || 0).toLocaleString("en-IN")}`; }
};

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<SalesOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const customerPurchaseOrderId = searchParams.get("customerPurchaseOrderId");

  useEffect(() => {
    let active = true;
    setLoading(true);
    customerPurchaseOrderApi.listSalesOrders(customerPurchaseOrderId ? { customerPurchaseOrderId } : {})
      .then((response) => { if (active) setRecords(Array.isArray(response?.data) ? response.data : []); })
      .catch((loadError) => { if (active) setError(apiMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerPurchaseOrderId]);

  return <div className="customer-po-page">
    <header className="customer-po-header"><div className="customer-po-heading"><button type="button" className="customer-po-secondary" aria-label="Back to Customer PO list" onClick={() => navigate("/sales/customer-pos")}><ArrowLeft size={15} /></button><span className="customer-po-heading-icon"><ShoppingCart size={18} /></span><div><p>Sales / Sales Order</p><h1>Sales Orders</h1><span>Orders created from confirmed Customer Purchase Orders.</span></div></div></header>
    {error && <p className="customer-po-error" role="alert">{error}</p>}
    <section className="customer-po-list"><header className="customer-po-list-header"><div><h2>Sales Order register</h2><p>{customerPurchaseOrderId ? "Showing orders for the selected Customer PO." : "Showing all Sales Orders."}</p></div><span>{records.length} records</span></header><div className="customer-po-table-wrap"><table className="customer-po-table"><thead><tr><th>Sales Order</th><th>Customer PO</th><th>Customer</th><th>Enquiry</th><th>Order type</th><th className="money">Value</th><th>Status</th></tr></thead><tbody>{records.map((order) => <tr key={order.id}><td><strong>{order.salesOrderNumber}</strong><small>{String(order.salesOrderDate || "").slice(0, 10)}</small></td><td><strong>{order.cpoNumber}</strong><small>{order.customerPoNumber || "—"}</small></td><td>{order.customerName}</td><td>{order.enquiryDocNo}</td><td>{order.orderType}</td><td className="money">{money(order.currencyCode, order.grandTotalAmount)}</td><td><span className="customer-po-status confirmed">{order.status.replace(/_/g, " ")}</span></td></tr>)}</tbody></table>{loading && <div className="customer-po-empty">Loading Sales Orders…</div>}{!loading && !records.length && <div className="customer-po-empty">No Sales Orders have been created yet.</div>}</div></section>
  </div>;
}
