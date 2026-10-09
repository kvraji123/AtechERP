import DateInput from "../../../../components/DateInput";
import { CheckCheck, ListChecks, MessageSquareWarning } from "lucide-react";

export type ApprovalLineStatus = "PENDING" | "APPROVED" | "NOT_APPROVED" | "CLARIFICATION";

export type ApprovalFeasibilityLine = {
  id: number;
  itemType: string;
  group: string;
  description: string;
  specification: string;
  quantity: number;
  uom: string;
  purpose: string;
  amount: number;
  selected: boolean;
  status: ApprovalLineStatus;
  approvedQuantity: number | "";
  requiredDate: string;
  reason: string;
  locked?: boolean;
};

type Props = {
  lines: ApprovalFeasibilityLine[];
  money: Intl.NumberFormat;
  onChange: (lines: ApprovalFeasibilityLine[]) => void;
};

export default function PurchaseApprovalLineFeasibility({ lines, money, onChange }: Props) {
  const selectedCount = lines.filter((line) => line.selected).length;
  const approvedCount = lines.filter((line) => line.status === "APPROVED").length;
  const pendingCount = lines.filter((line) => line.status === "PENDING").length;
  const selectableLines = lines.filter((line) => !line.locked);
  const allSelected = Boolean(selectableLines.length) && selectableLines.every((line) => line.selected);

  const patchLine = (id: number, patch: Partial<ApprovalFeasibilityLine>) => {
    onChange(lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  const applyBulkDecision = (status: "APPROVED" | "CLARIFICATION") => {
    onChange(lines.map((line) => {
      if (line.locked || !line.selected) return line;
      return status === "APPROVED"
        ? { ...line, status, approvedQuantity: line.approvedQuantity || line.quantity }
        : { ...line, status, approvedQuantity: "" };
    }));
  };

  return (
    <section className="purchase-line-feasibility">
      <header>
        <div className="purchase-line-feasibility-title"><ListChecks size={17} /><div><h3>Line-item Status</h3><p>Approve, not approve or request clarification independently for each requested item.</p></div></div>
        <div className="purchase-line-feasibility-counts"><span>Items <strong>{lines.length}</strong></span><span>Approved <strong>{approvedCount}</strong></span><span>Pending <strong>{pendingCount}</strong></span></div>
      </header>

      <div className="purchase-line-feasibility-toolbar">
        <label><input type="checkbox" checked={allSelected} onChange={(event) => onChange(lines.map((line) => line.locked ? line : ({ ...line, selected: event.target.checked })))} /> Select editable line items</label>
        <div>
          <button type="button" className="purchase-secondary-button" disabled={!selectedCount} onClick={() => applyBulkDecision("APPROVED")}><CheckCheck size={14} /> Mark Selected Approved</button>
          <button type="button" className="purchase-secondary-button" disabled={!selectedCount} onClick={() => applyBulkDecision("CLARIFICATION")}><MessageSquareWarning size={14} /> Request Clarification</button>
        </div>
      </div>

      <div className="purchase-approval-detail-table-wrap">
        <table className="purchase-approval-detail-table purchase-line-feasibility-table">
          <thead><tr><th></th><th>#</th><th>Item Type</th><th>Description / Specification</th><th>Requested Qty</th><th>Purpose</th><th>Estimated Amount</th><th>Status *</th><th>Approved Qty *</th><th>Required Date</th><th>Reason / Comment<small>Required for correction or rejection only</small></th></tr></thead>
          <tbody>{lines.map((line, index) => <tr key={line.id}>
            <td><input type="checkbox" checked={line.selected} disabled={line.locked} aria-label={`Select ${line.itemType}`} onChange={(event) => patchLine(line.id, { selected: event.target.checked })} /></td>
            <td>{index + 1}</td>
            <td><strong>{line.itemType}</strong><small>{line.group}</small></td>
            <td><strong>{line.description}</strong><small>{line.specification}</small></td>
            <td>{line.quantity} {line.uom}</td>
            <td>{line.purpose}</td>
            <td>{money.format(line.amount)}</td>
            <td><select value={line.status} disabled={line.locked} onChange={(event) => { const status = event.target.value as ApprovalLineStatus; patchLine(line.id, { status, approvedQuantity: status === "APPROVED" ? line.approvedQuantity || line.quantity : "" }); }}><option value="PENDING">Select status</option><option value="APPROVED">Approved</option><option value="NOT_APPROVED">Not Approved</option><option value="CLARIFICATION">Clarification</option></select></td>
            <td><input type="number" min="0" max={line.quantity} step="1" inputMode="numeric" disabled={line.locked || line.status !== "APPROVED"} value={line.approvedQuantity} onChange={(event) => patchLine(line.id, { approvedQuantity: event.target.value === "" ? "" : Math.trunc(Number(event.target.value)) })} /></td>
            <td><DateInput type="date" value={line.requiredDate} disabled={line.locked} onChange={(event) => patchLine(line.id, { requiredDate: event.target.value })} /></td>
            <td><input value={line.reason} disabled={line.locked} aria-label={`Reason for ${line.itemType}`} aria-required={line.status === "NOT_APPROVED" || line.status === "CLARIFICATION"} placeholder={line.status === "NOT_APPROVED" || line.status === "CLARIFICATION" ? "Reason required" : "Optional comment"} onChange={(event) => patchLine(line.id, { reason: event.target.value })} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
