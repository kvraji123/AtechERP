import { BellRing, Eye, FileText } from "lucide-react";
import type { RfqTrackingRecord } from "../rfqTrackingData";

type Props = {
  records: RfqTrackingRecord[];
  onView: (record: RfqTrackingRecord) => void;
  onRemind: (record: RfqTrackingRecord) => void;
  onQuotation: (record: RfqTrackingRecord) => void;
};

const statusText = { AWAITING_RESPONSE: "Awaiting Response", PARTIAL_RESPONSE: "Partial Response", QUOTES_RECEIVED: "Quotes Received", OVERDUE: "Overdue" };
const quotationActionText = (record: RfqTrackingRecord) => record.status === "QUOTES_RECEIVED" ? "View / Edit Quotation" : record.status === "PARTIAL_RESPONSE" ? "Continue Quotation" : "Add Quotation";

function groupByPurchaseEnquiry(records: RfqTrackingRecord[]) {
  const groups = new Map<number, RfqTrackingRecord[]>();
  records.forEach((record) => {
    const group = groups.get(record.enquiryId) ?? [];
    group.push(record);
    groups.set(record.enquiryId, group);
  });
  return [...groups.entries()];
}

export default function RfqTrackingTable({ records, onView, onRemind, onQuotation }: Props) {
  const groups = groupByPurchaseEnquiry(records);

  return <div className="purchase-rfq-tracking-table-wrap purchase-rfq-tracking-list-table-wrap"><table className="purchase-rfq-tracking-table"><thead><tr><th>RFQ / Purchase Enquiry No.</th><th>Purchase Request</th><th>Supplier</th><th>Items</th><th>Sent Date</th><th>Due Date</th><th>Response</th><th>Status</th><th>Action</th></tr></thead>{groups.length ? groups.map(([enquiryId, enquiryRecords]) => <tbody className="purchase-rfq-enquiry-row-group" key={enquiryId}>{enquiryRecords.map((record) => <tr key={record.id}><td><strong>{record.rfqNumber}</strong><small>{record.revision}</small></td><td><strong>{record.prNumbers}</strong></td><td><strong>{record.supplierName}</strong><small>{record.supplierCode}</small></td><td>{record.itemCount}</td><td>{record.sentDate}</td><td>{record.dueDate}</td><td>{record.response}</td><td><span className={`purchase-rfq-tracking-status ${record.status.toLowerCase().replace("_", "-")}`}>{statusText[record.status]}</span></td><td><div className="purchase-rfq-tracking-actions"><button type="button" onClick={() => onView(record)}><Eye size={14} /> View</button><button type="button" className="quotation" onClick={() => onQuotation(record)}><FileText size={14} /> {quotationActionText(record)}</button>{record.status !== "QUOTES_RECEIVED" && <button type="button" className="remind purchase-rfq-tooltip" aria-label="Remind supplier" data-tooltip="Remind" onClick={() => onRemind(record)}><BellRing size={14} /></button>}</div></td></tr>)}</tbody>) : <tbody><tr><td colSpan={9}><div className="purchase-rfq-tracking-empty">No RFQ records match the selected filters.</div></td></tr></tbody>}</table></div>;
}
