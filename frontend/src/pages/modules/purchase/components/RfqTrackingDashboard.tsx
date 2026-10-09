import { Clock3, FileCheck2, Files } from "lucide-react";
import type { RfqTrackingStatus } from "../rfqTrackingData";

type Props = {
  summary: { total?: number; quotesReceived?: number; awaitingResponse?: number };
  activeStatus: "ALL" | RfqTrackingStatus;
  onStatusChange: (status: "ALL" | RfqTrackingStatus) => void;
};

export default function RfqTrackingDashboard({ summary, activeStatus, onStatusChange }: Props) {
  const received = Number(summary.quotesReceived || 0);
  const awaiting = Number(summary.awaitingResponse || 0);
  const cards = [
    { key: "ALL" as const, label: "Total RFQs", value: Number(summary.total || 0), detail: "Supplier-wise RFQ records", icon: Files, tone: "all" },
    { key: "QUOTES_RECEIVED" as const, label: "Quotes Received", value: received, detail: "Received supplier quotations", icon: FileCheck2, tone: "approved" },
    { key: "AWAITING_RESPONSE" as const, label: "Awaiting Response", value: awaiting, detail: "Includes partial and overdue", icon: Clock3, tone: "pending" },
  ];
  return <section className="purchase-rfq-tracking-dashboard" aria-label="RFQ tracking summary">{cards.map((card) => { const Icon = card.icon; const active = card.key === "AWAITING_RESPONSE" ? ["AWAITING_RESPONSE", "PARTIAL_RESPONSE", "OVERDUE"].includes(activeStatus) : activeStatus === card.key; return <button type="button" key={card.key} className={`${card.tone} ${active ? "active" : ""}`} onClick={() => onStatusChange(card.key)}><span><Icon size={17} /></span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.detail}</em></div></button>; })}</section>;
}
