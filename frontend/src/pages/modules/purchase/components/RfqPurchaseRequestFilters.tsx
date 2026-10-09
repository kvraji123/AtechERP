import type { ReactNode } from "react";
import { FileText, PackageSearch, RefreshCw, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { RfqPurchaseRequest } from "../purchaseRfqRequests";

type Props = { pagination?: ReactNode;  requests: RfqPurchaseRequest[]; search: string; status: string; department: string; priority: string; onSearchChange: (value: string) => void; onStatusChange: (value: string) => void; onDepartmentChange: (value: string) => void; onPriorityChange: (value: string) => void; onRefresh: () => void };

type SearchSuggestion = {
  id: string;
  kind: "PR" | "ITEM";
  label: string;
  detail: string;
};

function getSearchSuggestions(requests: RfqPurchaseRequest[], search: string): SearchSuggestion[] {
  const query = search.trim().toLowerCase();
  if (!query) return [];

  const prSuggestions: SearchSuggestion[] = requests
    .filter((request) => request.prNumber.toLowerCase().includes(query))
    .map((request) => ({
      id: `pr-${request.id}`,
      kind: "PR",
      label: request.prNumber,
      detail: `${request.requestedBy} · ${request.department} · ${request.itemCount} approved ${request.itemCount === 1 ? "item" : "items"}`,
    }));

  const items = new Map<string, { label: string; prNumbers: Set<string> }>();
  requests.forEach((request) => {
    request.itemSummary
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const key = item.toLowerCase();
        const existing = items.get(key) ?? { label: item, prNumbers: new Set<string>() };
        existing.prNumbers.add(request.prNumber);
        items.set(key, existing);
      });
  });

  const itemSuggestions: SearchSuggestion[] = Array.from(items.entries())
    .filter(([key]) => key.includes(query))
    .map(([key, item]) => ({
      id: `item-${key}`,
      kind: "ITEM",
      label: item.label,
      detail: `${item.prNumbers.size} matching purchase ${item.prNumbers.size === 1 ? "request" : "requests"}`,
    }));

  return [...prSuggestions, ...itemSuggestions].slice(0, 8);
}

export default function RfqPurchaseRequestFilters({ pagination,  requests, search, status, department, priority, onSearchChange, onStatusChange, onDepartmentChange, onPriorityChange, onRefresh }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => getSearchSuggestions(requests, search), [requests, search]);
  const showPicker = pickerOpen && search.trim().length > 0;

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    onSearchChange(suggestion.label);
    setPickerOpen(false);
    setActiveIndex(0);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setPickerOpen(false);
      return;
    }

    if (!suggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPickerOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setPickerOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && showPicker) {
      event.preventDefault();
      selectSuggestion(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    }
  };

  return <div className="purchase-rfq-pr-filters app-list-toolbar"><div className="purchase-search-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPickerOpen(false); }}><label className="purchase-input-with-icon"><Search size={15} /><input role="combobox" aria-autocomplete="list" aria-expanded={showPicker} aria-controls="rfq-pr-search-suggestions" value={search} onFocus={() => setPickerOpen(true)} onChange={(event) => { onSearchChange(event.target.value); setPickerOpen(true); setActiveIndex(0); }} onKeyDown={handleSearchKeyDown} placeholder="Type PR number or item" /></label>{showPicker && <div id="rfq-pr-search-suggestions" className="purchase-search-picker-menu" role="listbox">{suggestions.length ? suggestions.map((suggestion, index) => <button key={suggestion.id} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectSuggestion(suggestion)}><span className={`purchase-search-picker-icon ${suggestion.kind.toLowerCase()}`}>{suggestion.kind === "PR" ? <FileText size={15} /> : <PackageSearch size={15} />}</span><span><strong>{suggestion.label}</strong><small>{suggestion.detail}</small></span><em>{suggestion.kind === "PR" ? "PR Number" : "Item"}</em></button>) : <div className="purchase-search-picker-empty">No matching PR numbers or items found.</div>}</div>}</div><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="ALL">All statuses</option><option value="PENDING">Pending Approval</option><option value="APPROVED">Approved for RFQ</option><option value="PARTIALLY_APPROVED">Partially Approved</option></select><select value={department} onChange={(event) => onDepartmentChange(event.target.value)}><option value="ALL">All departments</option><option>Production — Assembly</option><option>Maintenance</option><option>Machine Shop</option><option>Quality</option></select><select value={priority} onChange={(event) => onPriorityChange(event.target.value)}><option value="ALL">All priorities</option><option>Low</option><option>Medium</option><option>High</option></select><button type="button" className="purchase-secondary-button purchase-list-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>{pagination}</div>;
}
