import {
  Building2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { supplierApi } from "../../api/supplier.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import { useAppFeedback } from "../../components/AppFeedback";
import { useAuth } from "../../context/AuthContext";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import "./CustomerPage.css";
type SupplierRow = {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  supplierType: string;
  supplierCategory: string;
  city: string;
  state: string;
  mobileNumber: string;
  email: string;
  supplierStatus: "ACTIVE" | "INACTIVE" | "DRAFT";
};

const displaySupplierValue = (value: string) => value
  .replace(/_/g, " ")
  .toLowerCase()
  .replace(/\b\w/g, (character) => character.toUpperCase());

export default function SupplierPage() {
  const referenceData = useReferenceData(["RECORD_STATUS"]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const isAdministrator = String(user?.roleName || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_") === "ADMINISTRATOR";

  const [suppliers, setSuppliers] = useState<
    SupplierRow[]
  >([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSuppliers() {
      try {
        setLoading(true);
        setError("");
        const response = await supplierApi.list({
          page,
          pageSize: PAGE_SIZE,
          search,
          activeFlag: status === "ACTIVE" ? "Y" : status === "INACTIVE" ? "N" : "",
          saveStatus: status === "DRAFT" ? "DRAFT" : status ? "SUBMITTED" : "",
          includeDraft: true,
        });
        const rows = response?.data ?? [];
        setTotal(Number(response?.meta?.total || 0));

        setSuppliers(
          rows.map((row: any) => ({
            supplierId: row.supplierId,
            supplierCode: row.supplierCode ?? "",
            supplierName: row.supplierName ?? "",
            supplierType: row.supplierType ?? "",
            supplierCategory: row.supplierCategory ?? "",
            city: row.city ?? "",
            state: row.stateName ?? "",
            mobileNumber: row.mobileNumber ?? "",
            email: row.emailAddress ?? "",
            supplierStatus: row.saveStatus === "DRAFT" ? "DRAFT" : row.supplierStatus ??
              (row.activeFlag === "N" ? "INACTIVE" : "ACTIVE"),
          }))
        );
      } catch (loadError) {
        setError(apiMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadSuppliers();
  }, [page, search, status]);

  const remove = async (supplier: SupplierRow) => {
    const confirmed = await confirmDelete({
      title: "Delete Supplier?",
      message: `${supplier.supplierName} will be deactivated and cannot be used in new transactions. Existing documents will be kept.`,
      confirmLabel: "Deactivate Supplier",
    });
    if (!confirmed) return;
    try {
      setError("");
      await supplierApi.changeStatus(supplier.supplierId, "INACTIVE");
      setSuppliers((current) => current.filter((row) => row.supplierId !== supplier.supplierId));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Supplier deactivated successfully.");
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const hardDelete = async (supplier: SupplierRow) => {
    const confirmed = await confirmDelete({
      title: "Permanently delete supplier?",
      message: `${supplier.supplierCode} · ${supplier.supplierName} will be permanently removed. This cannot be undone. If existing records refer to this supplier, deletion will be blocked.`,
      confirmLabel: "Permanently Delete",
    });
    if (!confirmed) return;
    try {
      setError("");
      await supplierApi.hardDelete(supplier.supplierId);
      setSuppliers((current) => current.filter((row) => row.supplierId !== supplier.supplierId));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Inactive supplier permanently deleted.");
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  return (
    <div className="page-container master-list-page">
      <section className="master-list-header">
        <div>
          <p className="page-eyebrow">
            MASTERS / SUPPLIER MASTER
          </p>

          <h1>Supplier Master</h1>

          <span>
            View and maintain supplier
            information.
          </span>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={() =>
            navigate("/masters/suppliers/new")
          }
        >
          <Plus size={17} />
          New Supplier
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
              placeholder="Search code, supplier name, city or state"
            />
          </div>

          <select
            className="master-filter-select"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
          >
            <option value="">All Status</option>

            <option value="DRAFT">Draft</option>

            {referenceData.options("RECORD_STATUS").map((option) =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="suppliers" disabled={loading} />
      </div>

        <div className="master-table-wrapper">
          <table className="master-data-table customer-master-table">
            <thead>
              <tr>
                <th>Supplier Code</th>
                <th>Supplier Name</th>
                <th>Supplier Type</th>
                <th>Category / Process</th>

                <th>City</th>
                <th>State</th>
                <th>Mobile</th>
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
                      Loading suppliers...
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="master-empty-state">
                      <div className="master-empty-icon">
                        <Building2 size={30} />
                      </div>

                      <h3>No suppliers found</h3>

                      <p>
                        Create your first supplier or
                        supplier record.
                      </p>

                      <button
                        type="button"
                        className="primary-action-button"
                        onClick={() =>
                          navigate(
                            "/masters/suppliers/new"
                          )
                        }
                      >
                        <Plus size={17} />
                        Create Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map(
                  (supplier) => (
                    <tr key={supplier.supplierId}>
                      <td>
                        <div className="master-record-cell">
                          <button type="button" className="master-record-edit" title="Edit supplier" aria-label={`Edit ${supplier.supplierCode}`} onClick={() => navigate(`/masters/suppliers/${supplier.supplierId}?mode=edit`)}><Pencil size={15} /></button>
                          <button type="button" className="master-record-link" title="View supplier" onClick={() => navigate(`/masters/suppliers/${supplier.supplierId}?mode=view`)}>{supplier.supplierCode}</button>
                        </div>
                      </td>

                      <td>
                        {supplier.supplierName}
                      </td>

                      <td>
                        {displaySupplierValue(supplier.supplierType)}
                      </td>

                      <td>{supplier.supplierCategory ? displaySupplierValue(supplier.supplierCategory) : "—"}</td>

                      <td>{supplier.city}</td>

                      <td>{supplier.state}</td>

                      <td>
                        {supplier.mobileNumber || "-"}
                      </td>

                      <td>
                        <span
                          className={`master-status-badge ${
                            supplier.supplierStatus ===
                            "ACTIVE"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {supplier.supplierStatus}
                        </span>
                      </td>

                      <td>
                        <div className="master-row-actions">
                          <button
                            type="button"
                            title={supplier.supplierStatus === "ACTIVE" ? "Deactivate supplier" : isAdministrator ? "Permanently delete inactive supplier" : "Only administrators can permanently delete inactive suppliers"}
                            aria-label={supplier.supplierStatus === "ACTIVE" ? `Deactivate ${supplier.supplierCode}` : `Permanently delete ${supplier.supplierCode}`}
                            disabled={supplier.supplierStatus !== "ACTIVE" && !isAdministrator}
                            onClick={() => void (supplier.supplierStatus === "ACTIVE" ? remove(supplier) : hardDelete(supplier))}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
        
      </section>
    </div>
  );
}
