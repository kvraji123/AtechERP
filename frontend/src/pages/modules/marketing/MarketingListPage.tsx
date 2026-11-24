import "./MarketingListPage.css";

import { Download, Eye, Filter, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import { marketingApi } from "../../../api/marketing.api";
import Alert from "../../../components/Alert";
import { useAppFeedback } from "../../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import { useAuth } from "../../../context/AuthContext";
import {
  hasPermission,
  Permissions,
} from "../../../utils/permissions";
import { formatListDateTime } from "../../../utils/formatDateTime";



const statusLabel = (status: string) =>
  ({
    IN_PROGRESS: "In Progress",
    QUOTED: "Quoted",
    ORDER_RECEIVED: "Order Received",
  })[status] || status;

const statusClass = (status: string) =>
  status.toLowerCase().replace(/_/g, "-");

const enquiryDestination = (row: any) => {
  const enquiryId = Number(row.enquiryId);
  const partId = Number(row.currentPartId);
  const stage = String(row.currentStage || "ENQUIRY").toUpperCase();
  const status = String(row.enquiryStatus || "").toUpperCase();

  if (stage === "FEASIBILITY" && partId > 0) {
    return `/marketing/enquiry-parts/${partId}/feasibility`;
  }
  if (stage === "WORKOUT" && partId > 0) {
    return `/marketing/enquiry-parts/${partId}/workout`;
  }
  if (stage === "QUOTATION" || (stage === "COMPLETED" && ["QUOTED", "ORDER_RECEIVED"].includes(status))) {
    return `/marketing/enquiries/${enquiryId}/quotation`;
  }
  if (stage === "COMPLETED" && partId > 0) {
    return `/marketing/enquiry-parts/${partId}/feasibility`;
  }
  return `/marketing/enquiries/${enquiryId}`;
};

const destinationWithMode = (
  row: any,
  mode: "view" | "edit"
) => `${enquiryDestination(row)}?mode=${mode}`;

const partLabel = (part: any) => String(
  part.itemCode || part.drawingNumber || part.partNumber || part.description || "Unnamed part"
);

const partDetail = (part: any) => [
  part.drawingNumber && part.itemCode !== part.drawingNumber ? part.drawingNumber : "",
  part.description,
].filter(Boolean).join(" · ");

type PartsPopover = {
  enquiryId: number;
  parts: any[];
  top: number;
  left: number;
};

type FilterKey =
  | "docNo"
  | "customer"
  | "mode"
  | "orderType"
  | "stage"
  | "status"
  | "parts"
  | "createdOn"
  | "lastUpdated";

type FilterOption = {
  value: string;
  label: string;
};

type ColumnFilters = Partial<Record<FilterKey, string[]>>;

type ColumnFilterPopover = {
  key: FilterKey;
  label: string;
  top: number;
  left: number;
};

const filterColumns: Array<{ key: FilterKey; label: string }> = [
  { key: "docNo", label: "Doc No." },
  { key: "customer", label: "Customer" },
  { key: "mode", label: "Mode" },
  { key: "orderType", label: "Order Type" },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "parts", label: "Parts" },
  { key: "createdOn", label: "Created" },
  { key: "lastUpdated", label: "Last Updated" },
];

