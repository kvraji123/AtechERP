import { formatListDateTime } from "../../utils/formatDateTime";
import {
  Building2,
  Eye,
  Pencil,
  Plus,
  Search,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { customerApi } from "../../api/customer.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import "./CustomerPage.css";
type CustomerRow = {
  customerId: number;
  customerCode: string;
  customerName: string;
  customerType: string;
  plantCode: string;
  gstNumber: string;
  mobileNumber: string;
  email: string;
  customerStatus: "ACTIVE" | "INACTIVE";
  lastUpdated?: string | null;
};

export default function CustomerPage() {
  const referenceData = useReferenceData(["RECORD_STATUS"]);
  const navigate = useNavigate();

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
        });
        const rows = response?.data ?? [];
        setTotal(Number(response?.meta?.total || 0));

        setCustomers(
          rows.map((row: any) => ({
            customerId: row.customerId,
            customerCode: row.customerCode ?? "",
            customerName: row.customerName ?? "",
            customerType: row.customerType ?? "",
            plantCode: row.plantCode ?? "",
            gstNumber: row.gstNumber ?? "",
            mobileNumber: row.mobileNumber ?? "",
            email: row.emailAddress ?? "",
            customerStatus: row.customerStatus ??
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
                <th>Customer Type</th>
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
                  <td colSpan={9}>
                    <div className="master-table-message">
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
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
                        <strong>
                          {customer.customerCode}
                        </strong>
                      </td>

                      <td>
                        {customer.customerName}
                      </td>

                      <td>
                        {customer.customerType}
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
                            title="View customer"
                            onClick={() =>
                              navigate(`/masters/customers/${customer.customerId}`)
                            }
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            title="Edit customer"
                            onClick={() =>
                              navigate(
                                `/masters/customers/${customer.customerId}`
                              )
                            }
                          >
                            <Pencil size={16} />
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
