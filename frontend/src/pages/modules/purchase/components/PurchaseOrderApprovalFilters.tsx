import type { ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";

type PurchaseOrderApprovalFiltersProps = { pagination?: ReactNode; 
  suppliers: string[];
  search: string;
  status: string;
  supplier: string;
  dateRange: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onRefresh: () => void;
};

export default function PurchaseOrderApprovalFilters({ pagination,  suppliers, search, status, supplier, dateRange, onSearchChange, onStatusChange, onSupplierChange, onDateRangeChange, onRefresh }: PurchaseOrderApprovalFiltersProps) {
  return <div className="purchase-po-approval-filters app-list-toolbar"><label className="purchase-input-with-icon"><Search size={15} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search PO number, supplier or RFQ" /></label><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="ALL">All statuses</option><option value="SUBMITTED">Pending Approval</option><option value="APPROVED">Approved</option><option value="RETURNED">Returned</option><option value="REJECTED">Rejected</option></select><select value={supplier} onChange={(event) => onSupplierChange(event.target.value)}><option value="ALL">All suppliers</option>{suppliers.map((name) => <option key={name} value={name}>{name.split(" · ")[0]}</option>)}</select><select value={dateRange} onChange={(event) => onDateRangeChange(event.target.value)}><option value="ALL">All PO dates</option><option value="TODAY">Today</option><option value="WEEK">This week</option><option value="MONTH">This month</option></select><button type="button" className="purchase-secondary-button purchase-list-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>{pagination}</div>;
}
