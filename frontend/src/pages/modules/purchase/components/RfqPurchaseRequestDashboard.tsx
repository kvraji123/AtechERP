import { CheckCircle2, Files } from "lucide-react";
import PendingApprovalStampIcon from "./PendingApprovalStampIcon";

type Props = { summary: { total?: number; pending?: number; rfqEligible?: number }; status: string; onStatusChange: (status: string) => void };

export default function RfqPurchaseRequestDashboard({ summary, status, onStatusChange }: Props) {
  const cards = [{ id: "ALL", label: "Total Purchase Requests", value: Number(summary.total || 0), note: "Across Coimbatore departments", icon: <Files size={18} />, tone: "all" }, { id: "PENDING", label: "Pending Approval", value: Number(summary.pending || 0), note: "Not available for RFQ yet", icon: <PendingApprovalStampIcon size={24} />, tone: "pending" }, { id: "APPROVED", label: "Approved for RFQ", value: Number(summary.rfqEligible || 0), note: "Includes partially approved PRs", icon: <CheckCircle2 size={18} />, tone: "approved" }];
  return <section className="purchase-rfq-pr-dashboard">{cards.map((card) => <button type="button" key={card.id} className={`${card.tone} ${status === card.id ? "active" : ""}`} onClick={() => onStatusChange(card.id)}><span>{card.icon}</span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div></button>)}</section>;
}
