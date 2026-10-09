import { useUnsavedChanges } from "../../components/UnsavedChanges";
import { CircleX, Gauge, Pencil, Plus, Ruler, Save, Search, Settings2, Workflow, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiMessage } from "../../api/client";
import { technicalMasterApi, type OperationSourceOption, type TechnicalMasterKind } from "../../api/technicalMaster.api";
import { useAppFeedback } from "../../components/AppFeedback";
import Pagination, { PAGE_SIZE } from "../../components/Pagination";
import "./CustomerPage.css";
import "./TechnicalMasterPage.css";

type Props = { kind:TechnicalMasterKind };
type FormState = Record<string,string>;
type DispositionOption = { rejectionDispositionId:number; dispositionCode:string; dispositionName:string; partyAction:string; stockAction:string; activeFlag:string };

const settings = {
  operations:{ title:"Operation Name Master",eyebrow:"MASTERS / OPERATION NAME MASTER",description:"Maintain process operation names and their source.",newLabel:"New Operation" },
  instruments:{ title:"Instrument Master",eyebrow:"MASTERS / INSTRUMENT MASTER",description:"Maintain inspection instruments and gauges used in Inspection Plans.",newLabel:"New Instrument" },
  "tolerance-grades":{ title:"Tolerance Grade Master",eyebrow:"MASTERS / TOLERANCE GRADE MASTER",description:"Maintain tolerance grades, basic-size ranges and deviations in microns.",newLabel:"New Tolerance Range" },
  "rejection-reasons":{ title:"Rejection Reason Master",eyebrow:"MASTERS / QUALITY REJECTION REASONS",description:"Maintain standard reasons used when Quality rejects material from any receipt type.",newLabel:"New Rejection Reason" },
  "rejection-dispositions":{ title:"Rejection Disposition Master",eyebrow:"MASTERS / QUALITY REJECTION DISPOSITIONS",description:"Maintain the approved follow-up actions for rejected material.",newLabel:"New Disposition" },
} as const;

const receiptTypeOptions = [
  ["REGULAR_PURCHASE","Regular Purchase"],
  ["CUSTOMER_SUPPLIED","Customer Supplied"],
  ["OPEN_PURCHASE","Open Purchase"],
  ["OUTSOURCING_PRODUCT","Outsourcing Parts"],
] as const;

function blank(kind:TechnicalMasterKind):FormState {
  if (kind === "operations") return { operationCode:"",operationName:"",defaultSource:"",displayOrder:"0",activeFlag:"Y" };
  if (kind === "instruments") return { instrumentCode:"",instrumentName:"",activeFlag:"Y" };
  if (kind === "tolerance-grades") return { gradeCode:"",basicSizeFrom:"",basicSizeTo:"",lowerDeviationMicrons:"0",upperDeviationMicrons:"0",activeFlag:"Y" };
  if (kind === "rejection-reasons") return { reasonCode:"",reasonName:"",reasonCategory:"QUALITY",applicableReceiptTypes:"ALL",defaultDispositionId:"",requireRemarks:"Y",requireAttachment:"N",activeFlag:"Y" };
  return { dispositionCode:"",dispositionName:"",partyAction:"INTERNAL",stockAction:"QUARANTINE",activeFlag:"Y" };
}

function idOf(kind:TechnicalMasterKind,row:any) {
  if (kind === "operations") return Number(row.operationMasterId);
  if (kind === "instruments") return Number(row.instrumentMasterId);
  if (kind === "tolerance-grades") return Number(row.toleranceGradeId);
  return Number(kind === "rejection-reasons" ? row.rejectionReasonId : row.rejectionDispositionId);
}

function editForm(kind:TechnicalMasterKind,row:any):FormState {
  const seed = blank(kind);
  return Object.fromEntries(Object.keys(seed).map((key) => [key,String(row[key] ?? seed[key])])) as FormState;
}

function receiptTypesText(value:unknown) {
  const receiptTypes = String(value || "");
  if (!receiptTypes || receiptTypes === "ALL") return "All receipt types";
  const selected = new Set(receiptTypes.split(","));
  return receiptTypeOptions.filter(([code]) => selected.has(code)).map(([,label]) => label).join(", ");
}

