import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import { createBlankRequestLine } from "../purchaseData";
import type { PurchaseRequestLine } from "../types";

export type PurchaseItemOption = {
  itemId?: number;
  code: string;
  group: string;
  type: string;
  description: string;
  specification: string;
  uom: string;
  hsn: string;
  tax: string;
  purchaseRate?: number | null;
};

type PurchaseRequestLineItemsProps = {
  lines: PurchaseRequestLine[];
  onChange: (lines: PurchaseRequestLine[]) => void;
  itemOptions?: PurchaseItemOption[];
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const itemLabel = (item: Pick<PurchaseItemOption, "type" | "code">) => `${item.type}${item.code ? ` — ${item.code}` : ""}`;

type ItemSearchPickerProps = {
  line: PurchaseRequestLine;
  options: PurchaseItemOption[];
  disabled?: boolean;
  onSelect: (value: string) => void;
};

function ItemSearchPicker({ line, options, disabled = false, onSelect }: ItemSearchPickerProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 320 });
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedLabel = line.itemId ? itemLabel({ type: line.itemType, code: line.itemCode }) : "";
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  const matchingOptions = options.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.type, item.code, item.description, item.group]
      .some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
  });
  const filteredOptions = matchingOptions.slice(0, 8);

  const updateMenuPosition = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      top: rect.bottom + 5,
      left: rect.left,
      width: Math.min(Math.max(rect.width, 320), window.innerWidth - rect.left - 16),
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const beginSearch = (input: HTMLInputElement) => {
    if (disabled) return;
    setQuery("");
    setIsOpen(true);
    updateMenuPosition();
    input.select();
  };

  const menu = isOpen && !disabled && createPortal(
    <div
      id={`item-picker-${line.id}`}
      className="purchase-item-search-menu"
      role="listbox"
      style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
    >
      {filteredOptions.length ? filteredOptions.map((item) => (
        <button
          key={item.itemId ?? item.code}
          type="button"
          role="option"
          aria-selected={line.itemId === item.itemId}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onSelect(String(item.itemId ?? item.type));
            setQuery(null);
            setIsOpen(false);
          }}
        >
          <span>
            <strong>{itemLabel(item)}</strong>
            <small>{item.description || "No item description"}</small>
          </span>
          {item.group && <em>{item.group}</em>}
        </button>
      )) : <p className="purchase-item-search-empty">No matching Item Master record.</p>}
      {matchingOptions.length > filteredOptions.length && (
        <p className="purchase-item-search-refine">Showing the closest 8 items. Type more to narrow the list.</p>
      )}
    </div>,
    document.body,
  );

  return (
    <div className="purchase-item-search-picker">
      <div className="purchase-item-search-input">
        <Search size={14} aria-hidden="true" />
        <input
          aria-label="Search and select an item from Item Master"
          aria-autocomplete="list"
          aria-controls={`item-picker-${line.id}`}
          aria-expanded={isOpen}
          autoComplete="off"
          disabled={disabled}
          placeholder="Search Item Master"
          role="combobox"
          ref={inputRef}
          value={query ?? selectedLabel}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            if (line.itemId) onSelect("");
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={(event) => beginSearch(event.currentTarget)}
        />
      </div>
      {menu}
    </div>
  );
}

