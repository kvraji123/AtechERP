import { CheckCircle2, Search, UserCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { RfqPurchaseRequest } from "../purchaseRfqRequests";
import type { PurchaseEnquiryLine, SupplierOption } from "../types";

type Props = {
  lines: PurchaseEnquiryLine[];
  requests: RfqPurchaseRequest[];
  suppliers: SupplierOption[];
  onChange: (lines: PurchaseEnquiryLine[]) => void;
  onAssign: (lines: PurchaseEnquiryLine[]) => Promise<boolean>;
  saving?: boolean;
  onOpenItemFirst: () => void;
};

export default function SupplierFirstAssignment({ lines, requests, suppliers, onChange, onAssign, saving = false, onOpenItemFirst }: Props) {
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(() => new Set());
  const [supplierSearch, setSupplierSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [prStatus, setPrStatus] = useState("ALL");
  const [draftLineIds, setDraftLineIds] = useState<Set<number>>(() => new Set());
  const selectedSuppliers = suppliers.filter((entry) => selectedSupplierIds.has(entry.id));
  const supplierOptionsKey = suppliers.map((entry) => entry.id).join("|");
  const selectedSupplierKey = selectedSuppliers.map((entry) => entry.id).sort().join("|");
  const requestByNumber = new Map(requests.map((request) => [request.prNumber, request]));
  const visibleSuppliers = suppliers.filter((entry) => `${entry.name} ${entry.code}`.toLowerCase().includes(supplierSearch.trim().toLowerCase()));
  const visibleLines = useMemo(() => lines.filter((line) => {
    const request = requestByNumber.get(line.prNumber);
    const query = itemSearch.trim().toLowerCase();
    return line.enquiryRequired && (!query || `${line.prNumber} ${line.itemCode} ${line.itemName}`.toLowerCase().includes(query)) && (prStatus === "ALL" || request?.status === prStatus);
  }), [itemSearch, lines, prStatus, requests]);
  useEffect(() => {
    if (!suppliers.length) return;
    setSelectedSupplierIds((current) => {
      const available = new Set(suppliers.map((entry) => entry.id));
      const retained = new Set([...current].filter((id) => available.has(id)));
      return retained.size ? retained : new Set([suppliers[0].id]);
    });
  }, [supplierOptionsKey]);
  useEffect(() => {
    const ids = new Set(selectedSuppliers.map((entry) => entry.id));
    setDraftLineIds(new Set(lines.filter((line) => line.selectedSupplierIds.some((id) => ids.has(id))).map((line) => line.id)));
  }, [selectedSupplierKey]);
  const assignedVisible = visibleLines.filter((line) => draftLineIds.has(line.id));
  const allAssigned = Boolean(visibleLines.length) && assignedVisible.length === visibleLines.length;

  const toggleLine = (id: number, assigned: boolean) => setDraftLineIds((current) => { const next = new Set(current); if (assigned) next.add(id); else next.delete(id); return next; });
  const toggleAll = (assigned: boolean) => setDraftLineIds((current) => { const next = new Set(current); visibleLines.forEach((line) => assigned ? next.add(line.id) : next.delete(line.id)); return next; });
  const toggleSupplier = (supplierId: string, selected: boolean) => setSelectedSupplierIds((current) => { const next = new Set(current); if (selected) next.add(supplierId); else next.delete(supplierId); return next; });
  const applyAssignment = async () => {
    const visibleIds = new Set(visibleLines.map((line) => line.id));
    const selectedIds = new Set(selectedSuppliers.map((entry) => entry.id));
    const existingAssignmentCount = visibleLines
      .filter((line) => draftLineIds.has(line.id))
      .reduce((count, line) => count + line.selectedSupplierIds.filter((supplierId) => selectedIds.has(supplierId)).length, 0);
    if (existingAssignmentCount && !window.confirm(`${existingAssignmentCount} selected item${existingAssignmentCount === 1 ? " is" : "s are"} already assigned to the selected supplier${selectedSuppliers.length === 1 ? "" : "s"}. Continue to update the existing assignment${existingAssignmentCount === 1 ? "" : "s"}?`)) return;
    const nextLines = lines.map((line) => !visibleIds.has(line.id) ? line : {
      ...line,
      selected: draftLineIds.has(line.id) || line.selected,
      selectedSupplierIds: draftLineIds.has(line.id)
        ? Array.from(new Set([...line.selectedSupplierIds, ...selectedIds]))
        : line.selectedSupplierIds.filter((id) => !selectedIds.has(id)),
    });
    if (await onAssign(nextLines)) onChange(nextLines);
  };
  const supplierHeading = selectedSuppliers.length === 1 ? selectedSuppliers[0].name : selectedSuppliers.length ? `${selectedSuppliers.length} selected suppliers` : "selected suppliers";

  return <section className="purchase-supplier-assignment-page-section">
    <header><div className="purchase-supplier-assignment-title"><span><UsersRound size={18} /></span><div><h2>Supplier Assignment</h2><p>Select one or more suppliers, then assign approved PR line items in bulk.</p></div></div><strong>{lines.filter((line) => line.enquiryRequired).length} eligible lines from {new Set(lines.map((line) => line.prNumber)).size} PRs</strong></header>
    <div className="purchase-supplier-assignment-tabs"><button type="button" className="active">Supplier → Items</button><button type="button" onClick={onOpenItemFirst}>Items → Suppliers</button></div>
    <div className="purchase-supplier-assignment-layout">
      <aside><div className="purchase-supplier-assignment-side-head"><h3>Approved Suppliers</h3><p>Select one or more suppliers, then choose their RFQ items.</p><label className="purchase-input-with-icon"><Search size={14} /><input value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Search supplier name/code" /></label></div><div className="purchase-supplier-assignment-supplier-list">{visibleSuppliers.map((entry) => { const count = lines.filter((line) => line.selectedSupplierIds.includes(entry.id)).length; const checked = selectedSupplierIds.has(entry.id); return <label key={entry.id} className={`purchase-supplier-option ${checked ? "active" : ""}`}><input type="checkbox" checked={checked} onChange={(event) => toggleSupplier(entry.id, event.target.checked)} aria-label={`Select ${entry.name}`} /><span><strong>{entry.name}</strong><small>{entry.code} · {entry.leadTime}</small><em>{count ? `${count} items assigned` : "No items assigned"}</em></span></label>; })}{!visibleSuppliers.length && <div className="purchase-supplier-assignment-empty">No active suppliers are available in Supplier Master.</div>}</div></aside>
      <main><header><div><h3>Assign items to {supplierHeading}</h3><p>Approved lines from fully and partially approved PRs are included.</p></div><span className="purchase-supplier-approved-badge"><CheckCircle2 size={12} /> {selectedSuppliers.length} Approved {selectedSuppliers.length === 1 ? "Vendor" : "Vendors"}</span></header><div className="purchase-supplier-assignment-filters"><label className="purchase-input-with-icon"><Search size={14} /><input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search item, code or PR number" /></label><select value={prStatus} onChange={(event) => setPrStatus(event.target.value)}><option value="ALL">All PR statuses</option><option value="APPROVED">Approved</option><option value="PARTIALLY_APPROVED">Partially Approved</option></select><select defaultValue="ALL"><option value="ALL">All item groups</option><option>Capital Assets</option><option>Consumables</option><option>Raw Material</option></select></div><div className="purchase-supplier-assignment-select-all"><label><input type="checkbox" checked={allAssigned} onChange={(event) => toggleAll(event.target.checked)} /> Select all eligible line items</label><strong>{assignedVisible.length} of {visibleLines.length} selected</strong></div><div className="purchase-supplier-assignment-table-wrap"><table><thead><tr><th></th><th>PR / Item</th><th>PR Status</th><th>Approved Qty</th><th>Already in RFQ</th><th>RFQ Qty</th></tr></thead><tbody>{visibleLines.map((line) => { const request = requestByNumber.get(line.prNumber); const assigned = draftLineIds.has(line.id); return <tr key={line.id}><td><input type="checkbox" checked={assigned} onChange={(event) => toggleLine(line.id, event.target.checked)} /></td><td><strong>{line.itemName}</strong><small>{line.prNumber} · {line.itemCode}</small></td><td><span className={`purchase-supplier-pr-status ${(request?.status || "APPROVED").toLowerCase().replace(/_/g, "-")}`}>{request?.status === "PARTIALLY_APPROVED" ? "Partially Approved" : "Approved"}</span></td><td>{line.quantity} {line.uom}</td><td>0</td><td><input type="number" min="1" max={line.quantity} step="1" inputMode="numeric" value={line.quantity} onChange={(event) => onChange(lines.map((entry) => entry.id === line.id ? { ...entry, quantity: Number(event.target.value) } : entry))} /></td></tr>; })}</tbody></table>{!visibleLines.length && <div className="purchase-supplier-assignment-empty">No eligible approved lines match the selected filters.</div>}</div><footer><div><UserCheck size={16} /><span><strong>{selectedSuppliers.length} {selectedSuppliers.length === 1 ? "supplier" : "suppliers"} selected</strong><small>{assignedVisible.length} selected {assignedVisible.length === 1 ? "item" : "items"} will be assigned to each supplier</small></span></div><button type="button" className="purchase-primary-button" disabled={saving || !selectedSuppliers.length || !assignedVisible.length} onClick={() => { void applyAssignment(); }}><UserCheck size={14} /> {saving ? "Assigning…" : `Assign to ${selectedSuppliers.length || 0} ${selectedSuppliers.length === 1 ? "Supplier" : "Suppliers"}`}</button></footer></main>
    </div>
  </section>;
}