export default function TechnicalMasterPage({kind}:Props) {
  const config = settings[kind];
  const { showSuccess } = useAppFeedback();
  const [rows,setRows] = useState<any[]>([]);
  const [sources,setSources] = useState<OperationSourceOption[]>([]);
  const [dispositions,setDispositions] = useState<DispositionOption[]>([]);
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState("");
  const [page,setPage] = useState(1);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [editingId,setEditingId] = useState<number|null>(null);
  const [editorOpen,setEditorOpen] = useState(false);
  const [form,setForm] = useState<FormState>(() => blank(kind));
  const unsaved = useUnsavedChanges(form, undefined, editorOpen);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [listResponse,sourceResponse,dispositionResponse] = await Promise.all([
        technicalMasterApi.list(kind,{search,status,page,pageSize:PAGE_SIZE}),
        kind === "operations" ? technicalMasterApi.listSources() : Promise.resolve({data:[]}),
        kind === "rejection-reasons" ? technicalMasterApi.list("rejection-dispositions",{status:"Y"}) : Promise.resolve({data:[]}),
      ]);
      setRows(listResponse?.data ?? []); setTotal(Number(listResponse?.meta?.total || 0));
      setSources(sourceResponse?.data ?? []);
      setDispositions(dispositionResponse?.data ?? []);
    } catch (loadError) { setError(apiMessage(loadError)); }
    finally { setLoading(false); }
  },[kind,search,status,page]);

  useEffect(() => { setSearch(""); setStatus(""); setPage(1); setRows([]); setEditorOpen(false); setEditingId(null); setForm(blank(kind)); },[kind]);
  useEffect(() => { const timer = window.setTimeout(() => void load(),200); return () => window.clearTimeout(timer); },[load]);

  const columns = useMemo(() => kind === "operations" ? 5 : kind === "instruments" ? 4 : kind === "tolerance-grades" ? 7 : kind === "rejection-reasons" ? 7 : 6,[kind]);
  const set = (name:string,value:string) => setForm((current) => ({...current,[name]:value}));
  const openNew = () => { unsaved.markSaved(); setEditingId(null); setForm(blank(kind)); setEditorOpen(true); setError(""); };
  const openEdit = (row:any) => { unsaved.markSaved(); setEditingId(idOf(kind,row)); setForm(editForm(kind,row)); setEditorOpen(true); setError(""); };
  const changeReceiptType = (receiptType:string,checked:boolean) => {
    const applicableReceiptTypes = form.applicableReceiptTypes || "ALL";
    const current = applicableReceiptTypes === "ALL" ? receiptTypeOptions.map(([code]) => code) : applicableReceiptTypes.split(",").filter(Boolean);
    const next = checked ? [...new Set([...current,receiptType])] : current.filter((entry) => entry !== receiptType);
    set("applicableReceiptTypes",next.length === receiptTypeOptions.length ? "ALL" : next.join(","));
  };
  const save = async () => {
    const savedSnapshot = unsaved.snapshot();
    try {
      setSaving(true); setError("");
      const response = editingId ? await technicalMasterApi.update(kind,editingId,form) : await technicalMasterApi.create(kind,form);
      unsaved.markSaved(savedSnapshot); showSuccess(response?.message || `${config.title} saved successfully.`);
      setEditorOpen(false); setEditingId(null); setForm(blank(kind)); await load();
    } catch (saveError) { setError(apiMessage(saveError)); }
    finally { setSaving(false); }
  };

  const icon = kind === "operations" ? <Settings2 size={30}/> : kind === "instruments" ? <Gauge size={30}/> : kind === "tolerance-grades" ? <Ruler size={30}/> : kind === "rejection-reasons" ? <CircleX size={30}/> : <Workflow size={30}/>;
  const applicableReceiptTypes = form.applicableReceiptTypes || "ALL";
  const selectedTypes = new Set(applicableReceiptTypes === "ALL" ? receiptTypeOptions.map(([code]) => code) : applicableReceiptTypes.split(",").filter(Boolean));
  return <div className="page-container master-list-page technical-master-page">
    <section className="master-list-header"><div><p className="page-eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><span>{config.description}</span></div><button type="button" className="primary-action-button" onClick={() => unsaved.requestLeave(openNew)}><Plus size={17}/>{config.newLabel}</button></section>
    <section className="master-list-card">
      {error && <div className="marketing-form-alert error">{error}</div>}
      {editorOpen && <div className="technical-master-editor"><div className="technical-editor-heading"><div>{icon}<div><strong>{editingId ? `Edit ${config.title}` : `Create ${config.title}`}</strong><span>Fields marked * are mandatory.</span></div></div><button type="button" onClick={() => unsaved.requestLeave(() => setEditorOpen(false))}><X size={17}/></button></div>
        <div className={`technical-editor-grid ${kind}`}>
          {kind === "operations" && <><label><span>Operation Code *</span><input value={form.operationCode} onChange={(event) => set("operationCode",event.target.value)} placeholder="MILLING"/></label><label><span>Operation Name *</span><input value={form.operationName} onChange={(event) => set("operationName",event.target.value)} placeholder="Milling"/></label><label><span>Source *</span><select value={form.defaultSource} onChange={(event) => set("defaultSource",event.target.value)}><option value="">Select source</option>{sources.map((source) => <option key={source.sourceCode} value={source.sourceCode}>{source.sourceName}</option>)}</select></label></>}
          {kind === "instruments" && <><label><span>Instrument Code *</span><input value={form.instrumentCode} onChange={(event) => set("instrumentCode",event.target.value)} placeholder="VERNIER"/></label><label><span>Instrument / Gauge Name *</span><input value={form.instrumentName} onChange={(event) => set("instrumentName",event.target.value)} placeholder="Vernier Caliper"/></label></>}
          {kind === "tolerance-grades" && <><label><span>Grade Code *</span><input value={form.gradeCode} onChange={(event) => set("gradeCode",event.target.value)} placeholder="H7"/></label><label><span>Basic Size From *</span><input type="number" min="0" step="0.0001" value={form.basicSizeFrom} onChange={(event) => set("basicSizeFrom",event.target.value)}/></label><label><span>Basic Size To *</span><input type="number" min="0" step="0.0001" value={form.basicSizeTo} onChange={(event) => set("basicSizeTo",event.target.value)}/></label><label><span>Lower Deviation (µm) *</span><input type="number" step="0.0001" value={form.lowerDeviationMicrons} onChange={(event) => set("lowerDeviationMicrons",event.target.value)}/></label><label><span>Upper Deviation (µm) *</span><input type="number" step="0.0001" value={form.upperDeviationMicrons} onChange={(event) => set("upperDeviationMicrons",event.target.value)}/></label></>}
          {kind === "rejection-dispositions" && <><label><span>Disposition Code *</span><input value={form.dispositionCode} onChange={(event) => set("dispositionCode",event.target.value)} placeholder="RETURN_TO_VENDOR"/></label><label><span>Follow-up Action *</span><input value={form.dispositionName} onChange={(event) => set("dispositionName",event.target.value)} placeholder="Return to vendor"/></label><label><span>Responsible party *</span><select value={form.partyAction} onChange={(event) => set("partyAction",event.target.value)}><option value="INTERNAL">Internal</option><option value="SUPPLIER">Supplier</option><option value="CUSTOMER">Customer</option></select></label><label><span>Stock action *</span><select value={form.stockAction} onChange={(event) => set("stockAction",event.target.value)}><option value="QUARANTINE">Quarantine</option><option value="RETURN">Return</option><option value="REWORK">Rework</option><option value="SCRAP">Scrap</option><option value="RELEASE">Release</option></select></label></>}
          {kind === "rejection-reasons" && <><label><span>Reason Code *</span><input value={form.reasonCode} onChange={(event) => set("reasonCode",event.target.value)} placeholder="DIMENSION_OUT"/></label><label><span>Reason *</span><input value={form.reasonName} onChange={(event) => set("reasonName",event.target.value)} placeholder="Dimension out of tolerance"/></label><label><span>Category *</span><select value={form.reasonCategory} onChange={(event) => set("reasonCategory",event.target.value)}><option value="QUALITY">Quality</option><option value="MATERIAL">Material</option><option value="QUANTITY">Quantity</option><option value="PACKING">Packing</option><option value="DOCUMENT">Document</option></select></label><label><span>Default follow-up</span><select value={form.defaultDispositionId} onChange={(event) => set("defaultDispositionId",event.target.value)}><option value="">Select when required</option>{dispositions.map((disposition) => <option key={disposition.rejectionDispositionId} value={disposition.rejectionDispositionId}>{disposition.dispositionName}</option>)}</select></label><label><span>Quality remarks *</span><select value={form.requireRemarks} onChange={(event) => set("requireRemarks",event.target.value)}><option value="Y">Required</option><option value="N">Optional</option></select></label><label><span>Attachment reference</span><select value={form.requireAttachment} onChange={(event) => set("requireAttachment",event.target.value)}><option value="N">Optional</option><option value="Y">Required</option></select></label><div className="technical-receipt-type-picker"><span>Applicable receipt types *</span><div>{receiptTypeOptions.map(([receiptType,label]) => <label key={receiptType}><input type="checkbox" checked={selectedTypes.has(receiptType)} onChange={(event) => changeReceiptType(receiptType,event.target.checked)}/>{label}</label>)}</div></div></>}
          <label><span>Status *</span><select value={form.activeFlag} onChange={(event) => set("activeFlag",event.target.value)}><option value="Y">Active</option><option value="N">Inactive</option></select></label>
        </div><div className="technical-editor-actions"><button type="button" className="secondary-action-button" onClick={() => unsaved.requestLeave(() => setEditorOpen(false))}>Cancel</button><button type="button" className="primary-action-button" disabled={saving} onClick={() => void save()}><Save size={16}/>{saving ? "Saving..." : "Save"}</button></div></div>}
      <div className="master-list-filter-row app-list-toolbar"><div className="master-search-box"><Search size={18}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${config.title.toLowerCase()}`}/></div><select className="master-filter-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All Status</option><option value="Y">Active</option><option value="N">Inactive</option></select>
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="records" disabled={loading}/>
      </div>
      <div className="master-table-wrapper"><table className="master-data-table technical-master-table"><thead>{kind === "operations" ? <tr><th>Operation Code</th><th>Operation Name</th><th>Source</th><th>Status</th><th className="master-actions-column">Actions</th></tr> : kind === "instruments" ? <tr><th>Instrument Code</th><th>Instrument / Gauge Name</th><th>Status</th><th className="master-actions-column">Actions</th></tr> : kind === "tolerance-grades" ? <tr><th>Grade</th><th>Basic Size From</th><th>Basic Size To</th><th>Lower Dev. (µm)</th><th>Upper Dev. (µm)</th><th>Status</th><th className="master-actions-column">Actions</th></tr> : kind === "rejection-reasons" ? <tr><th>Reason Code</th><th>Rejection Reason</th><th>Category</th><th>Receipt Types</th><th>Default Follow-up</th><th>Status</th><th className="master-actions-column">Actions</th></tr> : <tr><th>Disposition Code</th><th>Follow-up Action</th><th>Responsible Party</th><th>Stock Action</th><th>Status</th><th className="master-actions-column">Actions</th></tr>}</thead>
        <tbody>{loading ? <tr><td colSpan={columns}><div className="master-table-message">Loading...</div></td></tr> : rows.length === 0 ? <tr><td colSpan={columns}><div className="master-empty-state"><div className="master-empty-icon">{icon}</div><h3>No records found</h3><p>Create the first {config.title} record.</p></div></td></tr> : rows.map((row) => <tr key={idOf(kind,row)}>{kind === "operations" ? <><td><strong>{row.operationCode}</strong></td><td>{row.operationName}</td><td>{row.sourceName || row.defaultSource}</td></> : kind === "instruments" ? <><td><strong>{row.instrumentCode}</strong></td><td>{row.instrumentName}</td></> : kind === "tolerance-grades" ? <><td><strong>{row.gradeCode}</strong></td><td>{row.basicSizeFrom}</td><td>{row.basicSizeTo}</td><td>{row.lowerDeviationMicrons}</td><td>{row.upperDeviationMicrons}</td></> : kind === "rejection-reasons" ? <><td><strong>{row.reasonCode}</strong></td><td>{row.reasonName}</td><td>{row.reasonCategory}</td><td>{receiptTypesText(row.applicableReceiptTypes)}</td><td>{row.defaultDispositionName || "—"}</td></> : <><td><strong>{row.dispositionCode}</strong></td><td>{row.dispositionName}</td><td>{row.partyAction}</td><td>{row.stockAction}</td></>}<td><span className={`master-status-badge ${row.activeFlag === "Y" ? "active" : "inactive"}`}>{row.activeFlag === "Y" ? "ACTIVE" : "INACTIVE"}</span></td><td><div className="master-row-actions"><button type="button" title="Edit" onClick={() => unsaved.requestLeave(() => openEdit(row))}><Pencil size={16}/></button></div></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
