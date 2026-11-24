import { formatListDateTime } from "../../utils/formatDateTime";
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
import { customerApi } from "../../api/customer.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import { useAppFeedback } from "../../components/AppFeedback";
import { useAuth } from "../../context/AuthContext";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import "./CustomerPage.css";
type CustomerRow = {
  customerId: number;
  customerCode: string;
  customerName: string;
  plantCode: string;
  gstNumber: string;
  mobileNumber: string;
  email: string;
  customerStatus: "ACTIVE" | "INACTIVE" | "DRAFT";
  lastUpdated?: string | null;
};

export default function CustomerPage() {
  const referenceData = useReferenceData(["RECORD_STATUS"]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const isAdministrator = String(user?.roleName || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_") === "ADMINISTRATOR";

  const [customers, setCustomers] = useState<
    CustomerRow[]
  >([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true);
        setError("");
        const response = await customerApi.list({
          page,
          pageSize: PAGE_SIZE,
          search,
          activeFlag: status === "ACTIVE" ? "Y" : status === "INACTIVE" ? "N" : "",
          saveStatus: status === "DRAFT" ? "DRAFT" : status ? "SUBMITTED" : "",
          includeDraft: true,
        });
        const rows = response?.data ?? [];
        setTotal(Number(response?.meta?.total || 0));

        setCustomers(
          rows.map((row: any) => ({
            customerId: row.customerId,
            customerCode: row.customerCode ?? "",
            customerName: row.customerName ?? "",
            plantCode: row.plantCode ?? "",
            gstNumber: row.gstNumber ?? "",
            mobileNumber: row.mobileNumber ?? "",
            email: row.emailAddress ?? "",
            customerStatus: row.saveStatus === "DRAFT" ? "DRAFT" : row.customerStatus ??
              (row.activeFlag === "N" ? "INACTIVE" : "ACTIVE"),
            lastUpdated: row.lastUpdated ?? null,
          }))
        );
      } catch (loadError) {
        setError(apiMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadCustomers();
  }, [page, search, status]);

  const remove = async (customer: CustomerRow) => {
    const confirmed = await confirmDelete({
      title: "Delete Customer?",
      message: `${customer.customerName} will be deactivated and cannot be used in new transactions. Existing documents will be kept.`,
      confirmLabel: "Deactivate Customer",
    });
    if (!confirmed) return;
    try {
      setError("");
      await customerApi.changeStatus(customer.customerId, "INACTIVE");
      setCustomers((current) => current.filter((row) => row.customerId !== customer.customerId));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Customer deactivated successfully.");
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  const hardDelete = async (customer: CustomerRow) => {
    const confirmed = await confirmDelete({
      title: "Permanently delete customer?",
      message: `${customer.customerCode} · ${customer.customerName} will be permanently removed. This cannot be undone. If existing records refer to this customer, deletion will be blocked.`,
      confirmLabel: "Permanently Delete",
    });
    if (!confirmed) return;
    try {
      setError("");
      await customerApi.hardDelete(customer.customerId);
      setCustomers((current) => current.filter((row) => row.customerId !== customer.customerId));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess("Inactive customer permanently deleted.");
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  return (
    <div className="page-container master-list-page">
      <section className="master-list-header">
        <div>
          <p className="page-eyebrow">
            MASTERS / CUSTOMER MASTER
          </p>

          <h1>Customer Master</h1>

          <span>
            View and maintain customer
            information.
          </span>
        </div>

        <button
          type="button"
          className="primary-action-button"
          onClick={() =>
            navigate("/masters/customers/new")
          }
        >
          <Plus size={17} />
          New Customer
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
              placeholder="Search customer code or name"
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
        
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="customers" disabled={loading} />
      </div>

        <div className="master-table-wrapper">
          <table className="master-data-table customer-master-table">
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Customer Name</th>
                <th>Plant Code</th>
                <th>GST Number</th>
                <th>Mobile</th>
                <th>Status</th>
                <th className="app-last-updated-column">Last Updated</th>
                <th className="master-actions-column">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="master-table-message">
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="master-empty-state">
                      <div className="master-empty-icon">
                        <Building2 size={30} />
                      </div>

                      <h3>No customers found</h3>

                      <p>
                        Create your first customer or
                        supplier record.
                      </p>

                      <button
                        type="button"
                        className="primary-action-button"
                        onClick={() =>
                          navigate(
                            "/masters/customers/new"
                          )
                        }
                      >
                        <Plus size={17} />
                        Create Customer
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map(
                  (customer) => (
                    <tr key={customer.customerId}>
                      <td>
                        <div className="master-record-cell">
                          <button type="button" className="master-record-edit" title="Edit customer" aria-label={`Edit ${customer.customerCode}`} onClick={() => navigate(`/masters/customers/${customer.customerId}?mode=edit`)}><Pencil size={15} /></button>
                          <button type="button" className="master-record-link" title="View customer" onClick={() => navigate(`/masters/customers/${customer.customerId}?mode=view`)}>{customer.customerCode}</button>
                        </div>
                      </td>

                      <td>
                        {customer.customerName}
                      </td>

                      <td>
                        {customer.plantCode}
                      </td>

                      <td>{customer.gstNumber || "-"}</td>

                      <td>
                        {customer.mobileNumber || "-"}
                      </td>

                      <td>
                        <span
                          className={`master-status-badge ${
                            customer.customerStatus ===
                            "ACTIVE"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {customer.customerStatus}
                        </span>
                      </td>

                      <td className="app-last-updated-column">
                        {formatListDateTime(customer.lastUpdated)}
                      </td>

                      <td>
                        <div className="master-row-actions">
                          <button
                            type="button"
                            title={customer.customerStatus === "ACTIVE" ? "Deactivate customer" : isAdministrator ? "Permanently delete inactive customer" : "Only administrators can permanently delete inactive customers"}
                            aria-label={customer.customerStatus === "ACTIVE" ? `Deactivate ${customer.customerCode}` : `Permanently delete ${customer.customerCode}`}
                            disabled={customer.customerStatus !== "ACTIVE" && !isAdministrator}
                            onClick={() => void (customer.customerStatus === "ACTIVE" ? remove(customer) : hardDelete(customer))}
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