export default function PurchaseRequestLineItems({ lines, onChange, itemOptions }: PurchaseRequestLineItemsProps) {
  const options: PurchaseItemOption[] = itemOptions || [];

  const updateLine = (id: number, patch: Partial<PurchaseRequestLine>) => {
    onChange(lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  const selectItem = (id: number, selectedValue: string) => {
    const item = options.find((option) => String(option.itemId ?? option.type) === selectedValue);
    updateLine(id, item ? {
      itemId: item.itemId,
      itemCode: item.code,
      itemType: item.type,
      itemGroup: item.group,
      itemDescription: item.description,
      specification: item.specification,
      uom: item.uom,
      hsnCode: item.hsn,
      taxPercent: item.tax,
      ratePerQty: item.purchaseRate == null ? "" : String(item.purchaseRate),
    } : { itemId: undefined, itemCode: "", itemType: "", itemGroup: "", itemDescription: "", specification: "", hsnCode: "", taxPercent: "", ratePerQty: "" });
  };

  const addLine = () => {
    const nextId = Math.max(0, ...lines.map((line) => line.id)) + 1;
    onChange([...lines, createBlankRequestLine(nextId)]);
  };

  const removeLine = (id: number) => {
    if (lines.length === 1) return;
    onChange(lines.filter((line) => line.id !== id));
  };

  const lineTotal = (line: PurchaseRequestLine) => {
    const base = Number(line.quantity || 0) * Number(line.ratePerQty || 0);
    return base + (base * Number(line.taxPercent || 0)) / 100;
  };

  return (
    <>
      <div className="purchase-line-table-wrap">
        <table className="purchase-line-table">
          <thead>
            <tr>
              <th className="purchase-number-column">#</th>
              <th>Item Type</th>
              <th>Item Description</th>
              <th>Specification</th>
              <th>Qty</th>
              <th>UOM</th>
              <th>Rate / Qty</th>
              <th>Tax</th>
              <th>HSN</th>
              <th>Total Amount</th>
              <th>Purpose</th>
              <th>Attachment</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id}>
                <td className="purchase-line-index">{index + 1}</td>
                <td>
                  {line.editable === false && <small className="purchase-line-locked">Approved — locked</small>}
                  <ItemSearchPicker
                    line={line}
                    options={options}
                    disabled={line.editable === false}
                    onSelect={(value) => selectItem(line.id, value)}
                  />
                  {line.clarificationReason && <small className="purchase-line-clarification">Clarification: {line.clarificationReason}</small>}
                  <small>{line.itemGroup || "Item group auto-filled"}</small>
                </td>
                <td><textarea value={line.itemDescription} placeholder="Auto-filled from Item Master" disabled required /></td>
                <td><textarea value={line.specification} placeholder="Auto-filled from Item Master" disabled /></td>
                <td><input type="number" min="1" step="1" inputMode="numeric" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} required disabled={line.editable === false} /></td>
                <td><input value={line.uom} onChange={(event) => updateLine(line.id, { uom: event.target.value })} required disabled={line.editable === false} /></td>
                <td><input className="purchase-auto-rate" type="number" min="0" step="0.01" value={line.ratePerQty} placeholder="Auto-filled from Item Master" readOnly /></td>
                <td><input value={line.taxPercent} onChange={(event) => updateLine(line.id, { taxPercent: event.target.value })} placeholder="Auto" disabled={line.editable === false} /><small>{line.taxPercent ? `${line.taxPercent}%` : "From Item Master"}</small></td>
                <td><input value={line.hsnCode} onChange={(event) => updateLine(line.id, { hsnCode: event.target.value })} placeholder="Auto" disabled={line.editable === false} /></td>
                <td><strong className="purchase-line-total">{money.format(lineTotal(line))}</strong></td>
                <td><textarea value={line.purpose} onChange={(event) => updateLine(line.id, { purpose: event.target.value })} placeholder="Enter purpose" required disabled={line.editable === false} /></td>
                <td>
                  <label className="purchase-line-file" title={line.attachment || "Attach file"}>
                    <Paperclip size={16} />
                    <input type="file" aria-label={`Attachment for line ${index + 1}`} disabled={line.editable === false} onChange={(event) => { const file = event.target.files?.[0] || null; updateLine(line.id, { attachment: file?.name || line.attachment, attachmentFile: file }); }} />
                    <span>{line.attachment ? "Replace" : "Attach"}</span>
                  </label>
                  {line.attachmentUrl && <a className="purchase-line-attachment-link" href={line.attachmentUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{line.attachment || "Open attachment"}</a>}
                </td>
                <td>
                  <button type="button" className="purchase-delete-line" aria-label={`Delete line ${index + 1}`} disabled={lines.length === 1 || line.editable === false} onClick={() => removeLine(line.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="purchase-lines-footer">
        <button type="button" className="purchase-add-line" onClick={addLine}><Plus size={16} /> Add Line Item</button>
        <div className="purchase-total-summary">
          <span>Estimated Grand Total</span>
          <strong>{money.format(lines.reduce((sum, line) => sum + lineTotal(line), 0))}</strong>
        </div>
      </div>
    </>
  );
}
