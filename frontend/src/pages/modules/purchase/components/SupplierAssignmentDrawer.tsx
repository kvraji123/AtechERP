import { Check, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SupplierOption } from "../types";

type SupplierAssignmentDrawerProps = {
  open: boolean;
  itemName: string;
  suppliers: SupplierOption[];
  selectedSupplierIds: string[];
  onClose: () => void;
  onApply: (supplierIds: string[]) => void;
};

export default function SupplierAssignmentDrawer({
  open,
  itemName,
  suppliers,
  selectedSupplierIds,
  onClose,
  onApply,
}: SupplierAssignmentDrawerProps) {
  const [selected, setSelected] = useState<string[]>(selectedSupplierIds);

  useEffect(() => setSelected(selectedSupplierIds), [selectedSupplierIds, open]);

  if (!open) return null;

  const toggleSupplier = (supplierId: string) => {
    setSelected((current) => current.includes(supplierId)
      ? current.filter((id) => id !== supplierId)
      : [...current, supplierId]);
  };

  return (
    <div className="purchase-drawer-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="purchase-supplier-drawer" role="dialog" aria-modal="true" aria-labelledby="supplier-drawer-title">
        <header>
          <div><p>Supplier Assignment</p><h2 id="supplier-drawer-title">{itemName}</h2><span>Select one or more approved suppliers for this item.</span></div>
          <button type="button" aria-label="Close supplier assignment" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="purchase-supplier-list">
          {suppliers.map((supplier) => {
            const checked = selected.includes(supplier.id);
            return (
              <label key={supplier.id} className={checked ? "selected" : ""}>
                <input type="checkbox" checked={checked} onChange={() => toggleSupplier(supplier.id)} />
                <span className="purchase-supplier-check">{checked && <Check size={14} />}</span>
                <div>
                  <strong>{supplier.name}</strong>
                  <small>{supplier.code} · Lead time {supplier.leadTime}</small>
                </div>
                <span className="purchase-supplier-rating"><Star size={14} fill="currentColor" /> {supplier.rating}</span>
              </label>
            );
          })}
          {!suppliers.length && <p className="purchase-rfq-empty">No active suppliers are available in Supplier Master.</p>}
        </div>

        <footer>
          <button type="button" className="purchase-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="purchase-primary-button" disabled={!selected.length} onClick={() => onApply(selected)}>
            Apply {selected.length ? `${selected.length} Supplier${selected.length > 1 ? "s" : ""}` : "Suppliers"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
