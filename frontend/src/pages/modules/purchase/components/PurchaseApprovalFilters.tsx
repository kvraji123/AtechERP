import type { ReactNode } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { PurchaseApprovalRequest } from "../types";

export type ApprovalFilters = {
  status: string;
  search: string;
  plant: string;
  department: string;
  priority: string;
  supplier: string;
};

export type ApprovalSupplierOption = { id: string; label: string };

type PurchaseApprovalFiltersProps = { pagination?: ReactNode; 
  value: ApprovalFilters;
  requests: PurchaseApprovalRequest[];
  suppliers: ApprovalSupplierOption[];
  departments: Array<{ departmentCode: string; departmentName: string }>;
  onChange: (value: ApprovalFilters) => void;
  onRefresh: () => void;
};

export default function PurchaseApprovalFilters({ pagination,  value, requests, suppliers, departments, onChange, onRefresh }: PurchaseApprovalFiltersProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const update = (key: keyof ApprovalFilters, fieldValue: string) => onChange({ ...value, [key]: fieldValue });
  const suggestions = useMemo(() => {
    const query = value.search.trim().toLowerCase();
    if (!query) return [];
    return requests.filter((request) => request.prNumber.toLowerCase().includes(query)).slice(0, 8);
  }, [requests, value.search]);
  const showPicker = pickerOpen && value.search.trim().length > 0;
  const selectRequest = (request: PurchaseApprovalRequest) => {
    update("search", request.prNumber);
    setPickerOpen(false);
    setActiveIndex(0);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setPickerOpen(false); return; }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setPickerOpen(true); setActiveIndex((current) => (current + 1) % suggestions.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setPickerOpen(true); setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length); }
    if (event.key === "Enter" && showPicker) { event.preventDefault(); selectRequest(suggestions[Math.min(activeIndex, suggestions.length - 1)]); }
  };

  return (
    <div className="purchase-approval-filters app-list-toolbar">
      <div className="purchase-search-picker purchase-approval-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPickerOpen(false); }}>
        <Search size={16} />
        <input role="combobox" aria-autocomplete="list" aria-expanded={showPicker} aria-controls="approval-pr-search-suggestions" value={value.search} onFocus={() => setPickerOpen(true)} onChange={(event) => { update("search", event.target.value); setPickerOpen(true); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="Type PR number" aria-label="Search and select PR number" />
        {showPicker && <div id="approval-pr-search-suggestions" className="purchase-search-picker-menu" role="listbox">{suggestions.length ? suggestions.map((request, index) => <button key={request.id} type="button" role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "active" : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectRequest(request)}><span className="purchase-search-picker-icon pr"><FileText size={15} /></span><span><strong>{request.prNumber}</strong><small>{request.requestedBy} · {request.department} · {request.itemCount} {request.itemCount === 1 ? "item" : "items"}</small></span><em>PR Number</em></button>) : <div className="purchase-search-picker-empty">No matching PR numbers found.</div>}</div>}
      </div>
      <select value={value.plant} onChange={(event) => update("plant", event.target.value)} aria-label="Filter by plant">
        <option value="ALL">All Plants</option><option>Plant 1</option><option>Plant 2</option><option>Plant 3</option>
      </select>
      <select value={value.department} onChange={(event) => update("department", event.target.value)} aria-label="Filter by department">
        <option value="ALL">All Departments</option>{departments.map((department) => <option key={department.departmentCode} value={department.departmentName}>{department.departmentName}</option>)}
      </select>
      <select value={value.supplier} onChange={(event) => update("supplier", event.target.value)} aria-label="Filter by preferred supplier">
        <option value="ALL">All Preferred Suppliers</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.label}</option>)}
      </select>
      <select value={value.status} onChange={(event) => update("status", event.target.value)} aria-label="Filter by approval status">
        <option value="ALL">All Queue Statuses</option><option value="PENDING">Pending Approval</option><option value="RETURNED">Returned</option>
      </select>
      <select value={value.priority} onChange={(event) => update("priority", event.target.value)} aria-label="Filter by priority">
        <option value="ALL">All Priorities</option><option>Low</option><option>Medium</option><option>High</option>
      </select>
      <button type="button" className="purchase-secondary-button purchase-approval-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
    {pagination}</div>
  );
}
