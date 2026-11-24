import { Boxes, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../api/client";
import { itemApi } from "../../api/item.api";
import Alert from "../../components/Alert";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import { useAppFeedback } from "../../components/AppFeedback";
import { useReferenceData } from "../../hooks/useReferenceData";
import "./CustomerPage.css";
import "./ItemPage.css";

type ItemRow = {
  itemId: number; itemCode: string; itemDescription: string; groupName: string;
  typeName: string; materialName?: string; uomCode: string; inspectionRequired: "Y" | "N";
  itemStatus: "ACTIVE" | "INACTIVE"; supplierCount: number;
};
type Lookup = { itemGroupId: number; groupName: string };
type TypeLookup = { itemTypeId: number; itemGroupId: number; typeName: string };
type BulkUploadResult = {
  totalRows: number; importedCount: number;
  items: Array<{ row: number; itemCode: string; itemDescription: string }>;
  errors: Array<{ sheet?: string; row: number; message: string }>;
};

export default function ItemPage() {
  const referenceData = useReferenceData(["RECORD_STATUS", "YES_NO"]);
  const navigate = useNavigate();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [groups, setGroups] = useState<Lookup[]>([]);
  const [types, setTypes] = useState<TypeLookup[]>([]);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [inspection, setInspection] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([itemApi.list({
      page,
      pageSize: PAGE_SIZE,
      search,
      itemGroupId: groupId ? Number(groupId) : undefined,
      itemTypeId: typeId ? Number(typeId) : undefined,
      inspectionRequired: inspection as "Y" | "N" | "",
      activeFlag: status === "ACTIVE" ? "Y" : status === "INACTIVE" ? "N" : "",
    }), itemApi.lookups()])
      .then(([listResponse, lookupResponse]) => {
        setItems(Array.isArray(listResponse?.data) ? listResponse.data : []);
        setTotal(Number(listResponse?.meta?.total || 0));
        setGroups(lookupResponse?.data?.groups ?? []);
        setTypes(lookupResponse?.data?.types ?? []);
      })
      .catch((loadError) => setError(apiMessage(loadError)))
      .finally(() => setLoading(false));
  }, [page, search, groupId, typeId, inspection, status, reloadKey]);

  async function uploadItems(file: File | null) {
    if (!file) return;
    setError("");
    setBulkResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await itemApi.bulkUpload(formData);
      const result = response?.data as BulkUploadResult;
      setBulkResult(result);
      if (result?.importedCount) setReloadKey((value) => value + 1);
    } catch (uploadError) {
      setError(apiMessage(uploadError));
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  async function remove(item: ItemRow) {
    const confirmed = await confirmDelete({
      title: "Delete Item?",
      message: `${item.itemCode} will be deactivated and cannot be used in new transactions. Existing documents will be kept.`,
      confirmLabel: "Deactivate Item",
    });
    if (!confirmed) return;
    try {
      setError("");
      await itemApi.changeStatus(item.itemId, "INACTIVE");
      showSuccess("Item deactivated successfully.");
      setReloadKey((value) => value + 1);
    } catch (deleteError) {
      setError(apiMessage(deleteError));
    }
  }

  const filteredTypes = useMemo(() => types.filter((row) => !groupId || row.itemGroupId === Number(groupId)), [types, groupId]);
  return <div className="page-container master-list-page">
    <section className="master-list-header"><div><p className="page-eyebrow">MASTERS / ITEM MASTER</p>
      <h1>Item Master</h1><span>Maintain inventory, purchasing and production item information.</span></div>
      <div className="item-master-header-actions">
        <input ref={uploadInputRef} className="item-bulk-upload-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled onChange={(event) => void uploadItems(event.target.files?.[0] ?? null)}/>
        <button type="button" className="secondary-action-button" disabled title="Bulk upload will be enabled later."><Upload size={17}/>Upload Excel</button>
        <button type="button" className="primary-action-button" onClick={() => navigate("/masters/items/new")}><Plus size={17}/>New Item</button>
      </div>
    </section>
    <section className="master-list-card">
      {error && <Alert type="error" message={error}/>} 
      {bulkResult && <div className={`item-bulk-result ${bulkResult.errors.length ? "has-errors" : "is-success"}`}>
        {bulkResult.errors.length ? <><strong>No rows were imported.</strong><p>Correct these Excel rows and upload the file again.</p><ul>{bulkResult.errors.map((entry, index) => <li key={`${entry.sheet || "Item Master"}-${entry.row}-${index}`}><b>{entry.sheet || "Item Master"} row {entry.row}:</b> {entry.message}</li>)}</ul></> : <><strong>{bulkResult.importedCount} item(s) imported successfully.</strong><p>Item Codes were generated only after all rows passed validation.</p><ul>{bulkResult.items.map((item) => <li key={item.itemCode}><b>Row {item.row}:</b> {item.itemCode} — {item.itemDescription}</li>)}</ul></>}
      </div>}
      <div className="item-filter-grid app-list-toolbar">
        <div className="master-search-box"><Search size={18}/><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search item code, description or material"/></div>
        <select className="master-filter-select" value={groupId} onChange={(e) => { setGroupId(e.target.value); setTypeId(""); setPage(1); }}><option value="">All Groups</option>{groups.map((g) => <option key={g.itemGroupId} value={g.itemGroupId}>{g.groupName}</option>)}</select>
        <select className="master-filter-select" value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }}><option value="">All Types</option>{filteredTypes.map((t) => <option key={t.itemTypeId} value={t.itemTypeId}>{t.typeName}</option>)}</select>
        <select className="master-filter-select" value={inspection} onChange={(e) => { setInspection(e.target.value); setPage(1); }}><option value="">All Inspection</option>{referenceData.options("YES_NO").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="master-filter-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All Status</option>{referenceData.options("RECORD_STATUS").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="items" disabled={loading} />
      </div>
      <div className="master-table-wrapper"><table className="master-data-table item-master-table"><thead><tr>
        <th>Item Code</th><th>Description</th><th>Group</th><th>Item Category</th><th>Material</th><th>UOM</th><th>Suppliers</th><th>Inspection</th><th>Status</th><th className="master-actions-column">Actions</th>
      </tr></thead><tbody>{loading ? <tr><td colSpan={10}><div className="master-table-message">Loading items...</div></td></tr> : items.length === 0 ?
        <tr><td colSpan={10}><div className="master-empty-state"><div className="master-empty-icon"><Boxes size={30}/></div><h3>No items found</h3><p>Create your first Item Master record.</p><button type="button" className="primary-action-button" onClick={() => navigate("/masters/items/new")}><Plus size={17}/>Create Item</button></div></td></tr> :
        items.map((item) => <tr key={item.itemId}><td><div className="item-code-actions"><button type="button" className="item-code-edit" title="Edit item" aria-label={`Edit ${item.itemCode}`} onClick={() => navigate(`/masters/items/${item.itemId}?mode=edit`)}><Pencil size={15}/></button><button type="button" className="item-code-link" title="View item details" onClick={() => navigate(`/masters/items/${item.itemId}?mode=view`)}>{item.itemCode}</button></div></td><td>{item.itemDescription}</td><td>{item.groupName}</td><td>{item.typeName}</td><td>{item.materialName || "-"}</td><td>{item.uomCode}</td><td>{item.supplierCount}</td><td><span className={`item-inspection-badge ${item.inspectionRequired === "Y" ? "required" : "optional"}`}>{item.inspectionRequired === "Y" ? "YES" : "NO"}</span></td><td><span className={`master-status-badge ${item.itemStatus === "ACTIVE" ? "active" : "inactive"}`}>{item.itemStatus}</span></td><td><div className="master-row-actions"><button type="button" title={item.itemStatus === "ACTIVE" ? "Delete item" : "Item is already inactive"} disabled={item.itemStatus !== "ACTIVE"} onClick={() => void remove(item)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
      
    </section>
  </div>;
}
