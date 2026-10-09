import { Box, ClipboardList, FileText, Plus, ShoppingCart, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketingApi } from "../../../api/marketing.api";

type DashboardSummary = {
  totalEnquiries?: number;
  feasibilityPending?: number;
  quotationCount?: number;
  quotationValue?: number;
  pendingOrders?: number;
  orderValue?: number;
};

const money = (value: number | undefined) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(Number(value || 0));

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary>({});

  useEffect(() => {
    let active = true;
    marketingApi.dashboardSummary()
      .then((response) => { if (active) setSummary(response?.data || {}); })
      .catch(() => { if (active) setSummary({}); });
    return () => { active = false; };
  }, []);

  const cards = [
    ["Total Enquiries", Number(summary.totalEnquiries || 0).toLocaleString("en-IN"), ClipboardList],
    ["Feasibility Pending", Number(summary.feasibilityPending || 0).toLocaleString("en-IN"), TrendingUp],
    ["Quoted Value", money(summary.quotationValue), FileText],
    ["Pending Orders", Number(summary.pendingOrders || 0).toLocaleString("en-IN"), ShoppingCart],
    ["Order Value", money(summary.orderValue), Box],
  ] as const;

  return <div className="page-container">
    <section className="dashboard-welcome"><div><h1>Good Morning, System! 👋</h1><p>Here&apos;s what&apos;s happening in your manufacturing business today.</p></div><button className="quick-action-button" onClick={() => navigate("/marketing/enquiries/new")}><Plus size={18}/>Quick Actions</button></section>
    <section className="dashboard-card-grid">{cards.map(([title, value, Icon], index) => <article key={title} className={`dashboard-stat-card ${index % 2 ? "pink" : "blue"}`}><div className="dashboard-card-top"><div className={`dashboard-stat-icon ${index % 2 ? "pink" : "blue"}`}><Icon size={25}/></div><div><span className="dashboard-card-title">{title}</span><strong>{value}</strong></div></div><div className="dashboard-change positive">Live total across all records</div></article>)}</section>
    <section className="dashboard-main-grid"><article className="dashboard-panel"><div className="dashboard-panel-header"><div><h2>Marketing Overview</h2><p>Live workflow totals from all enquiries</p></div></div><div className="simple-chart"><svg viewBox="0 0 700 220" aria-label="Marketing workflow overview"><polyline points="0,180 70,155 140,165 210,110 280,140 350,95 420,125 490,80 560,105 630,45 700,60" className="chart-line-blue"/><polyline points="0,200 70,180 140,190 210,150 280,170 350,130 420,155 490,115 560,140 630,85 700,95" className="chart-line-red"/></svg></div></article><article className="dashboard-panel"><div className="dashboard-panel-header"><div><h2>Quotation Status</h2><p>Current finalized quotations</p></div></div><div className="donut-section"><div className="donut-chart"><div className="donut-center"><strong>{Number(summary.quotationCount || 0).toLocaleString("en-IN")}</strong><span>Finalized</span></div></div></div></article></section>
  </div>;
}
