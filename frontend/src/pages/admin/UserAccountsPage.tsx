import { FormEvent, useEffect, useState } from "react";

import { api, apiMessage } from "../../api/client";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import { useAuth } from "../../context/AuthContext";
import "./UserAccountsPage.css";

type UserAccount = {
  userId: number;
  username: string;
  displayName: string;
  role: "Administrator" | "Standard User";
  active: boolean;
  createdOn?: string;
};

const emptyForm = {
  displayName: "",
  username: "",
  role: "STANDARD_USER",
  password: "",
};

export default function UserAccountsPage() {
  const { user } = useAuth();
  const { showSuccess } = useAppFeedback();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdministrator = String(user?.roleName || "").trim().toUpperCase() === "ADMINISTRATOR";

  useEffect(() => {
    if (!isAdministrator) {
      setLoading(false);
      return undefined;
    }
    let current = true;
    api.get("/auth/users")
      .then((response) => {
        if (current) setAccounts(response.data?.data || []);
      })
      .catch((loadError) => {
        if (current) setError(apiMessage(loadError));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [isAdministrator]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await api.post("/auth/users", form);
      setAccounts((current) => [...current, response.data.data]);
      setForm(emptyForm);
      showSuccess("User account created successfully.");
    } catch (createError) {
      setError(apiMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdministrator) {
    return <div className="page-container"><Alert type="error" message="Only Administrators can manage user accounts." /></div>;
  }

  return (
    <div className="page-container user-accounts-page">
      <section className="user-accounts-header">
        <div>
          <p className="page-eyebrow">ADMINISTRATION / USER ACCOUNTS</p>
          <h1>User Accounts</h1>
          <span>Create Administrator and Standard User accounts for the application.</span>
        </div>
      </section>

      {error && <Alert type="error" message={error} />}

      <section className="user-accounts-card">
        <h2>Create account</h2>
        <form className="user-accounts-form" onSubmit={(event) => void createUser(event)}>
          <label>
            <span>Name</span>
            <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required maxLength={150} />
          </label>
          <label>
            <span>Username</span>
            <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} required maxLength={50} pattern="[A-Za-z0-9._-]{3,50}" title="3 to 50 letters, numbers, dots, underscores, or hyphens" />
          </label>
          <label>
            <span>Role</span>
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="STANDARD_USER">Standard User</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required minLength={12} maxLength={256} autoComplete="new-password" />
          </label>
          <button className="primary-action-button" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create account"}
          </button>
        </form>
      </section>

      <section className="user-accounts-card">
        <h2>Current accounts</h2>
        {loading ? <p>Loading accounts…</p> : (
          <div className="user-accounts-table-wrap">
            <table className="user-accounts-table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.userId}>
                    <td>{account.displayName}</td>
                    <td>{account.username}</td>
                    <td>{account.role}</td>
                    <td><span className={`user-account-status ${account.active ? "active" : "inactive"}`}>{account.active ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
                {!accounts.length && <tr><td colSpan={4}>No accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
