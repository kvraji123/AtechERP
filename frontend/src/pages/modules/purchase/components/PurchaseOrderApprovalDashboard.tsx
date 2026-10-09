import { CheckCircle2, Files } from "lucide-react";
import PendingApprovalStampIcon from "./PendingApprovalStampIcon";

type PurchaseOrderApprovalDashboardProps = {
  summary: { total: { count: number; value: number }; pending: { count: number; value: number }; approved: { count: number; value: number } };
  status: string;
  onStatusChange: (status: string) => void;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PurchaseOrderApprovalDashboard({ summary, status, onStatusChange }: PurchaseOrderApprovalDashboardProps) {
  const cards = [
    { id: "ALL", label: "Total POs", value: summary.total.count, note: `${money.format(summary.total.value)} total value`, icon: <Files size={18} />, tone: "all" },
    { id: "SUBMITTED", label: "Pending Approval", value: summary.pending.count, note: `${money.format(summary.pending.value)} awaiting action`, icon: <PendingApprovalStampIcon size={24} />, tone: "pending" },
    { id: "APPROVED", label: "Approved POs", value: summary.approved.count, note: `${money.format(summary.approved.value)} approved value`, icon: <CheckCircle2 size={18} />, tone: "approved" },
  ];
  return <section className="purchase-po-approval-dashboard">{cards.map((card) => <button type="button" key={card.id} className={`${card.tone} ${status === card.id ? "active" : ""}`} onClick={() => onStatusChange(card.id)}><span>{card.icon}</span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div></button>)}</section>;
}
