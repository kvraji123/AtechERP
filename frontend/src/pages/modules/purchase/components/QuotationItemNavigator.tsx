import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileX2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { QuotationComparisonItem } from "../quotationComparisonData";

type ItemStatus = "PENDING" | "SELECTED" | "NO_QUOTE";

type QuotationItemNavigatorProps = {
  items: QuotationComparisonItem[];
  selectedItemId: string;
  confirmedItemIds: string[];
  onSelectItem: (itemId: string) => void;
};

const statusLabel: Record<ItemStatus, string> = { PENDING: "Decision Pending", SELECTED: "Supplier Selected", NO_QUOTE: "No Quotation" };
const priorityOrder = { High: 0, Medium: 1, Low: 2 };
const itemStatus = (item: QuotationComparisonItem, confirmedItemIds: string[]): ItemStatus => item.quotations.length === 0 ? "NO_QUOTE" : confirmedItemIds.includes(item.id) ? "SELECTED" : "PENDING";
const sortableDate = (date: string) => date.split("-").reverse().join("-");

export default function QuotationItemNavigator({ items, selectedItemId, confirmedItemIds, onSelectItem }: QuotationItemNavigatorProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ItemStatus>("ALL");
  const orderedItems = useMemo(() => [...items].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || sortableDate(a.requiredDate).localeCompare(sortableDate(b.requiredDate)) || a.prNumber.localeCompare(b.prNumber) || a.lineNumber - b.lineNumber), [items]);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderedItems.filter((item) => (status === "ALL" || itemStatus(item, confirmedItemIds) === status) && (!query || `${item.itemName} ${item.itemCode} ${item.prNumber}`.toLowerCase().includes(query)));
  }, [confirmedItemIds, orderedItems, search, status]);
  const selectedItem = items.find((item) => item.id === selectedItemId) || items[0];
  const position = visibleItems.findIndex((item) => item.id === selectedItemId);
  const selectedStatus = itemStatus(selectedItem, confirmedItemIds);

  useEffect(() => {
    if (visibleItems.length && position < 0) onSelectItem(visibleItems[0].id);
  }, [onSelectItem, position, visibleItems]);

  const move = (direction: number) => {
    if (!visibleItems.length) return;
    const currentPosition = Math.max(0, position);
    onSelectItem(visibleItems[(currentPosition + direction + visibleItems.length) % visibleItems.length].id);
  };

  return (
    <div className="purchase-comparison-navigator">
      <div className="purchase-comparison-navigator-toolbar">
        <label className="purchase-input-with-icon"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item name, item code or PR number" aria-label="Search items" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value as "ALL" | ItemStatus)} aria-label="Filter items by status"><option value="ALL">All Items</option><option value="PENDING">Decision Pending</option><option value="SELECTED">Supplier Selected</option><option value="NO_QUOTE">No Quotation</option></select>
        <button type="button" aria-label="Previous item" disabled={!visibleItems.length} onClick={() => move(-1)}><ChevronLeft size={16} /></button>
        <label className="purchase-comparison-item-picker"><span>Select item / part</span><select value={visibleItems.length ? selectedItemId : ""} disabled={!visibleItems.length} onChange={(event) => onSelectItem(event.target.value)}>{visibleItems.length ? visibleItems.map((item) => <option key={item.id} value={item.id}>{item.prNumber} · {item.itemName} · {item.quantity} {item.uom} · {statusLabel[itemStatus(item, confirmedItemIds)]}</option>) : <option value="">No matching items</option>}</select></label>
        <button type="button" aria-label="Next item" disabled={!visibleItems.length} onClick={() => move(1)}><ChevronRight size={16} /></button>
        <div className="purchase-comparison-navigator-position">{visibleItems.length ? `Item ${position + 1} of ${visibleItems.length}` : "No matching items"}</div>
      </div>
      <div className="purchase-comparison-selected-item"><div><strong>{selectedItem.itemName}</strong><span>{selectedItem.prNumber} · {selectedItem.itemCode} · {selectedItem.quantity} {selectedItem.uom} · Required by {selectedItem.requiredDate}</span></div><em className={selectedStatus.toLowerCase().replace("_", "-")}>{selectedStatus === "SELECTED" ? <CheckCircle2 size={14} /> : selectedStatus === "NO_QUOTE" ? <FileX2 size={14} /> : <Clock3 size={14} />}{statusLabel[selectedStatus]}</em></div>
    </div>
  );
}
