import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ClipboardList, ClipboardPlus, ListPlus, Save, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { attachmentApi, type StoredAttachment } from "../../../api/attachment.api";
import { supplierApi } from "../../../api/supplier.api";
import { itemApi } from "../../../api/item.api";
import { purchaseApi, type PurchaseRequestPayload } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import { useAuth } from "../../../context/AuthContext";
import { useReferenceData } from "../../../hooks/useReferenceData";
import PurchaseFormSection from "./components/PurchaseFormSection";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseRequestDetails from "./components/PurchaseRequestDetails";
import PurchaseRequestLineItems, { type PurchaseItemOption } from "./components/PurchaseRequestLineItems";
import { createBlankRequestLine } from "./purchaseData";
import type { PurchaseRequestDetailsState, PurchaseRequestLine, SupplierOption } from "./types";
import "./PurchaseFlow.css";

const today = todayInAppTimeZone();

function requiredFieldMessageFor(
  details: PurchaseRequestDetailsState,
  lines: PurchaseRequestLine[],
  requirePreferredSupplier: boolean,
) {
  const missingRequestFields: string[] = [];
  if (!details.department) missingRequestFields.push("Department");
  if (!details.requisitionType) missingRequestFields.push("Requisition Type");
  if (requirePreferredSupplier && details.requisitionType === "EXISTING_ITEM" && !details.preferredSupplier) {
    missingRequestFields.push("Preferred Supplier for Existing Item");
  }
  if (!details.priority) missingRequestFields.push("Priority");
  if (!details.requestDate) missingRequestFields.push("Request Date");
  if (!details.requiredDate) missingRequestFields.push("Required Date");
  const missingLineFields = lines.flatMap((line, index) => {
    const fields: string[] = [];
    if (!line.itemId) fields.push("Item from Item Master");
    if (!Number(line.quantity) || Number(line.quantity) <= 0) fields.push("Quantity");
    if (!line.uom.trim()) fields.push("UOM");
    if (!line.purpose.trim()) fields.push("Purpose");
    return fields.length ? [`Line ${index + 1}: ${fields.join(", ")}`] : [];
  });
  const missing = [...missingRequestFields, ...missingLineFields];
  return missing.length ? `Complete the following required fields: ${missing.join("; ")}.` : "";
}

