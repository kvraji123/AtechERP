import DateInput from "../../../components/DateInput";
import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import "./QuotationPage.css";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Mail, Pencil, Plus, Printer, Save, Send, Trash2, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { marketingApi } from "../../../api/marketing.api";
import { apiMessage } from "../../../api/client";
import Alert from "../../../components/Alert";
import { useAppFeedback } from "../../../components/AppFeedback";
import PageHeader from "../../../components/PageHeader";
import StageTabs, { type MarketingStage } from "../../../components/StageTabs";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, Permissions } from "../../../utils/permissions";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import { amountInWords } from "../../../utils/amountInWords";

const today = todayInAppTimeZone;
const formatAmount = (value: unknown) => Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const sampleCostInSelectedCurrency = (part: any) => {
  const sampleCostInr = Number(part.sample_cost_inr || 0);
  const fobPriceInr = Number(part.final_part_price_fob_inr || 0);
  const fobPriceForeign = Number(part.final_part_price_fob_foreign || 0);
  return fobPriceInr > 0
    ? sampleCostInr * fobPriceForeign / fobPriceInr
    : 0;
};
const developmentCostFields = [
  { key: "pattern_development_cost_foreign", costType: "PATTERN", label: "Pattern Cost" },
  { key: "fixture_development_cost_foreign", costType: "FIXTURE", label: "Fixture Cost" },
  { key: "tool_development_cost_foreign", costType: "TOOL", label: "Tool Cost" },
  { key: "gauge_development_cost_foreign", costType: "GAUGE", label: "Gauge Cost" },
  { key: "trial_development_cost_foreign", costType: "TRIAL", label: "Trial Cost" },
] as const;
const quotationPdfUrl = (filePath?: string) => {
  if (!filePath) return "";
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api/v1";
  return `${apiBase.replace(/\/api\/v1\/?$/, "")}${filePath}`;
};

