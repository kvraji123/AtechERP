import { ArrowRight, Circle, ClipboardList, Clock3, Siren } from "lucide-react";
import type { ReactNode } from "react";

export type PurchaseAttentionRecord = {
  id: string;
  reference: string;
  requester: string;
  submittedDate: string;
  department: string;
  plant: string;
  itemCount: number;
  requiredDate: string;
  priority: "Low" | "Medium" | "High";
  route: string;
};

type PurchaseAttentionListProps = {
  records: PurchaseAttentionRecord[];
  onOpen: (route: string) => void;
  action?: ReactNode;
};

export default function PurchaseAttentionList({ records, onOpen, action }: PurchaseAttentionListProps) {
  return (
    <section className="purchase-command-panel purchase-command-attention">
      <header>
        <div className="purchase-command-attention-title"><span><ClipboardList size={17} /></span><div><h2>Needs Your Attention</h2><p>Pending purchase requests received from departments</p></div></div>
        <div className="purchase-command-panel-actions"><span><strong>{records.length}</strong> pending requests</span>{action}</div>
      </header>
      <div className="purchase-command-attention-table-wrap">
        <table className="purchase-command-attention-table">
          <thead><tr><th>PR Number / Requester</th><th>Department</th><th>Items</th><th>Required Date</th><th>Priority</th><th>Action</th></tr></thead>
          <tbody>{records.map((record) => (
            <tr key={record.id} className={record.priority.toLowerCase()}>
              <td><strong>{record.reference}</strong><small>{record.requester} · {record.submittedDate}</small></td>
              <td><strong>{record.department}</strong><small>{record.plant}</small></td>
              <td><span className="purchase-command-item-count">{record.itemCount}</span></td>
              <td><strong>{record.requiredDate}</strong><small>{record.priority === "High" ? "Due soon" : "Required date"}</small></td>
              <td><span className={`purchase-command-priority ${record.priority.toLowerCase()}`}>{record.priority === "High" ? <Siren size={14} /> : record.priority === "Medium" ? <Clock3 size={14} /> : <Circle size={12} />}{record.priority}</span></td>
              <td><button type="button" className="purchase-command-review-button" onClick={() => onOpen(record.route)}>Review PR <ArrowRight size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