export default function CreatePurchaseRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("prId");
  const { user } = useAuth();
  const referenceData = useReferenceData([]);
  const { showSuccess } = useAppFeedback();
  const [details, setDetails] = useState<PurchaseRequestDetailsState>({
    prNumber: "",
    requestedBy: user?.empName || "",
    department: "Production",
    requisitionType: "NEW_ITEM",
    priority: "MEDIUM",
    requestDate: today,
    requiredDate: "",
    preferredSupplier: "",
    remarks: "",
    quoteReference: "",
  });
  const [lines, setLines] = useState<PurchaseRequestLine[]>([createBlankRequestLine(1)]);
  const [itemOptions, setItemOptions] = useState<PurchaseItemOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestStatus, setRequestStatus] = useState("");

  const unsaved = useUnsavedChanges({details,lines});

  useEffect(() => {
    if (!editId) return;
    let active = true;
    const loadRequest = async () => {
      try {
        const response = await purchaseApi.getRequisition(editId);
        const request = response?.data || {};
        const items = Array.isArray(request.items) ? request.items : [];
        const attachmentLists = await Promise.all(items.map((item: any) =>
          attachmentApi.list("PURCHASE_REQUEST_ITEM", Number(item.purchase_request_item_id))
        ));
        if (!active) return;
        const status = String(request.pr_status || "").toUpperCase();
        setRequestStatus(status);
        setDetails({
          prNumber: String(request.pr_number || ""),
          requestedBy: String(request.requested_by || user?.empName || ""),
          department: String(request.floor_department || ""),
          requisitionType: String(request.requisition_type || "NEW_ITEM") as PurchaseRequestDetailsState["requisitionType"],
          priority: String(request.priority || "MEDIUM") as PurchaseRequestDetailsState["priority"],
          requestDate: String(request.request_date || "").slice(0, 10),
          requiredDate: String(request.required_date || "").slice(0, 10),
          preferredSupplier: request.preferred_supplier_id ? String(request.preferred_supplier_id) : "",
          remarks: String(request.remarks || ""),
          quoteReference: String(request.quote_reference || ""),
        });
        setLines(items.map((item: any, index: number) => {
          const attachments = Array.isArray(attachmentLists[index]?.data) ? attachmentLists[index].data as StoredAttachment[] : [];
          const attachment = attachments[0];
          return {
            id: index + 1, purchaseRequestItemId: Number(item.purchase_request_item_id), clarificationReason: String(item.approval_status || "").toUpperCase() === "CLARIFICATION" ? String(item.approval_reason || "") : "", editable: ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(status) || String(item.approval_status || "").toUpperCase() === "CLARIFICATION", itemId: Number(item.item_id), itemCode: String(item.item_code || ""),
            itemGroup: String(item.item_group_name || ""), itemType: String(item.item_type_name || ""),
            itemDescription: String(item.item_description || ""), specification: String(item.item_specification || ""),
            quantity: String(item.requested_quantity || ""), uom: String(item.uom_code || ""),
            ratePerQty: String(item.estimated_rate_per_qty || ""), taxPercent: String(item.tax_percent || ""),
            hsnCode: String(item.hsn_code || ""), purpose: String(item.purpose || ""), attachment: attachment?.fileName || "", attachmentId: attachment?.attachmentId, attachmentUrl: attachment?.fileUrl, attachmentFile: null,
          };
        }));
      } catch (loadError) {
        if (active) setError(apiMessage(loadError));
      }
    };
    void loadRequest();
    return () => { active = false; };
  }, [editId, user?.empName]);

  useEffect(() => {
    let active = true;
    itemApi.list({
      pageSize: 100,
      activeFlag: "Y",
      rateSupplierId: details.preferredSupplier ? Number(details.preferredSupplier) : undefined,
    })
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        const nextOptions = rows.map((item: any) => ({
          itemId: Number(item.itemId), code: item.itemCode, group: item.groupName,
          type: item.typeName, description: item.itemDescription, specification: "",
          uom: item.uomCode,
          hsn: String(item.hsnCode ?? item.hsn_code ?? ""),
          tax: String(item.taxPercent ?? item.tax_percent ?? ""),
          supplierPurchaseRate: item.supplierPurchaseRate,
        }));
        setItemOptions(nextOptions);
        setLines((current) => current.map((line) => {
          if (!line.itemId) return line;
          const selectedItem = nextOptions.find((item) => item.itemId === line.itemId);
          const nextRate = selectedItem?.supplierPurchaseRate == null ? "" : String(selectedItem.supplierPurchaseRate);
          return line.ratePerQty === nextRate ? line : { ...line, ratePerQty: nextRate };
        }));
      })
      .catch((loadError) => { if (active) setError(apiMessage(loadError)); });
    return () => { active = false; };
  }, [details.preferredSupplier]);

  useEffect(() => {
    let active = true;
    supplierApi.list({ pageSize: 100, activeFlag: "Y" })
      .then((response) => {
        if (!active) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setSupplierOptions(rows
          .map((supplier: any): SupplierOption => ({
            id: String(supplier.supplierId),
            code: supplier.supplierCode || String(supplier.supplierId),
            name: supplier.supplierName || "Unnamed supplier",
            rating: 0,
            leadTime: "",
          })));
      })
      .catch((loadError) => { if (active) setError(apiMessage(loadError)); });
    return () => { active = false; };
  }, []);

  const requiredFieldMessage = useMemo(
    () => requiredFieldMessageFor(details, lines, true),
    [details, lines],
  );
  const draftFieldMessage = useMemo(
    () => requiredFieldMessageFor(details, lines, false),
    [details, lines],
  );

  const hasRequiredLines = !requiredFieldMessage;

  const saveDraft = async () => {
    setError("");
    if (draftFieldMessage) { setError(draftFieldMessage); return; }
    setSaving(true);
    try {
      const body = toPayload("DRAFT");
      const response = editId ? await purchaseApi.updateRequisition(editId, body) : await purchaseApi.createRequisition(body);
      const generatedPrNumber = response?.data?.prNumber || response?.data?.pr_number;
      const savedRequestId = Number(response?.data?.purchaseRequestId || response?.data?.purchase_request_id || 0);
      const nextDetails = generatedPrNumber ? { ...details, prNumber: String(generatedPrNumber) } : details;
      if (generatedPrNumber) setDetails(nextDetails);
      const nextLines = await saveLineAttachments(response?.data);
      setLines(nextLines);
      setRequestStatus("DRAFT");
      unsaved.markSavedValue({ details: nextDetails, lines: nextLines });
      // The server response updates React state asynchronously. Reset the current
      // guard state as well so the immediate route change is not treated as a leave.
      unsaved.markSaved();
      showSuccess("Purchase request saved as a draft.");
      if (!editId && savedRequestId) navigate(`/purchase/requests/new?prId=${savedRequestId}`, { replace: true });
    } catch (saveError) { setError(apiMessage(saveError)); } finally { setSaving(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasRequiredLines) { setError(requiredFieldMessage); return; }
    setError(""); setSaving(true);
    try {
      const response = editId ? await purchaseApi.updateRequisition(editId, toPayload("SUBMIT")) : await purchaseApi.createRequisition(toPayload("SUBMIT"));
      const nextLines = await saveLineAttachments(response?.data);
      setLines(nextLines);
      const nextDetails = response?.data?.pr_number ? { ...details, prNumber: String(response.data.pr_number) } : details;
      unsaved.markSavedValue({ details: nextDetails, lines: nextLines });
      // Do not show the unsaved-changes dialog after a successful submission.
      unsaved.markSaved();
      showSuccess("Purchase request submitted for approval.");
      navigate("/purchase/requests");
    } catch (submitError) { setError(apiMessage(submitError)); } finally { setSaving(false); }
  };

  const saveLineAttachments = async (request: any): Promise<PurchaseRequestLine[]> => {
    const savedItems = Array.isArray(request?.items) ? request.items : [];
    const savedLineIndexes = savedItems.length === lines.length
      ? lines.map((_line, index) => index)
      : lines.map((line, index) => line.editable !== false ? index : -1).filter((index) => index >= 0);
    if (savedItems.length !== savedLineIndexes.length) throw new Error("Purchase request was saved, but its attachment line mapping could not be completed.");
    const savedItemsByLineIndex = new Map(savedLineIndexes.map((lineIndex, savedIndex) => [lineIndex, savedItems[savedIndex]]));
    return Promise.all(lines.map(async (line, index) => {
      const savedItem = savedItemsByLineIndex.get(index);
      if (!savedItem) return line;
      const savedItemId = Number(savedItem.purchase_request_item_id || 0);
      if (!savedItemId) throw new Error(`Attachment line ${index + 1} could not be saved.`);
      let attachmentId = line.attachmentId;
      if (line.attachmentFile) {
        const uploaded = await attachmentApi.upload("PURCHASE_REQUEST_ITEM", savedItemId, line.attachmentFile, {
          attachmentType: "SUPPORTING_DOCUMENT",
          attachmentName: line.attachmentFile.name,
        });
        if (attachmentId) await attachmentApi.remove("PURCHASE_REQUEST_ITEM", savedItemId, attachmentId);
        attachmentId = Number((uploaded.data as StoredAttachment).attachmentId);
      }
      const stored = await attachmentApi.list("PURCHASE_REQUEST_ITEM", savedItemId);
      const attachment = Array.isArray(stored?.data) ? stored.data[0] as StoredAttachment | undefined : undefined;
      return {
        ...line,
        purchaseRequestItemId: savedItemId,
        attachment: attachment?.fileName || "",
        attachmentId: attachment?.attachmentId,
        attachmentUrl: attachment?.fileUrl,
        attachmentFile: null,
      };
    }));
  };

  const toPayload = (action: PurchaseRequestPayload["action"]): PurchaseRequestPayload => ({
    action, requestedBy: details.requestedBy.trim() || undefined, plantCode: "Atech Coimbatore",
    department: details.department, requisitionType: details.requisitionType,
    priority: details.priority, requestDate: details.requestDate,
    requiredDate: details.requiredDate, preferredSupplierId: details.preferredSupplier ? Number(details.preferredSupplier) : null,
    quoteReference: details.quoteReference || null, remarks: details.remarks || null,
    items: lines.map((line) => ({ purchaseRequestItemId: line.purchaseRequestItemId, itemId: Number(line.itemId), requestedQuantity: Number(line.quantity), estimatedRatePerQty: Number(line.ratePerQty || 0), taxPercent: Number(line.taxPercent || 0), purpose: line.purpose.trim() })),
  });

  return (
    <div className="purchase-page">
      <header className="purchase-page-header purchase-request-compact-header">
        <div className="purchase-title-group">
          <span className="purchase-page-module-icon"><ClipboardPlus size={19} /></span>
          <div><p>Purchase / Requisitions</p><h1>{editId ? "Update Purchase Request" : "Purchase Request"}</h1><span>{editId ? ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(requestStatus) ? "Revise or delete this request until an approval decision is recorded" : "Update clarification lines and resubmit for approval" : "Raise material requirements for Purchase Manager approval"}</span></div>
        </div>
      </header>

      <PurchaseModuleTabs />

      <form id="purchase-request-form" className="purchase-form" noValidate onSubmit={submit}>
        {error && <div className="marketing-form-alert error" role="alert">{error}</div>}
          <PurchaseFormSection title="Request Details" description="Requester and requisition classification" icon={<ClipboardList size={19} />} action={<div className="purchase-section-actions">{(!editId || ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(requestStatus)) && <button type="button" className="purchase-secondary-button" onClick={() => void saveDraft()} disabled={saving}><Save size={16} /> Save Draft</button>}<button type="submit" form="purchase-request-form" className="purchase-primary-button" disabled={saving}><Send size={16} /> {saving ? "Saving..." : "Submit for Approval"}</button></div>}>
          <PurchaseRequestDetails value={details} onChange={(next) => { setDetails(next); setError(""); }} supplierOptions={supplierOptions} departments={referenceData.departments} />
        </PurchaseFormSection>

        <PurchaseFormSection title="Line Items" description="Choose Item Master values and enter the required quantity and purpose" icon={<ListPlus size={19} />}>
          <PurchaseRequestLineItems lines={lines} onChange={(next) => { setLines(next); setError(""); }} itemOptions={itemOptions} hasPreferredSupplier={Boolean(details.preferredSupplier)} />
        </PurchaseFormSection>
      </form>
    </div>
  );
}
