import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ArrowLeftRight, CheckCircle2, ClipboardList, FileText, PackageOpen, RefreshCw, Send, ShieldCheck, Truck } from "lucide-react";
import { apiMessage } from "../../../api/client";
import { inventoryApi } from "../../../api/inventory.api";
import { customerApi } from "../../../api/customer.api";
import { marketingApi } from "../../../api/marketing.api";
import { useReferenceData } from "../../../hooks/useReferenceData";
import { formatDateTime, todayInAppTimeZone } from "../../../utils/formatDateTime";
import "./CustomerMaterialControlPage.css";

type Row = Record<string, unknown>;
type Movement = "issue" | "return" | "consume";

const number = (value: unknown) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const text = (value: unknown) => String(value ?? "—");
const today = todayInAppTimeZone;
const dateTime = formatDateTime;

export default function CustomerMaterialControlPage() {
  const location = useLocation();
  const referenceData = useReferenceData(["TRANSPORT_MODE"]);
  const returnView = location.pathname.endsWith("/return-to-customer");
  const [stock, setStock] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [enquiries, setEnquiries] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [movement, setMovement] = useState<{ kind: Movement; row: Row } | null>(null);
  const [jobReference, setJobReference] = useState("");
  const [enquiryId, setEnquiryId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementDate, setMovementDate] = useState(today());
  const [movementReference, setMovementReference] = useState("");
  const [movementRemarks, setMovementRemarks] = useState("");
  const [selectedReturns, setSelectedReturns] = useState<Record<string, number>>({});
  const [returnDate, setReturnDate] = useState(today());
  const [dispatchReference, setDispatchReference] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [transportReference, setTransportReference] = useState("");
  const [allowedTransportModes, setAllowedTransportModes] = useState<string[]>([]);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [workflow, setWorkflow] = useState<Row | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [acknowledgementReference, setAcknowledgementReference] = useState("");
  const [gateExitReference, setGateExitReference] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      if (returnView) {
        const [rejectionResponse, documentResponse] = await Promise.all([
          inventoryApi.rejectionInventory({ search, ownerType: "CUSTOMER", status: "OPEN", limit: 200 }),
          inventoryApi.customerReturnDocuments({ search, limit: 200 }),
        ]);
        setRejected(Array.isArray(rejectionResponse.data) ? rejectionResponse.data : []);
        setDocuments(Array.isArray(documentResponse.data) ? documentResponse.data : []);
      } else {
        const [response, enquiryResponse] = await Promise.all([
          inventoryApi.customerStock({ search, limit: 200 }),
          marketingApi.list({ pageSize: 100 }),
        ]);
        setStock(Array.isArray(response.data?.stock) ? response.data.stock : []);
        setJobs(Array.isArray(response.data?.jobs) ? response.data.jobs : []);
        setEnquiries(Array.isArray(enquiryResponse.data) ? enquiryResponse.data : []);
      }
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  }, [returnView, search]);

  useEffect(() => { void load(); }, [load]);

  const openMovement = (kind: Movement, row: Row) => {
    setError(""); setNotice(""); setMovement({ kind, row }); setMovementQuantity(""); setMovementDate(today());
    setMovementReference(""); setMovementRemarks("");
    setJobReference(kind === "issue" ? "" : text(row.jobReference)); setEnquiryId(kind === "issue" ? "" : text(row.enquiryId || ""));
  };

  const submitMovement = async () => {
    if (!movement) return;
    const quantity = Number(movementQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !movementRemarks.trim()) {
      setError("Enter a valid quantity and movement remarks."); return;
    }
    try {
      setSaving(true); setError("");
      const common = { quantity, transactionDate: movementDate, referenceNumber: movementReference, remarks: movementRemarks };
      if (movement.kind === "issue") {
        if (!jobReference.trim()) { setError("Job or process reference is required."); return; }
        await inventoryApi.issueCustomerMaterialToJob({ ...common, stockBalanceId: Number(movement.row.inventoryStockBalanceId), jobReference, enquiryId: enquiryId ? Number(enquiryId) : null });
        setNotice("Customer material issued to the job. It is now tracked as customer-owned WIP.");
      } else if (movement.kind === "return") {
        await inventoryApi.returnCustomerMaterialFromJob({ ...common, customerMaterialJobBalanceId: Number(movement.row.customerMaterialJobBalanceId) });
        setNotice("Unused customer material returned from the job to customer-owned stock.");
      } else {
        await inventoryApi.consumeCustomerMaterialForJob({ ...common, customerMaterialJobBalanceId: Number(movement.row.customerMaterialJobBalanceId) });
        setNotice("Customer material consumption recorded against the job.");
      }
      setMovement(null); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  const selectedRows = useMemo(() => rejected.filter((row) => selectedReturns[String(row.id)]), [rejected, selectedReturns]);
  const selectedCustomerId = selectedRows.length ? String(selectedRows[0].stockOwnerId) : "";
  const transportOptions = referenceData.options("TRANSPORT_MODE").filter((option) => allowedTransportModes.includes(option.value));
  useEffect(() => {
    const customerId = Number(selectedCustomerId || 0);
    if (!customerId) { setAllowedTransportModes([]); setTransportMode(""); return; }
    let active = true;
    customerApi.getById(customerId).then((response) => {
      if (active) setAllowedTransportModes(Array.isArray(response?.data?.transportModes) ? response.data.transportModes : []);
    }).catch(() => { if (active) setAllowedTransportModes([]); });
    return () => { active = false; };
  }, [selectedCustomerId]);
  const toggleReturn = (row: Row, checked: boolean) => {
    const id = String(row.id);
    if (checked && selectedCustomerId && selectedCustomerId !== String(row.stockOwnerId)) {
      setError("Create a separate Return-to-Customer document for each customer."); return;
    }
    setError("");
    setSelectedReturns((current) => {
      const next = { ...current };
      if (checked) next[id] = Number(row.availableQuantity || row.quantityOnHand || 0);
      else delete next[id];
      return next;
    });
  };

  const setReturnQuantity = (id: string, quantity: number) => setSelectedReturns((current) => ({ ...current, [id]: quantity }));
  const createReturnDocument = async () => {
    if (!selectedRows.length || !returnRemarks.trim() || !transportMode) { setError("Select at least one rejected line, an actual transport mode and return remarks."); return; }
    const invalid = selectedRows.some((row) => {
      const quantity = Number(selectedReturns[String(row.id)]); const available = Number(row.availableQuantity || row.quantityOnHand || 0);
      return !Number.isFinite(quantity) || quantity <= 0 || quantity > available;
    });
    if (invalid) { setError("Each selected quantity must be greater than zero and within the available quarantined quantity."); return; }
    try {
      setSaving(true); setError("");
      const response = await inventoryApi.createReturnToCustomerDocument({
        returnDate, dispatchReference, transportMode, transportReference, remarks: returnRemarks,
        items: selectedRows.map((row) => ({ balanceId: Number(row.id), quantity: Number(selectedReturns[String(row.id)]) })),
      });
      setNotice(`${response.data?.rtcNumber || "Return-to-Customer document"} submitted for approval.`);
      setSelectedReturns({}); setReturnRemarks(""); setDispatchReference(""); setTransportMode(""); setTransportReference(""); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  const openWorkflow = (row: Row) => {
    setWorkflow(row); setError(""); setNotice(""); setApprovalRemarks(text(row.approvalRemarks || ""));
    setCustomerContact(text(row.customerContact || "")); setAcknowledgementReference(text(row.acknowledgementReference || ""));
    setGateExitReference(text(row.gateExitReference || ""));
  };
  const runWorkflow = async (action: "approve" | "acknowledge" | "dispatch") => {
    if (!workflow) return;
    const documentId = Number(workflow.returnToCustomerDocumentId);
    if (action === "acknowledge" && (!customerContact.trim() || !acknowledgementReference.trim())) { setError("Customer contact and acknowledgement reference are required."); return; }
    if (action === "dispatch" && !gateExitReference.trim()) { setError("Gate exit or delivery challan reference is required before dispatch."); return; }
    try {
      setSaving(true); setError("");
      const response = action === "approve"
        ? await inventoryApi.approveReturnToCustomerDocument(documentId, { approvalRemarks })
        : action === "acknowledge"
          ? await inventoryApi.acknowledgeReturnToCustomerDocument(documentId, { customerContact, acknowledgementReference })
          : await inventoryApi.dispatchReturnToCustomerDocument(documentId, { gateExitReference });
      const result = response.data || {};
      setWorkflow((current) => current ? { ...current, documentStatus: result.documentStatus, fileUrl: result.fileUrl, customerContact: result.customerContact, acknowledgementReference: result.acknowledgementReference, gateExitReference: result.gateExitReference } : current);
      setNotice(action === "approve" ? "RTC approved and PDF generated." : action === "acknowledge" ? "Customer acknowledgement recorded." : "RTC dispatched; rejected customer material was removed from quarantine.");
      await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  return <main className="customer-material-page">
    <header className="customer-material-header"><h1>{returnView ? "Return to Customer" : "Customer-Owned Stock & WIP"}</h1><button type="button" onClick={() => void load()}><RefreshCw size={16}/>Refresh</button></header>
    <nav className="customer-material-tabs" aria-label="Customer material navigation">
      <NavLink to="/inventory" end><PackageOpen size={16}/>Company inventory</NavLink>
      <NavLink to="/inventory/customer-material"><ClipboardList size={16}/>Customer stock & WIP</NavLink>
      <NavLink to="/inventory/return-to-customer"><Send size={16}/>Return to customer</NavLink>
    </nav>
    <form className="customer-material-search" onSubmit={(event) => { event.preventDefault(); void load(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, job, enquiry, GRN or item"/><button type="submit">Search</button></form>
    {error && <div className="customer-material-error">{error}</div>}{notice && <div className="customer-material-notice"><CheckCircle2 size={17}/>{notice}</div>}
    {returnView ? <>
      <section className="customer-material-card customer-material-card--return"><div className="customer-material-section-head"><div><h2>Select rejected customer material</h2><p>All selected lines must belong to one customer. The quantity remains in quarantine until approval, acknowledgement and dispatch.</p></div><strong>{selectedRows.length} line(s) selected</strong></div>
        <div className="customer-material-table-wrap"><table><thead><tr><th>Select</th><th>GRN / item</th><th>Customer</th><th>Available in quarantine</th><th>Return quantity</th><th className="app-last-updated-column">Last Updated</th><th>Reason</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading customer rejection inventory…</td></tr> : rejected.length ? rejected.map((row) => { const id = String(row.id); const selected = Boolean(selectedReturns[id]); return <tr key={id}><td><input aria-label={`Select ${text(row.itemCode)}`} type="checkbox" checked={selected} onChange={(event) => toggleReturn(row, event.target.checked)}/></td><td><strong>{text(row.grnNumber)}</strong><small>{text(row.itemCode)} · {text(row.itemDescription)}</small></td><td>{text(row.stockOwnerName)}</td><td>{number(row.availableQuantity || row.quantityOnHand)} {text(row.uomCode)}</td><td><input className="customer-quantity" type="number" min="0.001" step="0.001" max={Number(row.availableQuantity || row.quantityOnHand || 0)} disabled={!selected} value={selected ? selectedReturns[id] : ""} onChange={(event) => setReturnQuantity(id, Number(event.target.value))}/></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td><td>{text(row.rejectionReason)}</td></tr>; }) : <tr><td colSpan={7}>No open customer-owned rejected material is awaiting return.</td></tr>}</tbody></table></div>
        {selectedRows.length > 0 && <div className="customer-return-create"><label>Planned return date<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)}/></label><label>Dispatch reference<input value={dispatchReference} onChange={(event) => setDispatchReference(event.target.value)} placeholder="Planned challan or courier reference"/></label><label>Actual transport mode *<select value={transportMode} onChange={(event) => setTransportMode(event.target.value)} disabled={!transportOptions.length}><option value="">{transportOptions.length ? "Select actual transport mode" : "No allowed mode set for customer"}</option>{transportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Transport / vehicle<input value={transportReference} onChange={(event) => setTransportReference(event.target.value)} placeholder="Vehicle number or carrier"/></label><label className="wide">Return remarks *<textarea value={returnRemarks} onChange={(event) => setReturnRemarks(event.target.value)} placeholder="State the return decision and handling instruction"/></label><button type="button" disabled={saving} onClick={() => void createReturnDocument()}><FileText size={16}/>{saving ? "Creating…" : "Create RTC for approval"}</button></div>}
      </section>
      <CustomerReturnDocuments rows={documents} loading={loading} onManage={openWorkflow}/>
      {workflow && <ReturnWorkflowPanel row={workflow} saving={saving} approvalRemarks={approvalRemarks} customerContact={customerContact} acknowledgementReference={acknowledgementReference} gateExitReference={gateExitReference} onClose={() => setWorkflow(null)} onApprovalRemarks={setApprovalRemarks} onCustomerContact={setCustomerContact} onAcknowledgementReference={setAcknowledgementReference} onGateExitReference={setGateExitReference} onRun={runWorkflow}/>}</> : <>
      <section className="customer-material-card customer-material-card--stock"><div className="customer-material-section-head"><div><h2>Customer-owned stock</h2><p>Customer-supplied items are listed here before receipt, then become available only after stock is received.</p></div><strong>{number(stock.reduce((total, row) => total + Number(row.quantityOnHand || 0), 0))} total</strong></div>
        <div className="customer-material-table-wrap"><table><thead><tr><th>Customer</th><th>Item</th><th>Store location</th><th>Available</th><th className="app-last-updated-column">Last Updated</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading customer-owned stock…</td></tr> : stock.length ? stock.map((row) => <tr key={String(row.id)}><td><strong>{text(row.customerName)}</strong><small>{text(row.customerCode)}</small></td><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small></td><td>{text(row.warehouseCode)}<small>{text(row.binLocation)}{row.batchSerialNumber ? ` · ${text(row.batchSerialNumber)}` : ""}</small></td><td>{number(row.quantityOnHand)} {text(row.uomCode)}</td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td><td>{row.inventoryStockBalanceId ? <button type="button" className="customer-link-button" onClick={() => openMovement("issue", row)}>Issue to job</button> : <span className="customer-stock-awaiting-receipt">Awaiting receipt</span>}</td></tr>) : <tr><td colSpan={6}>No customer-owned material is currently available in stores.</td></tr>}</tbody></table></div>
      </section>
      <section className="customer-material-card customer-material-card--wip"><div className="customer-material-section-head"><div><h2>Customer material in jobs / WIP</h2><p>Record use or return of material issued to a customer enquiry, job or process reference.</p></div><strong>{number(jobs.reduce((total, row) => total + Number(row.quantityInProcess || 0), 0))} in WIP</strong></div>
        <div className="customer-material-table-wrap"><table><thead><tr><th>Customer / job</th><th>Enquiry</th><th>Item</th><th>Held by job</th><th className="app-last-updated-column">Last Updated</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading customer WIP…</td></tr> : jobs.length ? jobs.map((row) => <tr key={String(row.id)}><td><strong>{text(row.customerName)}</strong><small>{text(row.jobReference)}</small></td><td>{text(row.enquiryNumber || "No linked enquiry")}</td><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small></td><td>{number(row.quantityInProcess)} {text(row.uomCode)}</td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td><td><div className="customer-inline-actions"><button type="button" className="customer-link-button" onClick={() => openMovement("return", row)}>Return unused</button><button type="button" className="customer-link-button" onClick={() => openMovement("consume", row)}>Record consumption</button></div></td></tr>) : <tr><td colSpan={6}>No customer-owned material is currently allocated to jobs.</td></tr>}</tbody></table></div>
      </section>
      {movement && <MovementPanel movement={movement} enquiries={enquiries} quantity={movementQuantity} transactionDate={movementDate} jobReference={jobReference} enquiryId={enquiryId} reference={movementReference} remarks={movementRemarks} saving={saving} onClose={() => setMovement(null)} onQuantity={setMovementQuantity} onDate={setMovementDate} onJobReference={setJobReference} onEnquiryId={setEnquiryId} onReference={setMovementReference} onRemarks={setMovementRemarks} onSubmit={() => void submitMovement()}/>}</>}
  </main>;
}

function MovementPanel({ movement, enquiries, quantity, transactionDate, jobReference, enquiryId, reference, remarks, saving, onClose, onQuantity, onDate, onJobReference, onEnquiryId, onReference, onRemarks, onSubmit }: { movement:{ kind:Movement; row:Row }; enquiries:Row[]; quantity:string; transactionDate:string; jobReference:string; enquiryId:string; reference:string; remarks:string; saving:boolean; onClose:()=>void; onQuantity:(value:string)=>void; onDate:(value:string)=>void; onJobReference:(value:string)=>void; onEnquiryId:(value:string)=>void; onReference:(value:string)=>void; onRemarks:(value:string)=>void; onSubmit:()=>void }) {
  const issue = movement.kind === "issue"; const consume = movement.kind === "consume"; const maximum = Number(issue ? movement.row.quantityOnHand : movement.row.quantityInProcess || 0);
  const customerEnquiries = enquiries.filter((enquiry) => Number(enquiry.customerId) === Number(movement.row.customerId));
  return <section className="customer-material-panel"><header><div><span>{issue ? "Issue customer material" : consume ? "Record customer material consumption" : "Return unused customer material"}</span><h2>{text(movement.row.itemCode)} · {text(movement.row.customerName)}</h2><p>Maximum quantity: {number(maximum)} {text(movement.row.uomCode)}.</p></div><button type="button" onClick={onClose}>Close</button></header><div className="customer-panel-grid">{issue && <><label>Job / process reference *<input value={jobReference} onChange={(event) => onJobReference(event.target.value)} placeholder="Job card or process reference"/></label><label>Customer enquiry<select value={enquiryId} onChange={(event) => onEnquiryId(event.target.value)}><option value="">No linked enquiry</option>{customerEnquiries.map((enquiry) => <option key={String(enquiry.enquiryId)} value={String(enquiry.enquiryId)}>{text(enquiry.docNo)} · {text(enquiry.enquiryStatus)}</option>)}</select></label></>}<label>Quantity *<input type="number" min="0.001" step="0.001" max={maximum} value={quantity} onChange={(event) => onQuantity(event.target.value)}/></label><label>Movement date *<input type="date" value={transactionDate} onChange={(event) => onDate(event.target.value)}/></label><label>Reference number<input value={reference} onChange={(event) => onReference(event.target.value)} placeholder="Job card, issue slip or production reference"/></label><label className="wide">Remarks *<textarea value={remarks} onChange={(event) => onRemarks(event.target.value)} placeholder="Record who received the material and the operation or reason"/></label></div><footer><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={saving} onClick={onSubmit}>{saving ? "Saving…" : issue ? "Issue to job" : consume ? "Record consumption" : "Return to customer stock"}</button></footer></section>;
}

function CustomerReturnDocuments({ rows, loading, onManage }: { rows:Row[]; loading:boolean; onManage:(row:Row)=>void }) {
  return <section className="customer-material-card customer-material-card--documents"><div className="customer-material-section-head"><div><h2>Return-to-Customer documents</h2><p>Approval, customer acknowledgement, PDF and security gate-exit confirmation are retained here.</p></div></div><div className="customer-material-table-wrap"><table><thead><tr><th>RTC document</th><th>Customer</th><th>Items</th><th>Planned dispatch</th><th>Status</th><th className="app-last-updated-column">Last Updated</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading return documents…</td></tr> : rows.length ? rows.map((row) => <tr key={String(row.id)}><td><strong>{text(row.rtcNumber)}</strong><small>{text(row.rtcDate)}</small></td><td>{text(row.customerName)}</td><td>{text(row.itemSummary)}<small>{number(row.totalQuantity)} across {number(row.itemCount)} item(s)</small></td><td>{text(row.dispatchReference || "Not specified")}<small>{text(row.transportMode || "")} {row.transportReference ? `· ${text(row.transportReference)}` : ""}</small></td><td><span className={`customer-document-status ${text(row.documentStatus).toLowerCase()}`}>{text(row.documentStatus).replace(/_/g, " ")}</span></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td><td><button type="button" className="customer-link-button" onClick={() => onManage(row)}>Manage</button>{row.fileUrl && <a href={String(row.fileUrl)} target="_blank" rel="noreferrer">PDF</a>}</td></tr>) : <tr><td colSpan={7}>No Return-to-Customer documents have been created.</td></tr>}</tbody></table></div></section>;
}

function ReturnWorkflowPanel({ row, saving, approvalRemarks, customerContact, acknowledgementReference, gateExitReference, onClose, onApprovalRemarks, onCustomerContact, onAcknowledgementReference, onGateExitReference, onRun }: { row:Row; saving:boolean; approvalRemarks:string; customerContact:string; acknowledgementReference:string; gateExitReference:string; onClose:()=>void; onApprovalRemarks:(value:string)=>void; onCustomerContact:(value:string)=>void; onAcknowledgementReference:(value:string)=>void; onGateExitReference:(value:string)=>void; onRun:(action:"approve"|"acknowledge"|"dispatch")=>void }) {
  const status = text(row.documentStatus); return <section className="customer-material-panel"><header><div><span>Formal Return-to-Customer workflow</span><h2>{text(row.rtcNumber)} · {text(row.customerName)}</h2><p>The rejected quantity remains in customer-owned quarantine until the dispatch step.</p></div><button type="button" onClick={onClose}>Close</button></header><div className="customer-workflow-steps"><span className={status === "PENDING_APPROVAL" ? "active" : "done"}><ShieldCheck size={15}/>Approval</span><span className={status === "APPROVED" ? "active" : ["ACKNOWLEDGED", "DISPATCHED"].includes(status) ? "done" : ""}><CheckCircle2 size={15}/>Customer acknowledgement</span><span className={status === "ACKNOWLEDGED" ? "active" : status === "DISPATCHED" ? "done" : ""}><Truck size={15}/>Gate exit and dispatch</span></div>{status === "PENDING_APPROVAL" && <div className="customer-panel-grid"><label className="wide">Approval remarks<input value={approvalRemarks} onChange={(event) => onApprovalRemarks(event.target.value)} placeholder="Optional approval remarks for the RTC PDF"/></label></div>}{status === "APPROVED" && <div className="customer-panel-grid"><label>Customer contact *<input value={customerContact} onChange={(event) => onCustomerContact(event.target.value)} placeholder="Name, phone or email"/></label><label>Customer acknowledgement reference *<input value={acknowledgementReference} onChange={(event) => onAcknowledgementReference(event.target.value)} placeholder="Email, call log or signed copy"/></label></div>}{status === "ACKNOWLEDGED" && <div className="customer-panel-grid"><label>Gate exit / delivery challan reference *<input value={gateExitReference} onChange={(event) => onGateExitReference(event.target.value)} placeholder="Mandatory security gate exit reference"/></label></div>}{status === "DISPATCHED" && <div className="customer-material-notice"><CheckCircle2 size={17}/>Customer return completed. The document and quarantine movement remain available for audit.</div>}<footer><button type="button" onClick={onClose}>Close</button>{status === "PENDING_APPROVAL" && <button type="button" disabled={saving} onClick={() => onRun("approve")}>{saving ? "Approving…" : "Approve & generate RTC PDF"}</button>}{status === "APPROVED" && <button type="button" disabled={saving} onClick={() => onRun("acknowledge")}>{saving ? "Saving…" : "Record acknowledgement"}</button>}{status === "ACKNOWLEDGED" && <button type="button" disabled={saving} onClick={() => onRun("dispatch")}>{saving ? "Dispatching…" : "Confirm gate exit & dispatch"}</button>}</footer></section>;
}
