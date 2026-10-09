import { CircleX, ClipboardList, Clock3, PackageCheck, ScanSearch } from "lucide-react";
import type { GrnListFilter } from "../grnData";

type Props = { summary: { total?: number; inspectionPending?: number; readyForStock?: number; stockPosted?: number; rejectedInspection?: number }; status: GrnListFilter; onStatusChange: (status: GrnListFilter) => void };

export default function GrnDashboard({ summary, status, onStatusChange }: Props) {
  const cards = [
    { id: "ALL" as const, label: "Total GRNs", value: Number(summary.total || 0), note: "All receipt records", icon: <ClipboardList size={18} />, tone: "all" },
    { id: "INSPECTION_PENDING" as const, label: "Inspection Pending", value: Number(summary.inspectionPending || 0), note: "Quality decision required", icon: <ScanSearch size={18} />, tone: "pending" },
    { id: "READY_FOR_STOCK" as const, label: "Ready for Stock", value: Number(summary.readyForStock || 0), note: "Accepted quantity pending", icon: <Clock3 size={18} />, tone: "ready" },
    { id: "STOCK_POSTED" as const, label: "Stock Posted", value: Number(summary.stockPosted || 0), note: "Inventory updated", icon: <PackageCheck size={18} />, tone: "approved" },
    { id: "REJECTED_INSPECTION" as const, label: "Rejected Inspection", value: Number(summary.rejectedInspection || 0), note: "View rejected stock", icon: <CircleX size={18} />, tone: "rejected" },
  ];
  return <section className="purchase-grn-dashboard">{cards.map((card) => <button type="button" key={card.id} className={`${card.tone} ${status === card.id ? "active" : ""}`} onClick={() => onStatusChange(card.id)}><span>{card.icon}</span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div></button>)}</section>;
}
