import type { ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";
import type { RfqTrackingStatus } from "../rfqTrackingData";

type Props = { pagination?: ReactNode; 
  suppliers: string[];
  search: string;
  status: "ALL" | RfqTrackingStatus;
  supplier: string;
  dueDate: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "ALL" | RfqTrackingStatus) => void;
  onSupplierChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onRefresh: () => void;
};

export default function RfqTrackingFilters({ pagination,  suppliers, search, status, supplier, dueDate, onSearchChange, onStatusChange, onSupplierChange, onDueDateChange, onRefresh }: Props) {
  return <div className="purchase-rfq-tracking-filters app-list-toolbar"><label className="purchase-input-with-icon"><Search size={15} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search RFQ, PR, enquiry or supplier" aria-label="Search RFQ records" /></label><select value={status} onChange={(event) => onStatusChange(event.target.value as "ALL" | RfqTrackingStatus)} aria-label="Filter by RFQ status"><option value="ALL">All statuses</option><option value="AWAITING_RESPONSE">Awaiting response</option><option value="PARTIAL_RESPONSE">Partial response</option><option value="QUOTES_RECEIVED">Quotes received</option><option value="OVERDUE">Overdue</option></select><select value={supplier} onChange={(event) => onSupplierChange(event.target.value)} aria-label="Filter by supplier"><option value="ALL">All suppliers</option>{suppliers.map((name) => <option key={name} value={name}>{name}</option>)}</select><select value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} aria-label="Filter by due date"><option value="ALL">All due dates</option><option value="TODAY">Due today</option><option value="OVERDUE">Overdue</option><option value="WEEK">This week</option></select><button type="button" className="purchase-secondary-button purchase-list-refresh" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>{pagination}</div>;
}