export default function QuotationPage() {
  const enquiryId = Number(useParams().id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { confirmDelete } = useAppFeedback();
  const canEditAllStages = hasPermission(
    user,
    Permissions.editEnquiryAllStages
  );
  const editRequested =
    searchParams.get("mode") === "edit" && canEditAllStages;
  const viewRequested = searchParams.get("mode") === "view";
  const [enquiry, setEnquiry] = useState<any>();
  const [parts, setParts] = useState<any[]>([]);
  const [quotation, setQuotation] = useState<any>();
  const [workflow, setWorkflow] = useState<any>();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>();
  const [working, setWorking] = useState<string | null>(null);
  const [draftEditing, setDraftEditing] = useState(true);
  const [form, setForm] = useState<any>({
    quotationDate: today(), currencyCode: "", enquiryPartIds: [],
    salutation: "Dear Sir / Madam,",
    introduction: "Please find our quotation for the following machined parts.",
    notes: [], developmentCostDisplayFields: [], emailTo: "", emailSubject: "", emailBody: "",
  });

  const unsaved = useUnsavedChanges(form, workflow?.allowedActions?.includes("SAVE_DRAFT") ? async () => (await save(false, true)) === true : undefined);

  const load = async () => {
    const response = await marketingApi.getQuotation(enquiryId);
    const data = response.data;
    setEnquiry(data.enquiry); setParts(data.eligibleParts || []); setQuotation(data.quotation); setWorkflow(data.workflow);
    const q = data.quotation;
    setDraftEditing(editRequested || (!q && !viewRequested));
    const selectedIds = q?.items?.map((item: any) => Number(item.enquiry_part_id)) || data.eligibleParts.map((item: any) => Number(item.enquiry_part_id));
    const notes = q?.notes?.map((note: any) => note.noteText) || data.defaultNotes.map((note: any) => note.noteText);
    const storedCostTypes = new Set((q?.items || []).flatMap((item: any) => item.optionalCosts || []).map((cost: any) => cost.costType));
    setForm({
      quotationDate: q?.quotation_date || today(),
      currencyCode: q?.currency_code || data.eligibleParts[0]?.currency_code || "",
      enquiryPartIds: selectedIds,
      salutation: q?.salutation || "Dear Sir / Madam,",
      introduction: q?.introduction || "Please find our quotation for the following machined parts.",
      notes,
      developmentCostDisplayFields: developmentCostFields
        .filter((field) => storedCostTypes.has(field.costType))
        .map((field) => field.key),
      emailTo: q?.email_to || data.enquiry.email_address || "",
      emailSubject: q?.email_subject || (q ? `Quotation ${q.quotation_no} - ${data.enquiry.customer_name_snapshot}` : ""),
      emailBody: `Dear Sir / Madam,\n\nPlease find attached our quotation${q ? ` ${q.quotation_no}` : ""}.\n\nRegards,\nA Tech Automation Pvt. Ltd.`,
    });
  };

  useEffect(() => { load().catch((error) => setMessage({ type: "error", text: apiMessage(error) })); }, [enquiryId, editRequested, viewRequested]);
  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const persistedFinalized =
    quotation?.quotation_status === "FINALIZED";
  const savedDraft =
    quotation?.quotation_status === "DRAFT";
  const finalized =
    (viewRequested && !draftEditing) ||
    (persistedFinalized && !draftEditing) ||
    (savedDraft && !draftEditing);
  const actions = (workflow?.allowedActions || []) as string[];
  const allowedStages = (workflow?.allowedStages || ["Enquiry", "Feasibility", "Workout", "Quotation"]) as MarketingStage[];
  const completedStages = (workflow?.completedStages || ["Enquiry", "Feasibility", "Workout"]) as MarketingStage[];
  const selectedParts = useMemo(
    () => parts.filter((part) => form.enquiryPartIds.includes(Number(part.enquiry_part_id))),
    [parts, form.enquiryPartIds]
  );
  const developmentCostSummary = useMemo(() => {
    const totals = developmentCostFields.reduce((summary, field) => ({ ...summary, [field.key]: 0 }), {} as Record<string, number>);
    selectedParts.forEach((part) => {
      developmentCostFields.forEach((field) => {
        totals[field.key] += Number(part[field.key] || 0);
      });
    });
    return {
      ...totals,
      total: developmentCostFields.reduce((sum, field) => sum + totals[field.key], 0),
    };
  }, [selectedParts]);
  const availableDevelopmentCostFields = developmentCostFields.filter(
    (field) => developmentCostSummary[field.key] > 0
  );
  const selectedDevelopmentCostFields = availableDevelopmentCostFields.filter(
    (field) => form.developmentCostDisplayFields?.includes(field.key)
  );
  const selectedDevelopmentCostTotal = selectedDevelopmentCostFields.reduce(
    (total, field) => total + developmentCostSummary[field.key],
    0
  );
  const quotationItemTotal = selectedParts.reduce((total, part) => {
    const quantity = Number(part.annual_quantity ?? part.required_quantity ?? 0);
    return total + quantity * Number(part.final_part_price_fob_foreign || 0);
  }, 0);
  const quotationTotal = quotationItemTotal + selectedDevelopmentCostTotal;
  const quotationCurrency = form.currencyCode || "INR";

  const togglePart = (id: number) => {
    if (finalized) return;
    setForm((current: any) => {
      const selected = current.enquiryPartIds.includes(id);
      return {
        ...current,
        enquiryPartIds: selected
          ? current.enquiryPartIds.filter((value: number) => value !== id)
          : [...current.enquiryPartIds, id],
      };
    });
  };
  const toggleDevelopmentCost = (key: string) => {
    if (finalized) return;
    setForm((current: any) => {
      const selected = current.developmentCostDisplayFields || [];
      return {
        ...current,
        developmentCostDisplayFields: selected.includes(key)
          ? selected.filter((value: string) => value !== key)
          : [...selected, key],
      };
    });
  };
  const updateNote = (index: number, value: string) => set("notes", form.notes.map((note: string, noteIndex: number) => noteIndex === index ? value : note));
  const removeNote = async (index: number) => {
    const confirmed = await confirmDelete({
      title: "Delete quotation note?",
      message: `Quotation note ${index + 1} will be removed.`,
      confirmLabel: "Delete note",
    });
    if (!confirmed) return;
    set("notes", form.notes.filter((_: string, noteIndex: number) => noteIndex !== index));
  };

  const save = async (finish: boolean, stayOnPage = false): Promise<boolean | void> => {
    const savedSnapshot = unsaved.snapshot();

    try {
      setWorking(finish ? "FINALIZE" : "DRAFT"); setMessage(undefined);
      const response = await marketingApi.saveQuotation(enquiryId, form, finish);
      unsaved.markSaved(savedSnapshot);
      if (stayOnPage) return true;

      if (!finish) {
        navigate("/marketing/enquiries");
        return;
      }

      setDraftEditing(false);
      setMessage({ type: "success", text: response.message });
      await load();
    } catch (error) { setMessage({ type: "error", text: apiMessage(error) }); }
    finally { setWorking(null); }
  };

  const generatePdf = async () => {
    try {
      setWorking("PDF"); setMessage(undefined);
      const response = await marketingApi.generateQuotationPdf(enquiryId);
      setMessage({ type: "success", text: response.message }); await load();
    } catch (error) { setMessage({ type: "error", text: apiMessage(error) }); }
    finally { setWorking(null); }
  };

  const previewPdf = () => {
    const pdfUrl = quotationPdfUrl(quotation?.pdf_file_path);
    if (!pdfUrl) return;
    if (!window.open(pdfUrl, "_blank", "noopener,noreferrer")) {
      setMessage({ type: "error", text: "Allow pop-ups to preview the quotation PDF." });
    }
  };

  const printPdf = () => {
    const pdfUrl = quotationPdfUrl(quotation?.pdf_file_path);
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl, "_blank");
    if (!printWindow) {
      setMessage({ type: "error", text: "Allow pop-ups to print the quotation PDF." });
      return;
    }
    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // The PDF remains open in the browser viewer, where it can still be printed.
      }
    }, 900);
  };

  /*const showMailOption = () => {
    setMessage({
      type: "success",
      text: "Mail sending is kept as a UI option only. Email integration will be added later.",
    });*/
  const sendEmail = async () => {
    try {
      setWorking("EMAIL"); setMessage(undefined);
      const response = await marketingApi.sendQuotationEmail(enquiryId, {
        to: form.emailTo,
        subject: form.emailSubject,
        body: form.emailBody,
      });
      setMessage({ type: "success", text: response.message });
      await load();
    }
    catch (error) { setMessage({ type: "error", text: apiMessage(error) }); }
    finally { setWorking(null); }


  };

  const cancel = () => {
    navigate(`/marketing/enquiries/${enquiryId}`);
  };

  return <div className="page-container quotation-page">
    <PageHeader eyebrow="MARKETING / QUOTATION" title={quotation ? `Quotation - ${quotation.quotation_no}` : "New Quotation"} onClose={cancel} closeDisabled={working !== null} closeLabel="Close Quotation" actions={<>
      {(savedDraft || persistedFinalized) && !draftEditing && canEditAllStages ? (
        <button type="button" className="primary-action-button" disabled={working !== null} onClick={() => setDraftEditing(true)}><Pencil size={17}/>{persistedFinalized ? "Edit Quotation" : "Edit Draft"}</button>
      ) : !viewRequested && (!persistedFinalized || draftEditing) ? <>
        {(savedDraft || persistedFinalized) && <button type="button" className="quotation-cancel" disabled={working !== null} onClick={() => { setDraftEditing(false); void load(); }}><X size={16}/>Cancel Edit</button>}
        {actions.includes("SAVE_DRAFT") && <button type="button" className="secondary-action-button draft" disabled={working !== null} onClick={() => save(false)}><Save size={17}/>{working === "DRAFT" ? "Saving..." : "Save Draft"}</button>}
        {actions.includes("UPDATE_QUOTATION") && <button type="button" className="primary-action-button" disabled={working !== null} onClick={() => save(false)}><Save size={17}/>{working === "DRAFT" ? "Updating..." : "Update"}</button>}
        {actions.includes("FINALIZE_QUOTATION") && <button type="button" className="primary-action-button" disabled={working !== null} onClick={() => save(true)}><Send size={17}/>{working === "FINALIZE" ? "Finalizing..." : "Finalize"}</button>}
      </> : null}
      {!draftEditing && actions.includes("GENERATE_QUOTATION_PDF") && <button type="button" className="secondary-action-button" disabled={working !== null} onClick={generatePdf}><FileText size={17}/>{working === "PDF" ? "Generating..." : quotation?.pdf_status === "GENERATED" ? "Regenerate PDF" : "Generate PDF"}</button>}
      {!draftEditing && actions.includes("PREVIEW_QUOTATION_PDF") && <button type="button" className="secondary-action-button" onClick={previewPdf}><Download size={17}/>Preview PDF</button>}
      {!draftEditing && actions.includes("PREVIEW_QUOTATION_PDF") && <button type="button" className="secondary-action-button" onClick={printPdf}><Printer size={17}/>Print PDF</button>}
    </>}/>
    {message && <Alert type={message.type} message={message.text}/>} 
    <StageTabs active="Quotation" enquiryId={enquiryId} partId={parts[0]?.enquiry_part_id} allowedStages={allowedStages} completedStages={completedStages}/>

    <section className="quotation-card">
      <div className="quotation-section-title"><h2>Quotation Details</h2>{quotation && <span className={`quotation-status ${quotation.quotation_status.toLowerCase()}`}>{quotation.quotation_status}</span>}</div>
      <div className="quotation-header-grid">
        <label><span>Quotation Number</span><input value={quotation?.quotation_no || "Auto Generated"} readOnly/></label>
        <label><span>Quotation Date *</span><DateInput type="date" value={form.quotationDate} max={today()} disabled={finalized} onChange={(event) => set("quotationDate", event.target.value)}/></label>
        <label><span>Enquiry Reference / Quote For</span><input value={enquiry?.doc_no || ""} readOnly/></label>
        <label><span>Customer Reference</span><input value={enquiry?.po_reference || "Not Available"} readOnly/></label>
        <label><span>Customer Name</span><input value={enquiry?.customer_name_snapshot || ""} readOnly/></label>
        <label><span>Customer Email</span><input value={enquiry?.email_address || ""} readOnly/></label>
        <label className="span-2"><span>Customer Address</span><textarea rows={2} value={enquiry?.billing_address || enquiry?.delivery_address || ""} readOnly/></label>
        <label><span>Currency</span><input value={form.currencyCode} readOnly/></label>
        <label><span>Revision</span><input value={enquiry?.revision_number || "-"} readOnly/></label>
        <label><span>Salutation</span><input value={form.salutation} disabled={finalized} onChange={(event) => set("salutation", event.target.value)}/></label>
        <label className="span-2"><span>Introduction</span><textarea rows={2} value={form.introduction} disabled={finalized} onChange={(event) => set("introduction", event.target.value)}/></label>
      </div>
    </section>

    <section className="quotation-card">
      <div className="quotation-section-title"><div><h2>Completed Workout Items</h2><p>Only FEASIBLE parts with COMPLETED Workout are included.</p></div><strong>{form.enquiryPartIds.length} / {parts.length} selected</strong></div>
      <div className="quotation-table-wrap"><table className="quotation-items-table" data-app-header-filter-disabled="true"><thead><tr><th>Select</th><th>Item Code</th><th>Drawing / Rev</th><th>Description</th><th>Required Qty</th><th>MOQ</th><th>Material</th><th>Weight Kg</th><th>FOB INR<small>(per part price)</small></th><th>FOB {form.currencyCode}<small>(per part price)</small></th><th>Line Total {form.currencyCode}</th><th>Development {form.currencyCode}</th><th>Sample Cost ({quotationCurrency})</th></tr></thead><tbody>
        {parts.map((part) => {
          const partId = Number(part.enquiry_part_id);
          const selected = form.enquiryPartIds.includes(partId);
          const quantity = Number(part.annual_quantity ?? part.required_quantity ?? 0);
          const lineTotal = quantity * Number(part.final_part_price_fob_foreign || 0);
          return <tr key={partId}>
              <td><input type="checkbox" checked={selected} disabled={finalized || persistedFinalized} onChange={() => togglePart(partId)}/></td>
              <td>{part.item_code || "-"}</td>
              <td><strong>{part.drawing_number}</strong><small>{part.drawing_revision_number || "-"}</small></td>
              <td>{part.product_description}</td>
              <td>{part.annual_quantity ?? part.required_quantity ?? ""} {part.unit_of_measurement || ""}</td>
              <td>{part.moq}</td><td>{part.material_and_grade}</td><td>{part.weight_kg}</td>
              <td>{formatAmount(part.final_part_price_fob_inr)}</td>
              <td>{formatAmount(part.final_part_price_fob_foreign)}</td>
              <td>{formatAmount(lineTotal)}<small>{amountInWords(lineTotal, quotationCurrency)}</small></td>
              <td>{formatAmount(part.total_development_cost_foreign)}</td>
              <td>{formatAmount(sampleCostInSelectedCurrency(part))}</td>
          </tr>;
        })}
      </tbody></table></div>
    </section>

    <section className="quotation-card quotation-value-summary">
      <div className="quotation-section-title"><h2>Quotation Value</h2><strong>{quotationCurrency}</strong></div>
      <div className="quotation-value-summary-grid">
        <label><span>Quoted Items Total</span><input value={formatAmount(quotationItemTotal)} readOnly /></label>
        <label><span>Included Development Cost</span><input value={formatAmount(selectedDevelopmentCostTotal)} readOnly /></label>
        <label className="quotation-value-total"><span>Quotation Total</span><input value={formatAmount(quotationTotal)} readOnly /></label>
      </div>
      <p className="quotation-amount-words"><span>Amount in words</span><strong>{amountInWords(quotationTotal, quotationCurrency)}</strong></p>
    </section>

    {availableDevelopmentCostFields.length > 0 && <section className="quotation-card quotation-development-summary">
      <div className="quotation-section-title">
        <h2>Development Cost Summary</h2>
        <strong>{selectedParts.length} {selectedParts.length === 1 ? "part" : "parts"} · {form.currencyCode || "INR"}</strong>
      </div>
      <div className="quotation-development-cost-options">
        {availableDevelopmentCostFields.map((field) => <label key={field.key} className={form.developmentCostDisplayFields?.includes(field.key) ? "selected" : ""}>
          <input type="checkbox" checked={form.developmentCostDisplayFields?.includes(field.key) || false} disabled={finalized} onChange={() => toggleDevelopmentCost(field.key)}/>
          <span>{field.label}</span>
        </label>)}
      </div>
      {selectedDevelopmentCostFields.length > 0 && <div className="quotation-development-summary-grid">
        {selectedDevelopmentCostFields.map((field) => <label key={field.key}>
          <span>{field.label}</span>
          <input value={formatAmount(developmentCostSummary[field.key])} readOnly/>
        </label>)}
        <label className="quotation-development-total">
          <span>Total Development Cost</span>
          <input value={formatAmount(selectedDevelopmentCostTotal)} readOnly/>
        </label>
      </div>}
    </section>}

    <section className="quotation-card">
      <div className="quotation-section-title"><h2>Quotation Notes</h2>{!finalized && <button type="button" className="quotation-add-note" onClick={() => set("notes", [...form.notes, ""])}><Plus size={15}/>Add Note</button>}</div>
      <div className="quotation-notes">{form.notes.map((note: string, index: number) => <div key={index}><span>{index + 1}</span><textarea rows={2} value={note} disabled={finalized} onChange={(event) => updateNote(index, event.target.value)}/>{!finalized && <button type="button" title="Remove note" onClick={() => removeNote(index)}><Trash2 size={16}/></button>}</div>)}</div>
    </section>

    {persistedFinalized && <section className="quotation-card quotation-email-card">
      <div className="quotation-section-title"><div><h2>Email Quotation</h2><p>Send the generated quotation PDF to the customer.</p></div><span className={`quotation-email-status ${(quotation?.email_status || "NOT_SENT").toLowerCase()}`}>{quotation?.email_status || "NOT SENT"}</span></div>
      <div className="quotation-email-grid"><label><span>Recipient *</span><input type="email" value={form.emailTo} onChange={(event) => set("emailTo", event.target.value)}/></label><label className="span-2"><span>Subject</span><input value={form.emailSubject} onChange={(event) => set("emailSubject", event.target.value)}/></label><label className="span-full"><span>Mail Body</span><textarea rows={5} value={form.emailBody} onChange={(event) => set("emailBody", event.target.value)}/></label></div>
      <div className="quotation-email-footer"><div>{quotation?.email_failure_reason ? <span className="quotation-email-error">{quotation.email_failure_reason}</span> : <span>The generated quotation PDF will be attached automatically.</span>}</div><button type="button" className="primary-action-button" disabled={working !== null || !actions.includes("SEND_QUOTATION_EMAIL")} onClick={sendEmail}><Mail size={17}/>{working === "EMAIL" ? "Sending..." : "Send Email"}</button></div>

    </section>}
  </div>;
}
