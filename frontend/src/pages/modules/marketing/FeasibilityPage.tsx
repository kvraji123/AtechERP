import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import "./FeasibilityPage.css";

import { useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw, Save, Send, X } from "lucide-react";
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

type Answer = "" | "YES" | "NO";
type RawMaterialSource = "" | "CUSTOMER" | "PURCHASE";
type Message = { type: "error" | "success"; text: string };

type FeasibilityForm = {
  feasibilityDate: string;
  communicationAddress: string;
  contactPerson: string;
  telephoneNumber: string;
  faxNumber: string;
  emailAddress: string;
  isNewCustomer: Answer;
  existingProductsDetails: string;
  similarProductProcessing: Answer;
  similarProductDetails: string;
  drawingReviewedCompletely: Answer;
  drawingRequirementsUnderstood: Answer;
  customerClarificationRequired: string;
  productTechnicallyFeasible: Answer;
  rawMaterialSource: RawMaterialSource;
  purchaseSourceAvailable: Answer;
  materialSourceDetails: string;
  outsourceProcessRequired: Answer;
  outsourceSourceDetails: string;
  toleranceAchievable: Answer;
  acceptanceCriteriaUnderstood: Answer;
  customerSpecialCharacteristics: Answer;
  specialCharacteristicsDetails: string;
  customerFinalInspectionFormat: Answer;
  finalInspectionFormatDetails: string;
  batchSupplyReports: string;
  customerRequiredVolume: string;
  volumeUom: string;
  statutoryRequirements: string;
  customerSpecifiedPacking: Answer;
  packingDetails: string;
  customerSpecifiedLabelling: Answer;
  labellingDetails: string;
  transportationMode: string;
  customerSpecifiedTransporter: Answer;
  transporterDetails: string;
  freightPaidBy: string;
  paymentTerms: string;
  feasibilityDecision: string;
  regretReason: string;
  finalRemarks: string;
};

const emptyForm = (): FeasibilityForm => ({
  feasibilityDate: todayInAppTimeZone(),
  communicationAddress: "",
  contactPerson: "",
  telephoneNumber: "",
  faxNumber: "",
  emailAddress: "",
  isNewCustomer: "",
  existingProductsDetails: "",
  similarProductProcessing: "",
  similarProductDetails: "",
  drawingReviewedCompletely: "",
  drawingRequirementsUnderstood: "",
  customerClarificationRequired: "",
  productTechnicallyFeasible: "",
  rawMaterialSource: "",
  purchaseSourceAvailable: "",
  materialSourceDetails: "",
  outsourceProcessRequired: "",
  outsourceSourceDetails: "",
  toleranceAchievable: "",
  acceptanceCriteriaUnderstood: "",
  customerSpecialCharacteristics: "",
  specialCharacteristicsDetails: "",
  customerFinalInspectionFormat: "",
  finalInspectionFormatDetails: "",
  batchSupplyReports: "",
  customerRequiredVolume: "",
  volumeUom: "",
  statutoryRequirements: "",
  customerSpecifiedPacking: "",
  packingDetails: "",
  customerSpecifiedLabelling: "",
  labellingDetails: "",
  transportationMode: "",
  customerSpecifiedTransporter: "",
  transporterDetails: "",
  freightPaidBy: "",
  paymentTerms: "",
  feasibilityDecision: "",
  regretReason: "",
  finalRemarks: "",
});

