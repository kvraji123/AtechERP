import { CircleX, ClipboardList, Clock3, PackageCheck, PackagePlus, PackageSearch, ScanSearch } from "lucide-react";
import type { GrnListFilter } from "../grnData";

type Props = { summary: { total?: number; pendingGrnCreation?: number; pendingPoReceiptLines?: number; pendingPoReceiptOrders?: number; inspectionPending?: number; readyForStock?: number; stockPosted?: number; rejectedInspection?: number }; status: GrnListFilter; onStatusChange: (status: GrnListFilter) => void; onCreateGrn: () => void };

export default function GrnDashboard({ summary, status, onStatusChange, onCreateGrn }: Props) {
  const cards = [
    { id: "ALL" as const, label: "Total GRNs", value: Number(summary.total || 0), note: "All receipt records", icon: <ClipboardList size={18} />, tone: "all" },
    { id: "PENDING_GRN_CREATION" as const, label: "Pending GRN Creation", value: Number(summary.pendingGrnCreation || 0), note: "Select an eligible Gate Entry to create GRN Inward", icon: <PackagePlus size={18} />, tone: "ready" },
    { id: "PENDING_PO_RECEIPTS" as const, label: "Pending PO Receipts", value: Number(summary.pendingPoReceiptLines || 0), note: `${Number(summary.pendingPoReceiptOrders || 0)} PO(s) with items pending`, icon: <PackageSearch size={18} />, tone: "pending" },
    { id: "INSPECTION_PENDING" as const, label: "Inspection Pending", value: Number(summary.inspectionPending || 0), note: "Quality decision required", icon: <ScanSearch size={18} />, tone: "pending" },
    { id: "READY_FOR_STOCK" as const, label: "Ready for Stock", value: Number(summary.readyForStock || 0), note: "Accepted quantity pending", icon: <Clock3 size={18} />, tone: "ready" },
    { id: "STOCK_POSTED" as const, label: "Stock Posted", value: Number(summary.stockPosted || 0), note: "Inventory updated", icon: <PackageCheck size={18} />, tone: "approved" },
    { id: "REJECTED_INSPECTION" as const, label: "Rejected Inspection", value: Number(summary.rejectedInspection || 0), note: "View rejected stock", icon: <CircleX size={18} />, tone: "rejected" },
  ];
  return <section className="purchase-grn-dashboard">{cards.map((card) => <button type="button" key={card.id} className={`${card.tone} ${status === card.id ? "active" : ""}`} onClick={() => card.id === "PENDING_GRN_CREATION" ? onCreateGrn() : onStatusChange(card.id)}><span>{card.icon}</span><div><small>{card.label}</small><strong>{card.value}</strong><em>{card.note}</em></div></button>)}</section>;
}
