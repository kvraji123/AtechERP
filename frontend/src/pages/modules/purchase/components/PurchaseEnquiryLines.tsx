import { CheckCircle2, UsersRound } from "lucide-react";
import type { PurchaseEnquiryLine } from "../types";

type PurchaseEnquiryLinesProps = {
  lines: PurchaseEnquiryLine[];
  onToggleLine: (id: number) => void;
  onToggleAll: (selected: boolean) => void;
  onAssignSuppliers: (line: PurchaseEnquiryLine) => void;
};

export default function PurchaseEnquiryLines({ lines, onToggleLine, onToggleAll, onAssignSuppliers }: PurchaseEnquiryLinesProps) {
  const selectableLines = lines.filter((line) => line.enquiryRequired);
  const allSelected = selectableLines.length > 0 && selectableLines.every((line) => line.selected);

  return (
    <div className="purchase-enquiry-table-wrap">
      <table className="purchase-enquiry-table">
        <thead>
          <tr>
            <th><input type="checkbox" aria-label="Select all eligible items" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} /></th>
            <th>S.No</th>
            <th>Purchase Req. No</th>
            <th>Item</th>
            <th>Assigned Suppliers</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
              <tr key={line.id} className={!line.enquiryRequired ? "purchase-line-muted" : ""}>
                <td><input type="checkbox" aria-label={`Select ${line.itemName}`} disabled={!line.enquiryRequired} checked={line.selected} onChange={() => onToggleLine(line.id)} /></td>
                <td className="purchase-enquiry-index">{index + 1}</td>
                <td><strong>{line.prNumber}</strong><small>{line.requisitionType}</small></td>
                <td><strong>{line.itemName}</strong><small>{line.itemCode} · {line.itemDescription}</small><span className="purchase-quantity-chip">{line.quantity} {line.uom}</span></td>
                <td>
                  {line.enquiryRequired ? (
                    <button type="button" className="purchase-supplier-trigger" onClick={() => onAssignSuppliers(line)}>
                      <UsersRound size={16} /><span>{line.selectedSupplierIds.length ? `${line.selectedSupplierIds.length} suppliers assigned` : "Assign suppliers"}</span>
                    </button>
                  ) : <span className="purchase-bypass-badge"><CheckCircle2 size={14} /> Rate contract available</span>}
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
