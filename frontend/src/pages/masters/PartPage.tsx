import {
  Eye,
  PackageSearch,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { partApi } from "../../api/part.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import "./CustomerPage.css";
import "./PartPage.css";
type PartRow = {
  partId: number;
  customerName: string;
  partCategory: string;
  partName: string;
  partNumber: string;
  drawingNumber: string;
  drawingRevisionNumber: string;
  materialSpecification: string;
  partWeight: string;
  unitOfMeasurement: string;
  partStatus: "ACTIVE" | "INACTIVE";
};

export default function PartPage() {
  const referenceData = useReferenceData(["RECORD_STATUS"]);
  const navigate = useNavigate();

  const [parts, setParts] = useState<PartRow[]>(
    []
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadParts() {
      try {
        setLoading(true);
        setError("");
        const response = await partApi.list({
          page,
          pageSize: PAGE_SIZE,
          search,
          activeFlag: status === "ACTIVE" ? "Y" : status === "INACTIVE" ? "N" : "",
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

  return (
    <div className="page-container master-list-page">
      <section className="master-list-header">
        <div>
          <p className="page-eyebrow">
            MASTERS / PART MASTER
          </p>

          <h1>Part Master</h1>

          <span>
            View and maintain customer-linked part
            information.
          </span>
        </div>

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
      </section>

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
                <th>Revision</th>
                <th>Material</th>
                <th>Status</th>
                <th className="master-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>
                    <div className="master-table-message">
                      Loading parts...
                    </div>
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={9}>
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
                parts.map((part) => (
                  <tr key={part.partId}>
                    <td>
                      <strong>
                        {part.partNumber}
                      </strong>
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
                      {part.drawingRevisionNumber ||
                        "-"}
                    </td>

                    <td>
                      {part.materialSpecification ||
                        "-"}
                    </td>

                    <td>
                      <span
                        className={`master-status-badge ${
                          part.partStatus === "ACTIVE"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {part.partStatus}
                      </span>
                    </td>

                    <td>
                      <div className="master-row-actions">
                        <button
                          type="button"
                          title="View part"
                          onClick={() =>
                            navigate(`/masters/parts/${part.partId}?mode=view`)
                          }
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          title="Edit part"
                          onClick={() =>
                            navigate(
                              `/masters/parts/${part.partId}?mode=edit`
                            )
                          }
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
      </section>
    </div>
  );
}
