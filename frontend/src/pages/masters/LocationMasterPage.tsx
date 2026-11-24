import { MapPin, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiMessage } from "../../api/client";
import { locationMasterApi, type LocationMasterRow } from "../../api/locationMaster.api";
import { useAppFeedback } from "../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { useUnsavedChanges } from "../../components/UnsavedChanges";
import "./CustomerPage.css";
import "./TechnicalMasterPage.css";

type FormState = { warehouseName: string; subinventoryCode: string; locationName: string; activeFlag: "Y" | "N" };
type SubinventoryOption = { subinventoryCode: string; subinventoryName: string };
const blank = (): FormState => ({ warehouseName: "", subinventoryCode: "GENERAL", locationName: "", activeFlag: "Y" });

export default function LocationMasterPage() {
  const { confirmDelete, showSuccess } = useAppFeedback();
  const [rows, setRows] = useState<LocationMasterRow[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  const [subinventoryOptions, setSubinventoryOptions] = useState<SubinventoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"Y" | "N" | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [form, setForm] = useState<FormState>(blank);
  const unsaved = useUnsavedChanges(form, undefined, editorOpen && !isReadOnly);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await locationMasterApi.list({ search, status, page, pageSize: PAGE_SIZE });
      setRows(response?.data || []);
      setTotal(Number(response?.meta?.total || 0));
    } catch (loadError) {
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadWarehouses = useCallback(async () => {
    try {
      const response = await locationMasterApi.warehouses();
      setWarehouseOptions((response?.data || []).map((row: { warehouseName: string }) => row.warehouseName));
    } catch {
      setWarehouseOptions([]);
    }
  }, []);

  useEffect(() => { void loadWarehouses(); }, [loadWarehouses]);

  useEffect(() => {
    let active = true;
    void locationMasterApi.subinventories()
      .then((response) => { if (active) setSubinventoryOptions(response?.data || []); })
      .catch(() => { if (active) setSubinventoryOptions([]); });
    return () => { active = false; };
  }, []);

  const openNew = () => {
    unsaved.markSaved();
    setEditingId(null);
    setIsReadOnly(false);
    setForm(blank());
    setError("");
    setEditorOpen(true);
  };
  const openEdit = (row: LocationMasterRow) => {
    unsaved.markSaved();
    setEditingId(row.locationMasterId);
    setIsReadOnly(false);
    setForm({ warehouseName: row.warehouseName, subinventoryCode: row.subinventoryCode || "GENERAL", locationName: row.locationName, activeFlag: row.activeFlag });
    setError("");
    setEditorOpen(true);
  };
  const openView = (row: LocationMasterRow) => {
    unsaved.markSaved();
    setEditingId(row.locationMasterId);
    setIsReadOnly(true);
    setForm({ warehouseName: row.warehouseName, subinventoryCode: row.subinventoryCode || "GENERAL", locationName: row.locationName, activeFlag: row.activeFlag });
    setError("");
    setEditorOpen(true);
  };
  const close = () => unsaved.requestLeave(() => setEditorOpen(false));
  const save = async () => {
    if (isReadOnly) return;
    const savedSnapshot = unsaved.snapshot();
    try {
      setSaving(true);
      setError("");
      const response = editingId
        ? await locationMasterApi.update(editingId, form)
        : await locationMasterApi.create(form);
      unsaved.markSaved(savedSnapshot);
      showSuccess(response?.message || "Location Master saved successfully.");
      setEditorOpen(false);
      setEditingId(null);
      setIsReadOnly(false);
      setForm(blank());
      await load();
      await loadWarehouses();
    } catch (saveError) {
      setError(apiMessage(saveError));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row: LocationMasterRow) => {
    const confirmed = await confirmDelete({
      title: "Delete Location?",
      message: `${row.locationName} will be deactivated and cannot be selected for new transactions. Existing records will be kept.`,
      confirmLabel: "Deactivate Location",
    });
    if (!confirmed) return;
    try {
      setError("");
      const response = await locationMasterApi.update(row.locationMasterId, { warehouseName: row.warehouseName, subinventoryCode: row.subinventoryCode || "GENERAL", locationName: row.locationName, activeFlag: "N" });
      showSuccess(response?.message || "Location deactivated successfully.");
      await load();
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  };

  return <div className="page-container master-list-page technical-master-page location-master-page">
    <section className="master-list-header">
      <div><p className="page-eyebrow">MASTERS / LOCATION MASTER</p><h1>Location Master</h1><span>Maintain the approved warehouse, sub-inventory, and bin combinations used across the plant.</span></div>
      <button type="button" className="primary-action-button" onClick={() => unsaved.requestLeave(openNew)}><Plus size={17} />New Location</button>
    </section>
    <section className="master-list-card">
      {error && <div className="marketing-form-alert error">{error}</div>}
      {editorOpen && <div className="technical-master-editor">
        <div className="technical-editor-heading"><div><MapPin size={30} /><div><strong>{isReadOnly ? "View Location" : editingId ? "Edit Location" : "Create Location"}</strong><span>Warehouse, sub-inventory, and location / rack are required.</span></div></div><button type="button" aria-label="Close" onClick={close}><X size={17} /></button></div>
        <fieldset className="master-read-only-fields" disabled={isReadOnly}><div className="technical-editor-grid">
          <label><span>Warehouse *</span><input autoFocus list="location-master-warehouses" value={form.warehouseName} onChange={(event) => setForm((current) => ({ ...current, warehouseName: event.target.value }))} placeholder="Main Stores" /><datalist id="location-master-warehouses">{warehouseOptions.map((warehouseName) => <option key={warehouseName} value={warehouseName} />)}</datalist></label>
          <label><span>Sub-inventory *</span><select value={form.subinventoryCode} onChange={(event) => setForm((current) => ({ ...current, subinventoryCode: event.target.value }))}><option value="">Select sub-inventory</option>{form.subinventoryCode && !subinventoryOptions.some((entry) => entry.subinventoryCode === form.subinventoryCode) && <option value={form.subinventoryCode}>Existing: {form.subinventoryCode}</option>}{subinventoryOptions.map((entry) => <option key={entry.subinventoryCode} value={entry.subinventoryCode}>{entry.subinventoryName} ({entry.subinventoryCode})</option>)}</select></label>
          <label><span>Location / Rack / Bin *</span><input value={form.locationName} onChange={(event) => setForm((current) => ({ ...current, locationName: event.target.value }))} placeholder="Gauge Rack1" /></label>
          <label><span>Status *</span><select value={form.activeFlag} onChange={(event) => setForm((current) => ({ ...current, activeFlag: event.target.value as "Y" | "N" }))}><option value="Y">Active</option><option value="N">Inactive</option></select></label>
        </div></fieldset>
        <div className="technical-editor-actions"><button type="button" className="secondary-action-button" onClick={close}>{isReadOnly ? "Close" : "Cancel"}</button>{isReadOnly ? <button type="button" className="primary-action-button" onClick={() => setIsReadOnly(false)}><Pencil size={16} />Edit Location</button> : <button type="button" className="primary-action-button" disabled={saving} onClick={() => void save()}><Save size={16} />{saving ? "Saving..." : "Save Location"}</button>}</div>
      </div>}
      <div className="master-list-filter-row app-list-toolbar">
        <div className="master-search-box"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search warehouse or location" /></div>
        <select className="master-filter-select" value={status} onChange={(event) => { setStatus(event.target.value as "Y" | "N" | ""); setPage(1); }}><option value="">All Status</option><option value="Y">Active</option><option value="N">Inactive</option></select>
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="locations" disabled={loading} />
      </div>
      <div className="master-table-wrapper"><table className="master-data-table technical-master-table location-master-table"><thead><tr><th>Warehouse / Sub-inventory / Location</th><th>Status</th><th className="master-actions-column">Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={3}><div className="master-table-message">Loading...</div></td></tr> : rows.length === 0 ? <tr><td colSpan={3}><div className="master-empty-state"><div className="master-empty-icon"><MapPin size={28} /></div><h3>No locations found</h3><p>Create the first Warehouse, Sub-inventory, and Location Master record.</p></div></td></tr> : rows.map((row) => <tr key={row.locationMasterId}><td><div className="master-record-cell"><button type="button" className="master-record-edit" title="Edit location" aria-label={`Edit ${row.warehouseName} / ${row.subinventoryCode} / ${row.locationName}`} onClick={() => unsaved.requestLeave(() => openEdit(row))}><Pencil size={15} /></button><button type="button" className="master-record-link" title="View location" onClick={() => unsaved.requestLeave(() => openView(row))}>{row.warehouseName} / {row.subinventoryCode} / {row.locationName}</button></div></td><td><span className={`master-status-badge ${row.activeFlag === "Y" ? "active" : "inactive"}`}>{row.activeFlag === "Y" ? "ACTIVE" : "INACTIVE"}</span></td><td><div className="master-row-actions"><button type="button" title={row.activeFlag === "Y" ? "Delete location" : "Location is already inactive"} disabled={row.activeFlag !== "Y"} onClick={() => void remove(row)}><Trash2 size={16} /></button></div></td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}