export default function MarketingListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const currentRole = user?.roleName || "";
  const isAdministrator = String(currentRole)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_") === "ADMINISTRATOR";
  const canEditEnquiries = hasPermission(
    user,
    Permissions.editEnquiryAllStages
  );
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [partsPopover, setPartsPopover] = useState<PartsPopover | null>(null);
  const [filterOptions, setFilterOptions] = useState<Partial<Record<FilterKey, FilterOption[]>>>({});
  const [selectedFilters, setSelectedFilters] = useState<ColumnFilters>({});
  const [columnFilterPopover, setColumnFilterPopover] = useState<ColumnFilterPopover | null>(null);
  const [draftFilterValues, setDraftFilterValues] = useState<string[]>([]);
  const [filterOptionSearch, setFilterOptionSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = async (
    requestedPage = page,
    requestedSearch = search,
    requestedFilters = selectedFilters
  ) => {
    try {
      setError("");
      const activeFilters = Object.fromEntries(
        Object.entries(requestedFilters).filter(([, values]) => values?.length)
      );
      const response = await marketingApi.list({
        search: requestedSearch,
        page: requestedPage,
        pageSize: PAGE_SIZE,
        activeFlag: showInactive ? "N" : "Y",
        ...(Object.keys(activeFilters).length > 0 ? { filters: JSON.stringify(activeFilters) } : {}),
      });
      setRows(response.data || []);
      setTotal(Number(response?.meta?.total || 0));
    } catch (loadError) {
      setError(apiMessage(loadError));
    }
  };

  useEffect(() => { void load(page); }, [page, selectedFilters, showInactive]);

  useEffect(() => {
    let active = true;

    marketingApi.enquiryFilterOptions()
      .then((response) => {
        if (!active) return;
        const grouped: Partial<Record<FilterKey, FilterOption[]>> = {};
        (response.data || []).forEach((option: any) => {
          const key = option.filterKey as FilterKey;
          if (!filterColumns.some((column) => column.key === key)) return;
          const value = String(option.optionValue || "").trim();
          if (!value) return;
          const label = String(option.optionLabel || value).trim() || value;
          grouped[key] = [...(grouped[key] || []), { value, label }];
        });
        setFilterOptions(grouped);
      })
      .catch(() => {
        if (active) setFilterOptions({});
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!partsPopover) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPartsPopover(null);
    };
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".marketing-parts-popover") &&
        !target.closest(".marketing-part-more")
      ) {
        setPartsPopover(null);
      }
    };
    const closeOnViewportChange = () => setPartsPopover(null);

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange);
    };
  }, [partsPopover]);

  useEffect(() => {
    if (!columnFilterPopover) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColumnFilterPopover(null);
    };
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".marketing-column-filter-popover") &&
        !target.closest(".marketing-column-filter-trigger")
      ) {
        setColumnFilterPopover(null);
      }
    };
    const closeOnViewportChange = () => setColumnFilterPopover(null);

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange);
    };
  }, [columnFilterPopover]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchSuggestions([]);
      setSuggestionsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      marketingApi.list({ search: query, page: 1, pageSize: 8 })
        .then((response) => {
          if (cancelled) return;
          setSearchSuggestions(response.data || []);
          setSuggestionsOpen(true);
        })
        .catch(() => {
          if (!cancelled) setSearchSuggestions([]);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const selectSearchSuggestion = (row: any) => {
    const value = String(row.docNo || row.customerName || "");
    setSearch(value);
    setPage(1);
    setSuggestionsOpen(false);
    void load(1, value);
  };

  const openPartsPopover = (row: any, event: any) => {
    const buttonBounds = event.currentTarget.getBoundingClientRect();
    const horizontalPadding = 16;
    const popoverWidth = Math.min(340, window.innerWidth - horizontalPadding * 2);
    const left = Math.max(
      horizontalPadding,
      Math.min(
        buttonBounds.right - popoverWidth,
        window.innerWidth - popoverWidth - horizontalPadding
      )
    );
    const top = Math.min(
      buttonBounds.bottom + 8,
      Math.max(horizontalPadding, window.innerHeight - 300)
    );

    setPartsPopover({
      enquiryId: Number(row.enquiryId),
      parts: row.parts,
      top,
      left,
    });
  };

  const openColumnFilter = (key: FilterKey, label: string, event: any) => {
    const buttonBounds = event.currentTarget.getBoundingClientRect();
    const horizontalPadding = 16;
    const popoverWidth = Math.min(330, window.innerWidth - horizontalPadding * 2);
    const left = Math.max(
      horizontalPadding,
      Math.min(
        buttonBounds.right - popoverWidth,
        window.innerWidth - popoverWidth - horizontalPadding
      )
    );

    setDraftFilterValues(selectedFilters[key] || []);
    setFilterOptionSearch("");
    setColumnFilterPopover({
      key,
      label,
      top: Math.min(buttonBounds.bottom + 8, Math.max(horizontalPadding, window.innerHeight - 360)),
      left,
    });
  };

  const applyColumnFilter = () => {
    if (!columnFilterPopover) return;

    const key = columnFilterPopover.key;
    setSelectedFilters((current) => {
      const next = { ...current };
      if (draftFilterValues.length > 0) next[key] = draftFilterValues;
      else delete next[key];
      return next;
    });
    setPage(1);
    setColumnFilterPopover(null);
  };

  const clearAllColumnFilters = () => {
    setSelectedFilters({});
    setPage(1);
  };

  const exportEnquiries = async () => {
    try {
      setExporting(true);
      setError("");
      const activeFilters = Object.fromEntries(
        Object.entries(selectedFilters).filter(([, values]) => values?.length)
      );
      const request = {
        search,
        activeFlag: showInactive ? "N" as const : "Y" as const,
        ...(Object.keys(activeFilters).length > 0 ? { filters: JSON.stringify(activeFilters) } : {}),
      };
      const exportedRows: any[] = [];
      let requestedPage = 1;
      let exportTotal = 0;

      do {
        const response = await marketingApi.list({
          ...request,
          page: requestedPage,
          pageSize: 100,
        });
        exportedRows.push(...(response.data || []));
        exportTotal = Number(response?.meta?.total || 0);
        requestedPage += 1;
      } while (exportedRows.length < exportTotal);

      const XLSX = await import("xlsx");
      const data = exportedRows.map((row) => ({
        "Doc No.": row.docNo || "",
        "Customer Name": row.customerName || "",
        "Customer Code": row.customerCode || "",
        Mode: row.enquiryMode || "",
        "Order Type": row.orderType || "",
        Stage: row.currentStage || "",
        Status: statusLabel(row.enquiryStatus || ""),
        "Part Numbers": (row.parts || []).map((part: any) => partLabel(part)).join("\n"),
        "Drawing Numbers": (row.parts || []).map((part: any) => part.drawingNumber || "").filter(Boolean).join("\n"),
        "Part Descriptions": (row.parts || []).map((part: any) => part.description || "").filter(Boolean).join("\n"),
        Created: row.createdOn || "",
        "Last Updated": formatListDateTime(row.lastUpdated),
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = [
        { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 25 }, { wch: 42 },
        { wch: 20 }, { wch: 22 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Enquiries");
      XLSX.writeFile(workbook, `marketing-enquiries-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    } catch (exportError) {
      setError(apiMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  const visibleFilterOptions = columnFilterPopover
    ? (filterOptions[columnFilterPopover.key] || []).filter((option) => {
      const query = filterOptionSearch.trim().toLowerCase();
      return !query || `${option.label} ${option.value}`.toLowerCase().includes(query);
    })
    : [];

  const toggleDraftFilterValue = (value: string) => {
    setDraftFilterValues((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  };

  const setVisibleDraftValues = (checked: boolean) => {
    const visibleValues = visibleFilterOptions.map((option) => option.value);
    setDraftFilterValues((current) => checked
      ? [...new Set([...current, ...visibleValues])]
      : current.filter((value) => !visibleValues.includes(value)));
  };

  const removeEnquiry = async (row: any) => {
    const confirmed = await confirmDelete({
      title: "Delete Enquiry?",
      message: `${row.docNo} will be removed from the active enquiry list. Existing history and related documents will be retained.`,
      confirmLabel: "Delete Enquiry",
    });
    if (!confirmed) return;

    try {
      setError("");
      await marketingApi.deleteEnquiry(Number(row.enquiryId));
      setRows((current) => current.filter((item) => Number(item.enquiryId) !== Number(row.enquiryId)));
      setSearchSuggestions((current) => current.filter((item) => Number(item.enquiryId) !== Number(row.enquiryId)));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Enquiry deleted successfully.");

      if (rows.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const hardDeleteInactiveEnquiry = async (row: any) => {
    const confirmed = await confirmDelete({
      title: "Permanently delete inactive enquiry?",
      message: `${row.docNo} and its enquiry workflow, quotation and feasibility records, and stored enquiry documents will be permanently removed. This cannot be undone. Operationally linked records may block deletion.`,
      confirmLabel: "Permanently Delete",
    });
    if (!confirmed) return;

    try {
      setError("");
      const response = await marketingApi.hardDeleteEnquiry(Number(row.enquiryId));
      setRows((current) => current.filter((item) => Number(item.enquiryId) !== Number(row.enquiryId)));
      setTotal((current) => Math.max(0, current - 1));
      setSearchSuggestions((current) => current.filter((item) => Number(item.enquiryId) !== Number(row.enquiryId)));
      if (String(response?.message || "").includes("some stored files could not be removed")) {
        setError(response.message);
      } else {
        showSuccess(response?.message || "Inactive enquiry permanently deleted.");
      }
      if (rows.length === 1 && page > 1) setPage((current) => Math.max(1, current - 1));
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const columnHeader = (key: FilterKey, label: string, className = "") => {
    const filterCount = selectedFilters[key]?.length || 0;
    return <th className={className}>
      <span className="marketing-column-header-content">
        <span>{label}</span>
        <button
          type="button"
          className={`marketing-column-filter-trigger${filterCount > 0 ? " is-active" : ""}`}
          aria-label={`Filter ${label}`}
          aria-expanded={columnFilterPopover?.key === key}
          onClick={(event) => {
            if (columnFilterPopover?.key === key) {
              setColumnFilterPopover(null);
              return;
            }
            openColumnFilter(key, label, event);
          }}
        >
          <Filter size={13} />
        </button>
      </span>
    </th>;
  };

  return (
    <div className="page-container marketing-page">
      <div className="page-heading-row">
        <div>
          <h1>Marketing Enquiries</h1>
        </div>

        <button
          className="primary-action-button"
          onClick={() => navigate("/marketing/enquiries/new")}
        >
          <Plus size={18} />
          New Enquiry
        </button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="marketing-list-panel">
        <div className="marketing-list-header">
          <div>
            <h2>Enquiries</h2>
            <p>{total} records found</p>
          </div>
          <div className="marketing-list-tools">
          {isAdministrator && <button
            type="button"
            className="secondary-action-button"
            aria-pressed={showInactive}
            onClick={() => { setPage(1); setShowInactive((current) => !current); }}
          >
            {showInactive ? "Show active enquiries" : "Show inactive enquiries"}
          </button>}
          <form
            className="marketing-list-search"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSuggestionsOpen(false);
              void load(1);
            }}
          >
            <div className="marketing-search-field marketing-search-autocomplete">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => searchSuggestions.length && setSuggestionsOpen(true)}
                onBlur={() => setSuggestionsOpen(false)}
                placeholder="Search enquiry, customer or part"
                aria-label="Search enquiry, customer or part"
                aria-autocomplete="list"
                aria-controls="marketing-enquiry-search-suggestions"
                aria-expanded={suggestionsOpen}
              />
              {suggestionsOpen && searchSuggestions.length > 0 && <div id="marketing-enquiry-search-suggestions" className="marketing-search-suggestions" role="listbox" aria-label="Matching enquiries">
                {searchSuggestions.map((row) => <button
                  key={row.enquiryId}
                  type="button"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSearchSuggestion(row)}
                >
                  <strong>{row.docNo}</strong>
                  <span>{row.customerName}<small>{row.customerCode}</small></span>
                </button>)}
              </div>}
            </div>
            <button className="secondary-action-button" type="submit">
              Search
            </button>
          </form>
          {Object.keys(selectedFilters).length > 0 && <button
            type="button"
            className="marketing-clear-filters"
            onClick={clearAllColumnFilters}
          >
            Clear filters
          </button>}
          <button
            type="button"
            className="secondary-action-button marketing-export-button"
            disabled={exporting}
            onClick={exportEnquiries}
          >
            <Download size={15} />
            {exporting ? "Exporting..." : "Export Excel"}
          </button>
          <Pagination page={page} total={total} onPageChange={setPage} itemLabel="enquiries" />
          </div>
        </div>

        <div className="marketing-table-wrapper">
          <table className="marketing-data-table">
            <thead>
              <tr>
                {columnHeader("docNo", "Doc No.")}
                {columnHeader("customer", "Customer")}
                {columnHeader("mode", "Mode")}
                {columnHeader("orderType", "Order Type")}
                {columnHeader("stage", "Stage")}
                {columnHeader("status", "Status")}
                {columnHeader("parts", "Parts")}
                {columnHeader("createdOn", "Created")}
                {columnHeader("lastUpdated", "Last Updated", "app-last-updated-column")}
                <th className="marketing-actions-column">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.enquiryId}
                  onDoubleClick={() => row.activeFlag !== "N" && navigate(enquiryDestination(row))}
                >
                  <td>
                    {row.activeFlag === "N" ? <span>{row.docNo}</span> : <button
                        className="marketing-enquiry-link"
                        onClick={() => navigate(enquiryDestination(row))}
                      >
                        {row.docNo}
                      </button>}
                  </td>
                  <td className="marketing-customer-cell">
                    <strong>{row.customerName}</strong>
                    <span>{row.customerCode}</span>
                  </td>
                  <td>{row.enquiryMode}</td>
                  <td>{row.orderType}</td>
                  <td>
                    <span className="marketing-badge stage quotation">
                      {row.currentStage}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`marketing-badge status ${row.activeFlag === "N" ? "inactive" : statusClass(row.enquiryStatus)}`}
                    >
                      {row.activeFlag === "N" ? "Inactive" : statusLabel(row.enquiryStatus)}
                    </span>
                  </td>
                  <td className="marketing-parts-cell">
                    {Array.isArray(row.parts) && row.parts.length > 0 ? <>
                      <div className="marketing-part-chips">
                        {row.parts.slice(0, 1).map((part: any) => <span
                          className="marketing-part-chip"
                          key={part.enquiryPartId}
                          title={partDetail(part) || partLabel(part)}
                        >
                          <strong>{partLabel(part)}</strong>
                          {partDetail(part) && <small>{partDetail(part)}</small>}
                        </span>)}
                        {row.parts.length > 1 && <button
                          type="button"
                          className="marketing-part-more"
                          aria-expanded={partsPopover?.enquiryId === Number(row.enquiryId)}
                          onClick={(event) => {
                            if (partsPopover?.enquiryId === Number(row.enquiryId)) {
                              setPartsPopover(null);
                              return;
                            }
                            openPartsPopover(row, event);
                          }}
                        >+{row.parts.length - 1} more</button>}
                      </div>
                    </> : <span className="marketing-part-count">{row.partCount || 0} parts</span>}
                  </td>
                  <td>{row.createdOn}</td>
                  <td className="app-last-updated-column">{formatListDateTime(row.lastUpdated)}</td>
                  <td className="marketing-actions-column">
                    <div className="marketing-row-actions">
                      {row.activeFlag !== "N" && <button
                        type="button"
                        className="marketing-icon-action"
                        title="View enquiry"
                        aria-label={`View enquiry ${row.docNo}`}
                        onClick={() =>
                          navigate(destinationWithMode(row, "view"))
                        }
                      >
                        <Eye size={16} />
                      </button>}
                      {row.activeFlag !== "N" && canEditEnquiries && (
                        <button
                        type="button"
                        className="marketing-icon-action"
                        title="Edit enquiry"
                        aria-label={`Edit enquiry ${row.docNo}`}
                        onClick={() =>
                          navigate(destinationWithMode(row, "edit"))
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      )}
                      {isAdministrator && row.activeFlag === "N" ? (
                        <button
                          type="button"
                          className="marketing-icon-action"
                          title="Permanently delete inactive enquiry"
                          aria-label={`Permanently delete ${row.docNo}`}
                          onClick={() => void hardDeleteInactiveEnquiry(row)}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : isAdministrator && (
                        <button
                          type="button"
                          className="marketing-icon-action"
                          title="Delete enquiry"
                          aria-label={`Delete enquiry ${row.docNo}`}
                          onClick={() => void removeEnquiry(row)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {columnFilterPopover && createPortal(
        <div
          className="marketing-column-filter-popover"
          role="dialog"
          aria-label={`Filter ${columnFilterPopover.label}`}
          style={{ top: columnFilterPopover.top, left: columnFilterPopover.left }}
        >
          <div className="marketing-column-filter-heading">
            <strong>Filter {columnFilterPopover.label}</strong>
            <button
              type="button"
              className="marketing-column-filter-close"
              onClick={() => setColumnFilterPopover(null)}
              aria-label={`Close ${columnFilterPopover.label} filter`}
            >
              <X size={15} />
            </button>
          </div>
          <label className="marketing-column-filter-search">
            <Search size={15} />
            <input
              type="search"
              value={filterOptionSearch}
              onChange={(event) => setFilterOptionSearch(event.target.value)}
              placeholder={`Search ${columnFilterPopover.label.toLowerCase()}`}
              autoFocus
            />
          </label>
          <label className="marketing-column-filter-select-all">
            <input
              type="checkbox"
              checked={visibleFilterOptions.length > 0 && visibleFilterOptions.every((option) => draftFilterValues.includes(option.value))}
              onChange={(event) => setVisibleDraftValues(event.target.checked)}
              disabled={visibleFilterOptions.length === 0}
            />
            Select all
          </label>
          <div className="marketing-column-filter-options">
            {visibleFilterOptions.length > 0 ? visibleFilterOptions.map((option) => <label key={option.value}>
              <input
                type="checkbox"
                checked={draftFilterValues.includes(option.value)}
                onChange={() => toggleDraftFilterValue(option.value)}
              />
              <span>{option.label}</span>
            </label>) : <p>No matching values</p>}
          </div>
          <div className="marketing-column-filter-actions">
            <button
              type="button"
              className="marketing-column-filter-clear"
              onClick={() => setDraftFilterValues([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="marketing-column-filter-apply"
              onClick={applyColumnFilter}
            >
              Apply filter
            </button>
          </div>
        </div>,
        document.body
      )}
      {partsPopover && createPortal(
        <div
          className="marketing-parts-popover"
          role="dialog"
          aria-label="Additional parts in this enquiry"
          style={{ top: partsPopover.top, left: partsPopover.left }}
        >
          <div className="marketing-parts-popover-heading">
            <strong>Parts in this enquiry <span>{partsPopover.parts.length}</span></strong>
            <button
              type="button"
              className="marketing-parts-popover-close"
              onClick={() => setPartsPopover(null)}
              aria-label="Close additional parts"
            >
              <X size={15} />
            </button>
          </div>
          <ul>{partsPopover.parts.map((part: any) => <li key={part.enquiryPartId}>
            <span><b>{partLabel(part)}</b>{partDetail(part) && <small>{partDetail(part)}</small>}</span>
            <em>Qty {Number(part.requiredQuantity || 0).toLocaleString()}{part.unitOfMeasurement ? ` ${part.unitOfMeasurement}` : ""}</em>
          </li>)}</ul>
        </div>,
        document.body
      )}
    </div>
  );
}
