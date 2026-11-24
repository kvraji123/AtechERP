import {
  AlertTriangle,
  PackageSearch,
  Pencil,
  Paperclip,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { attachmentFileUrl } from "../../api/attachment.api";
import { partApi } from "../../api/part.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import { useAppFeedback } from "../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import QualityPlanPrintModal from "./QualityPlanPrintModal";
import "./CustomerPage.css";
import "./PartPage.css";
type PartRow = {
  partId: number;
  customerName: string;
  partCategory: string;
  partName: string;
  partNumber: string;
  drawingNumber: string;
  drawingCode: string;
  drawingRevisionNumber: string;
  drawingAttachments?: Array<{
    attachmentId: number;
    attachmentType: string;
    fileName: string;
    fileUrl: string;
  }>;
  partWeight: string;
  unitOfMeasurement: string;
  partStatus: "ACTIVE" | "INACTIVE" | "DRAWING_UNDER_REVISION" | "DRAFT";
  bomCompletionStatus: string;
  processPlanCompletionStatus: string;
  inspectionPlanCompletionStatus: string;
  revisionWarning?: string | null;
};

type CompletionStatus = "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" | "NOT_REQUIRED";

const completionItems: Array<{ key: keyof Pick<PartRow, "bomCompletionStatus" | "processPlanCompletionStatus" | "inspectionPlanCompletionStatus">; label: string }> = [
  { key: "bomCompletionStatus", label: "BOM" },
  { key: "processPlanCompletionStatus", label: "PP" },
  { key: "inspectionPlanCompletionStatus", label: "IP" },
];

function normalizeCompletionStatus(value: string | null | undefined): CompletionStatus {
  const status = String(value || "").toUpperCase();
  if (status === "COMPLETED" || status === "IN_PROGRESS" || status === "NOT_REQUIRED") {
    return status;
  }
  return "NOT_STARTED";
}

function completionStatusLabel(status: CompletionStatus) {
  return status === "COMPLETED"
    ? "Complete"
    : status === "IN_PROGRESS"
      ? "In progress"
      : status === "NOT_REQUIRED"
        ? "Not required"
        : "Not started";
}

function PartCompletionStatus({ part }: { part: PartRow }) {
  return (
    <div className="part-completion-statuses" aria-label="BOM, process plan and inspection plan completion">
      {completionItems.map((item) => {
        const status = normalizeCompletionStatus(part[item.key]);
        const label = completionStatusLabel(status);
        return (
          <span
            key={item.key}
            className={`part-completion-status ${status.toLowerCase().replace(/_/g, "-")}`}
            title={`${item.label}: ${label}`}
            aria-label={`${item.label}: ${label}`}
          >
            <small>{item.label}</small>
            <span className="part-completion-dot" aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}

export default function PartPage() {
  const referenceData = useReferenceData(["RECORD_STATUS"]);
  const navigate = useNavigate();
  const { confirmDelete, showSuccess } = useAppFeedback();

  const [parts, setParts] = useState<PartRow[]>(
    []
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revisionAlertsOpen, setRevisionAlertsOpen] = useState(false);
  const [revisionAlertParts, setRevisionAlertParts] = useState<PartRow[]>([]);
  const [revisionAlertsLoading, setRevisionAlertsLoading] = useState(false);
  const [revisionAlertsError, setRevisionAlertsError] = useState("");
  const [qualityPlanOpen, setQualityPlanOpen] = useState(false);
  const revisionAlertsRef = useRef<HTMLDivElement>(null);

  const loadRevisionAlerts = useCallback(async () => {
    try {
      setRevisionAlertsLoading(true);
      setRevisionAlertsError("");
      const response = await partApi.list({
        page: 1,
        pageSize: 100,
        activeFlag: "Y",
        partStatus: "DRAWING_UNDER_REVISION",
        includeDraft: false,
      });
      setRevisionAlertParts(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      setRevisionAlertsError(apiMessage(loadError));
    } finally {
      setRevisionAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRevisionAlerts();
  }, [loadRevisionAlerts]);

  useEffect(() => {
    const closeRevisionAlerts = (event: MouseEvent) => {
      const target = event.target as Node;
      if (revisionAlertsRef.current && !revisionAlertsRef.current.contains(target)) {
        setRevisionAlertsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeRevisionAlerts);
    return () => document.removeEventListener("mousedown", closeRevisionAlerts);
  }, []);

  useEffect(() => {
    async function loadParts() {
      try {
        setLoading(true);
        setError("");
        const response = await partApi.list({
          page,
          pageSize: PAGE_SIZE,
          search,
          activeFlag: status === "ACTIVE" || status === "DRAWING_UNDER_REVISION" ? "Y" : status === "INACTIVE" ? "N" : "",
          partStatus: (status === "DRAFT" ? "" : status) as "ACTIVE" | "INACTIVE" | "DRAWING_UNDER_REVISION" | "",
          saveStatus: status === "DRAFT" ? "DRAFT" : status ? "SUBMITTED" : "",
          includeDraft: true,
        });
        setParts(Array.isArray(response?.data) ? response.data : []);
        setTotal(Number(response?.meta?.total || 0));
      } catch (loadError) {
        setError(apiMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadParts();
  }, [page, search, status]);

  const remove = async (part: PartRow) => {
    const confirmed = await confirmDelete({
      title: "Delete Part?",
      message: `${part.partNumber || part.partName} will be deactivated and cannot be used in new transactions. Existing documents will be kept.`,
      confirmLabel: "Deactivate Part",
    });
    if (!confirmed) return;
    try {
      setError("");
      await partApi.changeStatus(part.partId, "INACTIVE");
      setParts((current) => current.filter((row) => row.partId !== part.partId));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Part deactivated successfully.");
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const openPart = (part: PartRow, mode: "edit" | "view") => {
    navigate(`/masters/parts/${part.partId}?mode=${mode}`);
  };

  const toggleRevisionAlerts = () => {
    if (!revisionAlertsOpen) void loadRevisionAlerts();
    setRevisionAlertsOpen((current) => !current);
  };

  return (
    <div className="page-container master-list-page part-master-list-page">
      <section className="master-list-header part-master-list-header">
        <div>
          <p className="page-eyebrow">
            MASTERS / PART MASTER
          </p>

          <h1>Part Master</h1>
        </div>

        <div className="part-master-header-actions">
          <div className="part-revision-alert-menu" ref={revisionAlertsRef}>
            <button
              type="button"
              className="part-revision-alert-trigger"
              aria-label={revisionAlertParts.length
                ? `Show drawing revision alerts, ${revisionAlertParts.length} drawings under revision`
                : "Show drawing revision alerts"}
              aria-expanded={revisionAlertsOpen}
              aria-haspopup="menu"
              onClick={toggleRevisionAlerts}
            >
              <AlertTriangle size={17} />
              Alert
              {revisionAlertParts.length > 0 && (
                <span aria-hidden="true">{revisionAlertParts.length > 99 ? "99+" : revisionAlertParts.length}</span>
              )}
            </button>

            {revisionAlertsOpen && (
              <div className="part-revision-alert-dropdown" role="menu" aria-label="Drawings under revision">
                <div className="part-revision-alert-header">
                  <div>
                    <strong>Drawings Under Revision</strong>
                    <span>Requires QA release before use.</span>
                  </div>
                  <span>{revisionAlertParts.length}</span>
                </div>

                {revisionAlertsLoading ? (
                  <p className="part-revision-alert-empty">Loading revised drawings...</p>
                ) : revisionAlertsError ? (
                  <p className="part-revision-alert-error">{revisionAlertsError}</p>
                ) : revisionAlertParts.length === 0 ? (
                  <p className="part-revision-alert-empty">No drawings are currently under revision.</p>
                ) : (
                  <div className="part-revision-alert-list">
                    {revisionAlertParts.map((part) => (
                      <button
                        key={part.partId}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setRevisionAlertsOpen(false);
                          openPart(part, "view");
                        }}
                      >
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>
                          <strong>{part.partNumber || part.partName}</strong>
                          <small>
                            Drawing: {part.drawingNumber || "-"}
                            {part.drawingRevisionNumber ? ` · Rev ${part.drawingRevisionNumber}` : ""}
                          </small>
                          {part.customerName && <small>{part.customerName}</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="secondary-action-button part-quality-plan-trigger"
            onClick={() => setQualityPlanOpen(true)}
          >
            <Printer size={16} />
            Print Quality Plan
          </button>

          <button
            type="button"
            className="primary-action-button"
            onClick={() =>
              navigate("/masters/parts/new")
            }
          >
            <Plus size={17} />
            New Part
          </button>
        </div>
      </section>
      {qualityPlanOpen && <QualityPlanPrintModal onClose={() => setQualityPlanOpen(false)} />}

      <section className="master-list-card">
        {error && (
          <div className="marketing-form-alert error">{error}</div>
        )}
        <div className="master-list-filter-row app-list-toolbar">
          <div className="master-search-box">
            <Search size={18} />

            <input
              type="text"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search customer, part number, name or drawing"
            />
          </div>

          <select
            className="master-filter-select"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          >
            <option value="">All Status</option>

            <option value="DRAFT">Draft</option>
            <option value="DRAWING_UNDER_REVISION">Drawing Under Revision</option>
            {referenceData.options("RECORD_STATUS").map((option) =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="parts" disabled={loading} />
      </div>

        <div className="master-table-wrapper">
          <table className="master-data-table part-master-table">
            <thead>
              <tr>
                <th>Part Number</th>
                <th>Part Name</th>
                <th>Customer</th>
                <th>Category</th>
                <th>Drawing Number</th>
                <th>Drawing Code</th>
                <th>Revision</th>
                <th>Attached Drawings</th>
                <th className="part-completion-column">Completion</th>
                <th>Status</th>
                <th className="master-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <div className="master-table-message">
                      Loading parts...
                    </div>
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="master-empty-state">
                      <div className="master-empty-icon">
                        <PackageSearch size={30} />
                      </div>

                      <h3>No parts found</h3>

                      <p>
                        Create your first Part Master
                        record.
                      </p>

                      <button
                        type="button"
                        className="primary-action-button"
                        onClick={() =>
                          navigate(
                            "/masters/parts/new"
                          )
                        }
                      >
                        <Plus size={17} />
                        Create Part
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                parts.map((row: PartRow & { saveStatus?: string }) => {
                  const part = {
                    ...row,
                    partStatus: row.saveStatus === "DRAFT" ? "DRAFT" : row.partStatus,
                  };
                  return (
                  <tr key={part.partId}>
                    <td>
                      <div className="master-record-cell">
                        <button type="button" className="master-record-edit" title="Edit part" aria-label={`Edit ${part.partNumber}`} onClick={() => openPart(part, "edit")}><Pencil size={15} /></button>
                        <button type="button" className="master-record-link" title="View part" onClick={() => openPart(part, "view")}>{part.partNumber}</button>
                      </div>
                    </td>

                    <td>{part.partName}</td>

                    <td>{part.customerName}</td>

                    <td>
                      <span className="part-category-badge">
                        {part.partCategory}
                      </span>
                    </td>

                    <td>
                      {part.drawingNumber || "-"}
                    </td>

                    <td>
                      {part.drawingCode || "-"}
                    </td>

                    <td>
                      {part.drawingRevisionNumber ||
                        "-"}
                    </td>

                    <td>
                      {Array.isArray(part.drawingAttachments) && part.drawingAttachments.length > 0 ? (
                        <ul className="part-drawing-list" aria-label={`Attached drawings for ${part.partNumber}`}>
                          {part.drawingAttachments.map((attachment) => (
                            <li key={attachment.attachmentId}>
                              <a
                                href={attachmentFileUrl(attachment.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                title={attachment.fileName}
                              >
                                <Paperclip size={12} />
                                <span>{attachment.fileName}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : "-"}
                    </td>

                    <td className="part-completion-cell">
                      <PartCompletionStatus part={part} />
                    </td>

                    <td>
                      <span
                        className={`master-status-badge ${
                          part.partStatus === "ACTIVE"
                            ? "active"
                            : part.partStatus === "DRAWING_UNDER_REVISION"
                              ? "revision"
                              : "inactive"
                        }`}
                      >
                        {part.partStatus === "DRAWING_UNDER_REVISION"
                          ? "Drawing Under Revision"
                          : part.partStatus}
                      </span>
                    </td>

                    <td>
                      <div className="master-row-actions">
                        <button
                          type="button"
                          title={part.partStatus === "ACTIVE" ? "Delete part" : "Part is already inactive"}
                          disabled={part.partStatus !== "ACTIVE"}
                          onClick={() => void remove(part)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
      </section>
    </div>
  );
}
