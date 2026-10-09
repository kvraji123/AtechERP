import { ClipboardList, PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { GateEntryStatus } from "../gateEntryData";

type Props = { summary: { total?: number; gateEntered?: number; grnCreated?: number; stockPosted?: number }; status: "ALL" | GateEntryStatus; onStatusChange: (status: "ALL" | GateEntryStatus) => void };

export default function GateEntryDashboard({ summary, status, onStatusChange }: Props) {
  const cards = [
    { id: "ALL" as const, label: "Total Gate Entries", value: Number(summary.total || 0), note: "All inward vehicle records", icon: <ClipboardList size={18} />, tone: "all" },
    { id: "GATE_ENTERED" as const, label: "Awaiting GRN", value: Number(summary.gateEntered || 0), note: "Material entered at gate", icon: <Truck size={18} />, tone: "pending" },
    { id: "GRN_CREATED" as const, label: "GRN Created", value: Number(summary.grnCreated || 0), note: "Receiving completed", icon: <PackageCheck size={18} />, tone: "approved" },
    { id: "STOCK_POSTED" as const, label: "Stock Posted", value: Number(summary.stockPosted || 0), note: "Moved to inventory", icon: <PackageOpen size={18} />, tone: "stock" },
  ];
  return <section className="purchase-gate-dashboard">{cards.map((card) => <button type="button" key={card.id} className={`${card.tone} ${status === card.id ? "active" : ""}`} onClick={() => onStatusChange(card.id)}><span>{card.icon}</span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div></button>)}</section>;
}
