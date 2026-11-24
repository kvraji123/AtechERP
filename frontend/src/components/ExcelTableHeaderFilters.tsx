import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type OpenFilter = {
  table: HTMLTableElement;
  columnIndex: number;
  label: string;
  top: number;
  left: number;
};

const filterIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-6.54L22 3z" /></svg>';

const filterableHeader = (header: HTMLTableCellElement) => {
  const label = (header.dataset.appHeaderFilterLabel || header.innerText || "").replace(/\s+/g, " ").trim();
  if (!label || /^(action|actions|select|selection|#|s\.?\s*no\.?)$/i.test(label)) return "";
  if (header.querySelector("input, .marketing-column-filter-trigger, .gauge-column-filter")) return "";
  return label;
};

const dataRows = (table: HTMLTableElement) => Array.from(table.tBodies)
  .flatMap((body) => Array.from(body.rows))
  .filter((row) => row.cells.length > 1 && !row.querySelector("[data-app-header-filter-empty]"));

const cellText = (row: HTMLTableRowElement, columnIndex: number) => (row.cells.item(columnIndex)?.innerText || "—")
  .replace(/\s+/g, " ")
  .trim() || "—";

const filterableTable = (table: HTMLTableElement) => {
  if (table.dataset.appHeaderFilterDisabled === "true") return false;
  if (!table.tHead || !dataRows(table).length) return false;
  if (table.closest("[role='dialog'], .tool-modal, .purchase-dialog, .material-outward-challan-overlay, .master-form, form")) return false;
  if (table.querySelector(".marketing-column-filter-trigger, .gauge-column-filter")) return false;
  if (table.querySelector("tbody input:not([type='checkbox']), tbody select, tbody textarea")) return false;
  return Array.from(table.tHead.rows[0]?.cells || []).some((header) => filterableHeader(header));
};

export default function ExcelTableHeaderFilters() {
  const filters = useRef(new WeakMap<HTMLTableElement, Map<number, string[]>>());
  const [openFilter, setOpenFilter] = useState<OpenFilter | null>(null);
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [optionSearch, setOptionSearch] = useState("");

  const applyTableFilters = useCallback((table: HTMLTableElement) => {
    const selected = filters.current.get(table) || new Map<number, string[]>();
    dataRows(table).forEach((row) => {
      const visible = [...selected.entries()].every(([columnIndex, values]) => !values.length || values.includes(cellText(row, columnIndex)));
      row.hidden = !visible;
    });
  }, []);

  const openColumnFilter = useCallback((table: HTMLTableElement, columnIndex: number, label: string, trigger: HTMLButtonElement) => {
    const bounds = trigger.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 32);
    setDraftValues([...(filters.current.get(table)?.get(columnIndex) || [])]);
    setOptionSearch("");
    setOpenFilter({
      table,
      columnIndex,
      label,
      top: Math.min(bounds.bottom + 8, Math.max(16, window.innerHeight - 370)),
      left: Math.max(16, Math.min(bounds.right - width, window.innerWidth - width - 16)),
    });
  }, []);

  const scanTables = useCallback(() => {
    document.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.dataset.appHeaderFilterDisabled === "true") {
        table.querySelectorAll(".app-header-filter-trigger").forEach((trigger) => trigger.remove());
        delete table.dataset.appHeaderFilterTable;
        return;
      }
      if (!filterableTable(table)) return;
      table.dataset.appHeaderFilterTable = "true";
      const headers = Array.from(table.tHead?.rows[0]?.cells || []);
      headers.forEach((header, columnIndex) => {
        const label = filterableHeader(header);
        if (!label) return;
        header.dataset.appHeaderFilterLabel = label;
        let trigger = header.querySelector<HTMLButtonElement>(":scope > .app-header-filter-trigger");
        if (!trigger) {
          trigger = document.createElement("button");
          trigger.type = "button";
          trigger.className = "app-header-filter-trigger";
          trigger.dataset.appHeaderFilterTrigger = "true";
          trigger.innerHTML = filterIcon;
          header.append(trigger);
        }
        if (!trigger.querySelector("svg")) trigger.innerHTML = filterIcon;
        const selectedCount = filters.current.get(table)?.get(columnIndex)?.length || 0;
        trigger.classList.toggle("is-active", selectedCount > 0);
        trigger.setAttribute("aria-label", `Filter ${label}`);
        trigger.setAttribute("title", `Filter ${label}`);
        trigger.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          openColumnFilter(table, columnIndex, label, trigger!);
        };
      });
      applyTableFilters(table);
    });
  }, [applyTableFilters, openColumnFilter]);

  useEffect(() => {
    let frame = 0;
    const scheduleScan = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; scanTables(); });
    };
    scheduleScan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) window.cancelAnimationFrame(frame); };
  }, [scanTables]);

  useEffect(() => {
    if (!openFilter) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".app-header-filter-popover") && !target.closest(".app-header-filter-trigger")) setOpenFilter(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenFilter(null); };
    const dismissForViewportChange = () => setOpenFilter(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismissForViewportChange);
    window.addEventListener("scroll", dismissForViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismissForViewportChange);
      window.removeEventListener("scroll", dismissForViewportChange, true);
    };
  }, [openFilter]);

  const options = useMemo(() => {
    if (!openFilter) return [];
    const all = [...new Set(dataRows(openFilter.table).map((row) => cellText(row, openFilter.columnIndex)))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const query = optionSearch.trim().toLocaleLowerCase();
    return query ? all.filter((value) => value.toLocaleLowerCase().includes(query)) : all;
  }, [openFilter, optionSearch]);

  const toggleValue = (value: string) => setDraftValues((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  const apply = () => {
    if (!openFilter) return;
    const tableFilters = new Map(filters.current.get(openFilter.table) || []);
    if (draftValues.length) tableFilters.set(openFilter.columnIndex, draftValues);
    else tableFilters.delete(openFilter.columnIndex);
    filters.current.set(openFilter.table, tableFilters);
    applyTableFilters(openFilter.table);
    scanTables();
    setOpenFilter(null);
  };

  if (!openFilter) return null;
  const allVisibleSelected = options.length > 0 && options.every((value) => draftValues.includes(value));
  return createPortal(
    <section className="app-header-filter-popover" role="dialog" aria-label={`Filter ${openFilter.label}`} style={{ top: openFilter.top, left: openFilter.left }}>
      <header><strong>Filter {openFilter.label}</strong><button type="button" aria-label={`Close ${openFilter.label} filter`} onClick={() => setOpenFilter(null)}>×</button></header>
      <input className="app-header-filter-search" type="search" autoFocus value={optionSearch} onChange={(event) => setOptionSearch(event.target.value)} placeholder={`Search ${openFilter.label.toLowerCase()}`} />
      <label className="app-header-filter-select-all">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          disabled={!options.length}
          onChange={(event) => setDraftValues((current) =>
            event.target.checked
              ? [...new Set([...current, ...options])]
              : current.filter((value) => !options.includes(value))
          )}
        />
        Select all
      </label>
      <div className="app-header-filter-options">{options.length ? options.map((value) => <label key={value}><input type="checkbox" checked={draftValues.includes(value)} onChange={() => toggleValue(value)} /><span>{value}</span></label>) : <p>No matching values</p>}</div>
      <footer><button type="button" className="app-header-filter-clear" onClick={() => setDraftValues([])}>Clear</button><button type="button" className="app-header-filter-apply" onClick={apply}>Apply filter</button></footer>
    </section>,
    document.body,
  );
}