const fieldMap: Record<keyof FeasibilityForm, string> = {
  feasibilityDate: "feasibility_date",
  communicationAddress: "communication_address",
  contactPerson: "contact_person",
  telephoneNumber: "telephone_number",
  faxNumber: "fax_number",
  emailAddress: "email_address",
  isNewCustomer: "is_new_customer",
  existingProductsDetails: "existing_products_details",
  similarProductProcessing: "similar_product_processing",
  similarProductDetails: "similar_product_details",
  drawingReviewedCompletely: "drawing_reviewed_completely",
  drawingRequirementsUnderstood: "drawing_requirements_understood",
  customerClarificationRequired: "customer_clarification_required",
  productTechnicallyFeasible: "product_technically_feasible",
  rawMaterialSource: "raw_material_source",
  purchaseSourceAvailable: "purchase_source_available",
  materialSourceDetails: "material_source_details",
  outsourceProcessRequired: "outsource_process_required",
  outsourceSourceDetails: "outsource_source_details",
  toleranceAchievable: "tolerance_achievable",
  acceptanceCriteriaUnderstood: "acceptance_criteria_understood",
  customerSpecialCharacteristics: "customer_special_characteristics",
  specialCharacteristicsDetails: "special_characteristics_details",
  customerFinalInspectionFormat: "customer_final_inspection_format",
  finalInspectionFormatDetails: "final_inspection_format_details",
  batchSupplyReports: "batch_supply_reports",
  customerRequiredVolume: "customer_required_volume",
  volumeUom: "volume_uom",
  statutoryRequirements: "statutory_requirements",
  customerSpecifiedPacking: "customer_specified_packing",
  packingDetails: "packing_details",
  customerSpecifiedLabelling: "customer_specified_labelling",
  labellingDetails: "labelling_details",
  transportationMode: "transportation_mode",
  customerSpecifiedTransporter: "customer_specified_transporter",
  transporterDetails: "transporter_details",
  freightPaidBy: "freight_paid_by",
  paymentTerms: "payment_terms",
  feasibilityDecision: "feasibility_decision",
  regretReason: "regret_reason",
  finalRemarks: "final_remarks",
};

function mapRecord(record: any): FeasibilityForm {
  const form = emptyForm();
  if (!record) return form;
  for (const key of Object.keys(form) as (keyof FeasibilityForm)[]) {
    const value = record[fieldMap[key]] ?? record[key];
    if (value !== null && value !== undefined) (form[key] as string) = String(value);
  }
  return form;
}

