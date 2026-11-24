import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supplierApi, type SupplierLookupOption } from "../api/supplier.api";

function supplierLabel(supplier: SupplierLookupOption) {
  return `${supplier.supplierCode} - ${supplier.supplierName}`;
}

/**
 * Supplier type-ahead used where an Item Master links a supplier. The lookup
 * intentionally starts at two characters so opening a row never downloads or
 * renders the complete Supplier Master list.
 */
export default function SupplierSearchPicker({
  value,
  selectedLabel,
  onSelect,
  disabled = false,
}: {
  value: string;
  selectedLabel: string;
  onSelect: (supplier: SupplierLookupOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(selectedLabel);
  const [matches, setMatches] = useState<SupplierLookupOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => () => {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
  }, []);

  useEffect(() => {
    const search = query.trim();
    if (!open || search.length < 2) {
      setMatches([]);
      setLoading(false);
      setLookupFailed(false);
      return undefined;
    }

    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLookupFailed(false);
      void supplierApi.lookup(search)
        .then((response) => {
          if (current) setMatches(Array.isArray(response?.data) ? response.data : []);
        })
        .catch(() => {
          if (current) {
            setMatches([]);
            setLookupFailed(true);
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const closeAndRestoreSelection = () => {
    blurTimer.current = window.setTimeout(() => {
      setOpen(false);
      setMatches([]);
      setQuery(selectedLabel);
    }, 120);
  };

  const selectSupplier = (supplier: SupplierLookupOption) => {
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    onSelect(supplier);
    setQuery(supplierLabel(supplier));
    setMatches([]);
    setOpen(false);
  };

  return <div className="supplier-search-picker">
    <Search size={16} aria-hidden="true"/>
    <input
      type="search"
      value={query}
      disabled={disabled}
      autoComplete="off"
      placeholder="Type 2+ letters to search"
      aria-label="Search supplier"
      aria-autocomplete="list"
      aria-expanded={open}
      onFocus={() => {
        if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
        setOpen(true);
        if (value) setQuery("");
      }}
      onBlur={closeAndRestoreSelection}
      onChange={(event) => {
        setQuery(event.target.value);
        setMatches([]);
        setLookupFailed(false);
        setOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          setQuery(selectedLabel);
        }
        if (event.key === "Enter" && matches.length === 1) {
          event.preventDefault();
          selectSupplier(matches[0]);
        }
      }}
    />
    {value && !disabled && <button type="button" className="supplier-search-picker-clear" title="Clear supplier" aria-label="Clear supplier" onMouseDown={(event) => event.preventDefault()} onClick={() => {
      onSelect(null);
      setQuery("");
      setMatches([]);
      setOpen(true);
    }}><X size={14}/></button>}
    {open && !disabled && <div className="supplier-search-picker-options" role="listbox">
      {query.trim().length < 2
        ? <span>Type at least 2 letters to find a supplier.</span>
        : loading
          ? <span>Searching suppliers…</span>
          : lookupFailed
            ? <span>Unable to search suppliers. Try again.</span>
            : matches.length
              ? matches.map((supplier) => <button type="button" role="option" key={supplier.supplierId} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSupplier(supplier)}>
                <strong>{supplierLabel(supplier)}</strong>
                {supplier.supplierCategory && <small>{supplier.supplierCategory.replace(/_/g, " ")}</small>}
              </button>)
              : <span>No active submitted suppliers found.</span>}
    </div>}
  </div>;
}