function YesNo({ value, onChange, disabled }: { value: Answer; onChange: (value: Answer) => void; disabled?: boolean }) {
  return (
    <div className="feasibility-radio-group">
      {(["YES", "NO"] as const).map((answer) => (
        <label key={answer}>
          <input type="radio" checked={value === answer} disabled={disabled} onChange={() => onChange(answer)} />
          {answer === "YES" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

function ReviewRow({ number, label, children, disabled }: { number: string; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={`feasibility-review-row${disabled ? " disabled" : ""}`}>
      <div className="feasibility-review-question"><strong>{number}.</strong><span>{label}</span></div>
      <div className="feasibility-review-answer">{children}</div>
    </div>
  );
}

export default function FeasibilityPage() {
  const { partId: routePartId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showSuccess } = useAppFeedback();
  const canEditAllStages = hasPermission(
    user,
    Permissions.editEnquiryAllStages
  );
  const editRequested =
    searchParams.get("mode") === "edit" && canEditAllStages;
  const viewRequested = searchParams.get("mode") === "view";
  const modeSuffix = editRequested
    ? "?mode=edit"
    : searchParams.get("mode") === "view"
      ? "?mode=view"
      : "";
  const partId = Number(routePartId);
  const [part, setPart] = useState<any>();
  const [items, setItems] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any>();
  const [record, setRecord] = useState<any>();
  const [regretLetter, setRegretLetter] = useState<any>();
  const [masters, setMasters] = useState<any>({
    transportationModes: [],
    paymentTerms: [],
  });
  const [form, setForm] = useState<FeasibilityForm>(emptyForm());
  const [message, setMessage] = useState<Message>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"DRAFT" | "CLOSE" | null>(null);
  const [regretAction, setRegretAction] = useState<string | null>(null);
  const [draftEditing, setDraftEditing] = useState(true);
  const [paymentTermsOpen, setPaymentTermsOpen] = useState(false);
  const [paymentTermsSearch, setPaymentTermsSearch] = useState("");

  const persistedClosed = record?.save_status === "CLOSED";
  const unsaved = useUnsavedChanges(form, workflow?.allowedActions?.includes("SAVE_DRAFT") ? async () => (await save(false, true)) === true : undefined);

  const savedDraft = record?.save_status === "DRAFT";
  const closed =
    (viewRequested && !draftEditing) ||
    (persistedClosed && !draftEditing) ||
    (savedDraft && !draftEditing);
  const isLabourOrder = String(part?.order_type ?? part?.orderType ?? "").toUpperCase() === "LABOUR";
  const allowedStages = (workflow?.allowedStages ?? []) as MarketingStage[];
  const completedStages = (workflow?.completedStages ?? []) as MarketingStage[];
  const allowedActions = (workflow?.allowedActions ?? []) as string[];
  const filteredPaymentTerms = (masters.paymentTerms ?? []).filter((option: any) => {
    const search = paymentTermsSearch.trim().toLowerCase();
    if (!search) return true;
    return String(option.value || "").toLowerCase().includes(search) ||
      String(option.label || "").toLowerCase().includes(search);
  });

  const load = async () => {
    try {
      setLoading(true);
      setPaymentTermsOpen(false);
      setPaymentTermsSearch("");
      setMessage(undefined);
      const response = await marketingApi.getFeasibility(partId);
      const data = response.data;
      setPart(data.part);
      setItems(data.items ?? []);
      setWorkflow(data.workflow);
      setRecord(data.feasibility);
      setDraftEditing(
        editRequested || (!data.feasibility && !viewRequested)
      );
      setRegretLetter(data.regretLetter);
      setMasters(data.masters ?? { transportationModes: [], paymentTerms: [] });
      const mapped = mapRecord(data.feasibility);
      if (!data.feasibility) {
        mapped.communicationAddress = data.part.billing_address || data.part.delivery_address || "";
        mapped.contactPerson = data.part.contact_person_name || "";
        mapped.telephoneNumber = data.part.phone_number || data.part.mobile_number || "";
        mapped.faxNumber = data.part.fax_number || "";
        mapped.emailAddress = data.part.email_address || "";
      }
      setForm(mapped);
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [partId, editRequested, viewRequested]);

  const set = <K extends keyof FeasibilityForm>(key: K, value: FeasibilityForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const movePaymentTerm = (direction: 1 | -1) => {
    const paymentTerms = masters.paymentTerms ?? [];
    if (!paymentTerms.length) return;
    const currentIndex = paymentTerms.findIndex(
      (option: any) => String(option.value || "") === String(form.paymentTerms || "")
    );
    const startIndex = currentIndex >= 0
      ? currentIndex
      : direction === 1 ? -1 : 0;
    const nextIndex = (startIndex + direction + paymentTerms.length) % paymentTerms.length;
    const next = paymentTerms[nextIndex];
    set("paymentTerms", String(next.value || next.label || ""));
    setPaymentTermsSearch("");
    setPaymentTermsOpen(true);
  };

  const combinedAnswer = (a: Answer, b: Answer, either = false): Answer =>
    either ? (a === "YES" || b === "YES" ? "YES" : a === "NO" && b === "NO" ? "NO" : "")
      : (a === "NO" || b === "NO" ? "NO" : a === "YES" && b === "YES" ? "YES" : "");
  const setCombined = (a: keyof FeasibilityForm, b: keyof FeasibilityForm, value: Answer) =>
    setForm((current) => ({ ...current, [a]: value, [b]: value }));
  const setAnswer = (key: keyof FeasibilityForm, value: Answer) => {
    setForm((current) => {
      const next = { ...current, [key]: value } as FeasibilityForm;
      if (key === "isNewCustomer" && value === "YES") next.existingProductsDetails = "";
      if (key === "similarProductProcessing" && value === "NO") next.similarProductDetails = "";
      if (key === "drawingReviewedCompletely" && value === "NO") next.drawingRequirementsUnderstood = "";
      if (key === "drawingRequirementsUnderstood" && value === "YES") next.customerClarificationRequired = "";
      if (key === "customerSpecialCharacteristics" && value === "NO") next.specialCharacteristicsDetails = "";
      if (key === "customerFinalInspectionFormat" && value === "NO") next.finalInspectionFormatDetails = "";
      if (key === "customerSpecifiedPacking" && value === "NO") next.packingDetails = "";
      if (key === "customerSpecifiedLabelling" && value === "NO") next.labellingDetails = "";
      if (key === "customerSpecifiedTransporter" && value === "NO") next.transporterDetails = "";
      if (key === "outsourceProcessRequired" && value === "NO") next.outsourceSourceDetails = "";
      return next;
    });
  };

  const setRawMaterialSource = (value: RawMaterialSource) => {
    setForm((current) => ({
      ...current,
      rawMaterialSource: value,
      purchaseSourceAvailable:
        value === "PURCHASE" ? current.purchaseSourceAvailable : "",
    }));
  };

  const payload = useMemo(() => ({ ...form,
    drawingReviewedCompletely: combinedAnswer(form.drawingReviewedCompletely, form.drawingRequirementsUnderstood),
    drawingRequirementsUnderstood: combinedAnswer(form.drawingReviewedCompletely, form.drawingRequirementsUnderstood),
    toleranceAchievable: combinedAnswer(form.toleranceAchievable, form.acceptanceCriteriaUnderstood),
    acceptanceCriteriaUnderstood: combinedAnswer(form.toleranceAchievable, form.acceptanceCriteriaUnderstood),
    customerSpecifiedPacking: combinedAnswer(form.customerSpecifiedPacking, form.customerSpecifiedLabelling, true),
    customerSpecifiedLabelling: combinedAnswer(form.customerSpecifiedPacking, form.customerSpecifiedLabelling, true),
    approvedByName: "System Administrator", approvedByRole: "Administrator" }), [form]);

  const save = async (close: boolean, stayOnPage = false): Promise<boolean | void> => {
    const savedSnapshot = unsaved.snapshot();

    try {
      setSaving(close ? "CLOSE" : "DRAFT");
      setMessage(undefined);
      const response = await marketingApi.saveFeasibility(partId, payload, close);
      unsaved.markSaved(savedSnapshot);
      if (stayOnPage) return true;

      if (!close) {
        showSuccess(
          persistedClosed
            ? "Completed Feasibility updated successfully."
            : response.message || "Feasibility draft saved successfully."
        );
        navigate("/marketing/enquiries");
        return;
      }

      setDraftEditing(false);
      await load();
      if (form.feasibilityDecision === "FEASIBLE") {
        showSuccess(response.message || "Feasibility closed successfully.");
        navigate(`/marketing/enquiry-parts/${partId}/workout`);
      } else {
        setMessage({ type: "success", text: response.message });
      }
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally {
      setSaving(null);
    }
  };

  const handleRegretAction = async (
    action: "GENERATE" | "PREVIEW" | "APPROVE" | "SENT"
  ) => {
    if (
      action === "APPROVE" &&
      !window.confirm("Approve this regret letter? It cannot be regenerated after approval.")
    ) return;
    try {
      setRegretAction(action);
      setMessage(undefined);
      if (action === "PREVIEW") {
        const response = await marketingApi.previewRegretLetter(partId);
        const preview = window.open("", "_blank");
        if (!preview) throw new Error("Allow pop-ups to preview the regret letter.");
        preview.document.open();
        preview.document.write(response.data.html);
        preview.document.close();
        return;
      }

      const response = action === "GENERATE"
        ? await marketingApi.generateRegretLetter(partId)
        : action === "APPROVE"
          ? await marketingApi.approveRegretLetter(partId)
          : await marketingApi.markRegretLetterSent(partId);
      await load();
      setMessage({ type: "success", text: response.message });
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally {
      setRegretAction(null);
    }
  };

  const cancel = () => {

    navigate(part?.enquiry_id ? `/marketing/enquiries/${part.enquiry_id}` : "/marketing/enquiries");
  };

  const textArea = (key: keyof FeasibilityForm, disabled = false, placeholder = "Enter details") => (
    <textarea maxLength={1000} rows={2} value={String(form[key])} disabled={disabled || closed} placeholder={placeholder} onChange={(e) => set(key, e.target.value as never)} />
  );

  return (
    <div className="page-container feasibility-page">
      <PageHeader
        eyebrow="MARKETING / FEASIBILITY"
        title={part ? `Feasibility Review - ${part.doc_no}` : "Feasibility Review"}
        actions={<>
          <button className="secondary-action-button" type="button" onClick={cancel}><X size={16} />Cancel</button>
          {(savedDraft || persistedClosed) && !draftEditing && canEditAllStages ? (
            <button className="primary-action-button" type="button" disabled={loading} onClick={() => setDraftEditing(true)}><Pencil size={16} />{persistedClosed ? "Edit Feasibility" : "Edit Draft"}</button>
          ) : !viewRequested && (!persistedClosed || draftEditing) ? (
            <>
              {(savedDraft || persistedClosed) && <button className="secondary-action-button" type="button" disabled={saving !== null} onClick={() => { setDraftEditing(false); void load(); }}><X size={16} />Cancel Edit</button>}
              {allowedActions.includes("SAVE_DRAFT") && <button className="secondary-action-button draft" type="button" disabled={loading || saving !== null} onClick={() => save(false)}><Save size={16} />{saving === "DRAFT" ? "Saving..." : "Save Draft"}</button>}
              {allowedActions.includes("UPDATE_FEASIBILITY") && <button className="primary-action-button" type="button" disabled={loading || saving !== null} onClick={() => save(false)}><Save size={16} />{saving === "DRAFT" ? "Updating..." : "Update"}</button>}
              {allowedActions.includes("CLOSE_FEASIBILITY") && <button className="primary-action-button" type="button" disabled={loading || saving !== null} onClick={() => save(true)}><Send size={16} />{saving === "CLOSE" ? "Closing..." : "Close Feasibility"}</button>}
            </>
          ) : null}
        </>}
      />

      {message && <div className="feasibility-message-row"><Alert type={message.type} message={message.text} />{message.type === "error" && <button type="button" onClick={load}><RotateCcw size={14} />Retry</button>}</div>}

      <StageTabs active="Feasibility" enquiryId={part?.enquiry_id} partId={partId} allowedStages={allowedStages} completedStages={completedStages} />

      <section className="feasibility-card">
        <div className="feasibility-section-title">
          <h2>General Details</h2>
          {items.length > 1 && <label className="feasibility-item-selector"><span>Drawing / Item</span><select value={partId} onChange={(e) => navigate(`/marketing/enquiry-parts/${e.target.value}/feasibility${modeSuffix}`)}>{items.map((item) => <option key={item.enquiryPartId} value={item.enquiryPartId}>{item.lineNumber}. {item.drawingNumber || item.partNumber || "Unnamed item"}</option>)}</select></label>}
        </div>
        <div className="feasibility-general-grid">
          <label><span>1. Enquiry Reference Number</span><input value={part?.doc_no ?? ""} readOnly /></label>
          <label><span>2. Customer Name</span><input value={part?.customer_name_snapshot ?? ""} readOnly /></label>
          <label className="wide"><span>3. Address for Communication</span><textarea rows={2} maxLength={1000} value={form.communicationAddress} disabled={closed} onChange={(e) => set("communicationAddress", e.target.value)} /></label>
          <label><span>4. Contact Person</span><input maxLength={200} value={form.contactPerson} disabled={closed} onChange={(e) => set("contactPerson", e.target.value)} /></label>
          <label><span>5. Telephone</span><input maxLength={50} value={form.telephoneNumber} disabled={closed} onChange={(e) => set("telephoneNumber", e.target.value)} /></label>
          <label><span>Fax</span><input maxLength={50} value={form.faxNumber} disabled={closed} onChange={(e) => set("faxNumber", e.target.value)} /></label>
          <label><span>E-mail</span><input type="email" maxLength={200} value={form.emailAddress} disabled={closed} onChange={(e) => set("emailAddress", e.target.value)} /></label>
          <label className="wide"><span>6. Product Name</span><input value={part?.product_description ?? ""} readOnly /></label>
          <label><span>7. Material and Grade</span><input value={part?.material_and_grade ?? ""} readOnly /></label>
          <label><span>8. Drawing Reference and Revision Number</span><input value={[part?.drawing_number, part?.drawing_revision_number].filter(Boolean).join(" / ")} readOnly /></label>
        </div>
      </section>

      <section className="feasibility-card">
        <div className="feasibility-section-title"><h2>Technical Review</h2></div>
        <div className="feasibility-review-list">
          <ReviewRow number="9" label="Has the drawing been reviewed completely and are all requirements clearly understood?"><YesNo value={combinedAnswer(form.drawingReviewedCompletely, form.drawingRequirementsUnderstood)} disabled={closed} onChange={(v) => setCombined("drawingReviewedCompletely", "drawingRequirementsUnderstood", v)} /></ReviewRow>
          <ReviewRow number="10" label="Is processing of the product technically feasible?"><YesNo value={form.productTechnicallyFeasible} disabled={closed} onChange={(v) => setAnswer("productTechnicallyFeasible", v)} /></ReviewRow>
          {!isLabourOrder && <ReviewRow number="11" label="Raw Material Source"><div className="feasibility-inline-entry"><div className="feasibility-radio-group">{[["CUSTOMER", "Customer"], ["PURCHASE", "Purchase"]].map(([value, label]) => <label key={value}><input type="radio" checked={form.rawMaterialSource === value} disabled={closed} onChange={() => setRawMaterialSource(value as RawMaterialSource)} />{label}</label>)}</div>{form.rawMaterialSource === "PURCHASE" && <input value={form.materialSourceDetails} maxLength={1000} disabled={closed} placeholder="Enter source details" onChange={(event) => set("materialSourceDetails", event.target.value)} />}</div></ReviewRow>}
          {!isLabourOrder && <ReviewRow number="12" label="Is any outsource process required?"><div className="feasibility-inline-entry"><YesNo value={form.outsourceProcessRequired} disabled={closed} onChange={(v) => setAnswer("outsourceProcessRequired", v)} /><input value={form.outsourceSourceDetails} maxLength={1000} disabled={closed || form.outsourceProcessRequired !== "YES"} placeholder="Enter outsource details" onChange={(event) => set("outsourceSourceDetails", event.target.value)} /></div></ReviewRow>}
          <ReviewRow number="13" label="Are all specified tolerance limits achievable and are the product acceptance criteria clearly understood?"><YesNo value={combinedAnswer(form.toleranceAchievable, form.acceptanceCriteriaUnderstood)} disabled={closed} onChange={(v) => setCombined("toleranceAchievable", "acceptanceCriteriaUnderstood", v)} /></ReviewRow>
          <ReviewRow number="14" label="Are there customer-specified special characteristics?"><YesNo value={form.customerSpecialCharacteristics} disabled={closed} onChange={(v) => setAnswer("customerSpecialCharacteristics", v)} /></ReviewRow>
          <ReviewRow number="15" label="If Yes, give special-characteristic details" disabled={form.customerSpecialCharacteristics !== "YES"}>{textArea("specialCharacteristicsDetails", form.customerSpecialCharacteristics !== "YES")}</ReviewRow>
        </div>
      </section>

      <section className="feasibility-card feasibility-commercial-card">
        <div className="feasibility-section-title"><h2>Commercial Requirements</h2></div>
        <div className="feasibility-review-list">
          <ReviewRow number="16" label="What are the applicable statutory requirements?">{textArea("statutoryRequirements")}</ReviewRow>
          <ReviewRow number="17" label="Is there a customer-specified packing method / labelling requirement?"><YesNo value={combinedAnswer(form.customerSpecifiedPacking, form.customerSpecifiedLabelling, true)} disabled={closed} onChange={(v) => setCombined("customerSpecifiedPacking", "customerSpecifiedLabelling", v)} /></ReviewRow>
          <ReviewRow number="18" label="Who pays the freight?"><div className="feasibility-radio-group">{[["BY_COMPANY", "By Company"], ["BY_CUSTOMER", "By Customer"], ["NOT_APPLICABLE", "Not Applicable"]].map(([value, label]) => <label key={value}><input type="radio" checked={form.freightPaidBy === value} disabled={closed} onChange={() => set("freightPaidBy", value)} />{label}</label>)}</div></ReviewRow>
          <ReviewRow number="19" label="What are the payment terms?"><div className="feasibility-payment-terms"><input role="combobox" aria-expanded={paymentTermsOpen && !closed} aria-controls="feasibility-payment-options" aria-autocomplete="list" maxLength={1000} value={form.paymentTerms} disabled={closed} placeholder="Search or enter payment terms" onFocus={() => { setPaymentTermsSearch(""); setPaymentTermsOpen(true); }} onBlur={() => setPaymentTermsOpen(false)} onChange={(e) => { set("paymentTerms", e.target.value); setPaymentTermsSearch(e.target.value); setPaymentTermsOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); movePaymentTerm(1); } if (event.key === "ArrowUp") { event.preventDefault(); movePaymentTerm(-1); } }} />{paymentTermsOpen && !closed && filteredPaymentTerms.length > 0 && <div id="feasibility-payment-options" className="feasibility-payment-options" role="listbox">{filteredPaymentTerms.map((option: any) => <button key={option.value} type="button" role="option" aria-selected={form.paymentTerms === option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { set("paymentTerms", option.value); setPaymentTermsSearch(""); setPaymentTermsOpen(false); }}>{option.label || option.value}</button>)}</div>}</div></ReviewRow>
        </div>
      </section>

      {(record?.feasibility_decision === "NOT_FEASIBLE" || regretLetter) && (
        <section className="feasibility-card feasibility-regret-card">
          <div className="feasibility-section-title">
            <h2>Regret Letter</h2>
            <span className={`regret-status ${String(regretLetter?.letter_status || "NOT_GENERATED").toLowerCase()}`}>{String(regretLetter?.letter_status || "NOT_GENERATED").replace(/_/g, " ")}</span>
          </div>
          <div className="feasibility-regret-body">
            <div className="feasibility-regret-summary">
              <span><strong>Reason</strong>{record?.regret_reason || "-"}</span>
              <span><strong>Generated</strong>{regretLetter?.generated_on || "Not generated"}</span>
              <span><strong>Approved</strong>{regretLetter?.approved_on || "Not approved"}</span>
              <span><strong>Sent</strong>{regretLetter?.sent_on || "Not sent"}</span>
            </div>
            <div className="feasibility-regret-actions">
              {allowedActions.includes("GENERATE_REGRET_LETTER") && <button type="button" className="secondary-action-button" disabled={regretAction !== null} onClick={() => handleRegretAction("GENERATE")}>{regretAction === "GENERATE" ? "Generating..." : regretLetter?.letter_status === "DRAFTED" ? "Regenerate Letter" : "Generate Regret Letter"}</button>}
              {allowedActions.includes("PREVIEW_REGRET_LETTER") && <button type="button" className="secondary-action-button" disabled={regretAction !== null} onClick={() => handleRegretAction("PREVIEW")}>{regretAction === "PREVIEW" ? "Opening..." : "Preview"}</button>}
              {allowedActions.includes("APPROVE_REGRET_LETTER") && <button type="button" className="primary-action-button" disabled={regretAction !== null} onClick={() => handleRegretAction("APPROVE")}>{regretAction === "APPROVE" ? "Approving..." : "Approve"}</button>}
              {allowedActions.includes("SEND_REGRET_LETTER") && <button type="button" className="primary-action-button" disabled={regretAction !== null} onClick={() => setMessage({ type: "success", text: "Mail sending is kept as a UI option only. Email integration will be added later." })}>Send Email</button>}
            </div>
          </div>
        </section>
      )}

      <section className="feasibility-card feasibility-decision-card">
        <div className="feasibility-section-title"><h2>Feasibility Decision</h2></div>
        <div className="feasibility-decision-list">
          <label className={form.feasibilityDecision === "FEASIBLE" ? "selected feasible" : ""}><input type="radio" name="decision" value="FEASIBLE" checked={form.feasibilityDecision === "FEASIBLE"} disabled={closed || persistedClosed} onChange={(e) => set("feasibilityDecision", e.target.value)} /><span><strong>Feasible</strong><small>Close this review and continue to Workout.</small></span></label>
          <label className={form.feasibilityDecision === "NOT_FEASIBLE" ? "selected not-feasible" : ""}><input type="radio" name="decision" value="NOT_FEASIBLE" checked={form.feasibilityDecision === "NOT_FEASIBLE"} disabled={closed || persistedClosed} onChange={(e) => set("feasibilityDecision", e.target.value)} /><span><strong>Not Feasible</strong><small>Close this item and initiate its regret-letter flow.</small></span></label>
        </div>
        {form.feasibilityDecision === "NOT_FEASIBLE" && <label className="feasibility-full-field"><span>Regret Reason *</span><textarea rows={3} maxLength={1000} value={form.regretReason} disabled={closed} onChange={(e) => set("regretReason", e.target.value)} /></label>}
        <label className="feasibility-full-field"><span>Final Remarks</span><textarea rows={3} maxLength={1000} value={form.finalRemarks} disabled={closed} onChange={(e) => set("finalRemarks", e.target.value)} /></label>
        <div className="feasibility-completion-grid">
          <label><span>Completed On</span><input value={record?.feasibility_check_completed_on ?? "Set automatically when closed"} readOnly /></label>
          <label><span>Closed / Approved By</span><input value={record?.closed_by_name ?? "System Administrator"} readOnly /></label>
          <label><span>Role</span><input value={record?.closed_by_role ?? "Administrator"} readOnly /></label>
        </div>
      </section>
    </div>
  );
}
