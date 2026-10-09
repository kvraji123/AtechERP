import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, Save, Send, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { attachmentApi, type StoredAttachment } from "../../../api/attachment.api";
import { purchaseApi } from "../../../api/purchase.api";
import { supplierApi } from "../../../api/supplier.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { useReferenceData } from "../../../hooks/useReferenceData";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import PurchaseOrderAddressSection from "./components/PurchaseOrderAddressSection";
import PurchaseOrderDirectPrList from "./components/PurchaseOrderDirectPrList";
import PurchaseOrderDraftSelector from "./components/PurchaseOrderDraftSelector";
import PurchaseOrderInstructions from "./components/PurchaseOrderInstructions";
import PurchaseOrderLineItems from "./components/PurchaseOrderLineItems";
import PurchaseOrderPreviewDialog from "./components/PurchaseOrderPreviewDialog";
import PurchaseOrderSourceDetails from "./components/PurchaseOrderSourceDetails";
import PurchaseRequestViewDialog from "./components/PurchaseRequestViewDialog";
import { createSupplierWisePoDrafts, getDefaultComparisonDecisions, loadComparisonDecisions, submitPurchaseOrderForApproval } from "./purchaseFlowStore";
import type { PurchaseOrderFormState, PurchaseOrderLine, SupplierPurchaseOrderDraft } from "./purchaseOrderTypes";
import { mapApiRfqPurchaseRequest, type ApiPurchaseRequisitionRow, type RfqPurchaseRequest } from "./purchaseRfqRequests";
import "./PurchaseFlow.css";

type PurchaseRequestDetail = {
  purchase_request_id: number;
  pr_number: string;
  required_date: string;
  preferred_supplier_id?: number | null;
  items: Array<{
    purchase_request_item_id: number;
    item_id: number;
    item_code?: string | null;
    item_description: string;
    item_specification?: string | null;
    approved_quantity?: number | string | null;
    requested_quantity: number | string;
    uom_code: string;
    estimated_rate_per_qty?: number | string | null;
    tax_percent?: number | string | null;
    approval_status: string;
  }>;
};

type BackendPurchaseOrderDetail = {
  purchase_order_id: number;
  po_number: string;
  po_date: string;
  supplier_id: number;
  supplier_code_snapshot: string;
  supplier_name_snapshot: string;
  source_reference: string;
  expected_delivery_date: string;
  payment_terms: string;
  transport_mode?: string | null;
  packing_amount?: number | string | null;
  freight_amount?: number | string | null;
  other_charges_amount?: number | string | null;
  billing_address_snapshot: string;
  delivery_address_snapshot: string;
  remarks: string;
  special_instructions: string;
  status: SupplierPurchaseOrderDraft["status"];
  sources?: Array<{
    prNumber?: string | null;
    pr_number?: string | null;
  }>;
  items: Array<{
    purchase_order_item_id: number;
    purchase_request_item_id?: number | null;
    item_code_snapshot: string;
    item_description_snapshot: string;
    item_specification_snapshot?: string | null;
    ordered_quantity: number | string;
    uom_code_snapshot: string;
    unit_price: number | string;
    tax_percent: number | string;
    discount_amount?: number | string | null;
    packing_amount?: number | string | null;
    freight_amount?: number | string | null;
    other_charges_amount?: number | string | null;
  }>;
};

type PurchaseOrderAttachmentState = {
  file: File | null;
  stored?: StoredAttachment;
};

const loadDrafts = () => {
  const savedDecisions = loadComparisonDecisions();
  return createSupplierWisePoDrafts(savedDecisions.length ? savedDecisions : getDefaultComparisonDecisions());
};

const inputDate = (value?: string | null) => String(value || "").slice(0, 10);

export default function CreatePurchaseOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPoId = searchParams.get("poId");
  const requestedDirectPrIds = searchParams.get("prIds") || "";
  const { showSuccess } = useAppFeedback();
  const referenceData = useReferenceData(["TRANSPORT_MODE"]);
  const [drafts, setDrafts] = useState<SupplierPurchaseOrderDraft[]>(() => editPoId ? [] : loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState(() => editPoId ? "" : loadDrafts()[0]?.id || "");
  const [existingOrderLoading, setExistingOrderLoading] = useState(Boolean(editPoId));
  const [attachments, setAttachments] = useState<Record<string, PurchaseOrderAttachmentState>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [directRequests, setDirectRequests] = useState<ApiPurchaseRequisitionRow[]>([]);
  const [selectedDirectIds, setSelectedDirectIds] = useState<string[]>([]);
  const [directLoading, setDirectLoading] = useState(true);
  const [directPreparing, setDirectPreparing] = useState(false);
  const [directError, setDirectError] = useState("");
  const [viewRequest, setViewRequest] = useState<RfqPurchaseRequest | null>(null);
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || drafts[0];
  const [allowedTransportModes, setAllowedTransportModes] = useState<string[]>([]);

  useEffect(() => {
    const supplierId = Number(activeDraft?.supplierId || 0);
    if (!supplierId) { setAllowedTransportModes([]); return; }
    let active = true;
    supplierApi.getById(supplierId).then((response) => {
      if (active) setAllowedTransportModes(Array.isArray(response?.data?.transportModes) ? response.data.transportModes : []);
    }).catch(() => { if (active) setAllowedTransportModes([]); });
    return () => { active = false; };
  }, [activeDraft?.supplierId]);

  const transportOptions = referenceData.options("TRANSPORT_MODE").filter((option) => allowedTransportModes.includes(option.value));

  const loadDirectRequests = async (notify = false) => {
    setDirectLoading(true);
    setDirectError("");
    try {
      const response = await purchaseApi.listRequisitions({ page: 1, pageSize: 100 });
      const rows = Array.isArray(response?.data) ? response.data as ApiPurchaseRequisitionRow[] : [];
      const eligible = rows.filter((row) =>
        String(row.requisitionType || "").toUpperCase() === "EXISTING_ITEM"
        && ["APPROVED", "PARTIALLY_APPROVED"].includes(String(row.status || "").toUpperCase())
        && Number(row.approvedItemCount || 0) > 0
      );
      setDirectRequests(eligible);
      setSelectedDirectIds((current) => current.filter((id) => eligible.some((row) => String(row.id) === id)));
      if (notify) showSuccess("Approved existing-item PRs refreshed from the backend.");
    } catch (loadError) {
      setDirectRequests([]);
      setSelectedDirectIds([]);
      setDirectError(apiMessage(loadError));
    } finally {
      setDirectLoading(false);
    }
  };

  const unsaved = useUnsavedChanges({drafts,attachments});

  useEffect(() => {
    if (editPoId) {
      setDirectLoading(false);
      return;
    }
    void loadDirectRequests();
  }, [editPoId]);

  useEffect(() => {
    if (!requestedDirectPrIds || !directRequests.length) return;
    const requestedIds = requestedDirectPrIds.split(",").map((id) => id.trim()).filter(Boolean);
    setSelectedDirectIds(requestedIds.filter((id) => directRequests.some((request) => String(request.id) === id)));
  }, [directRequests, requestedDirectPrIds]);

  useEffect(() => {
    if (!editPoId) return;
    let active = true;
    const loadExistingOrder = async () => {
      setExistingOrderLoading(true);
      setError("");
      try {
        const [response, attachmentResponse] = await Promise.all([
          purchaseApi.getPurchaseOrder(editPoId),
          attachmentApi.list("PURCHASE_ORDER", editPoId),
        ]);
        const order = response?.data as BackendPurchaseOrderDetail;
        const sourceReference = order.source_reference || [...new Set((order.sources || [])
          .map((source) => String(source.prNumber || source.pr_number || "").trim())
          .filter(Boolean))].join(", ");
        const draft: SupplierPurchaseOrderDraft = {
          id: `PO-BACKEND-${order.purchase_order_id}`,
          supplierId: String(order.supplier_id || ""),
          supplierCode: order.supplier_code_snapshot || "",
          status: order.status,
          form: {
            mode: /RFQ|PE\//i.test(sourceReference) ? "COMPARISON" : "DIRECT_PR",
            poNumber: order.po_number,
            poDate: inputDate(order.po_date),
            supplierName: `${order.supplier_name_snapshot || ""}${order.supplier_code_snapshot ? ` · ${order.supplier_code_snapshot}` : ""}`,
            sourceReference,
            expectedDelivery: inputDate(order.expected_delivery_date),
            paymentTerms: order.payment_terms || "",
            transportMode: order.transport_mode || "",
            billingAddress: order.billing_address_snapshot || "",
            deliveryAddress: order.delivery_address_snapshot || "",
            packingCharges: Number(order.packing_amount || 0),
            freightCharges: Number(order.freight_amount || 0),
            otherCharges: Number(order.other_charges_amount || 0),
            remarks: order.remarks || "",
            specialInstructions: order.special_instructions || "",
          },
          lines: (order.items || []).map((item) => ({
            id: Number(item.purchase_order_item_id),
            sourceItemId: item.purchase_request_item_id ? String(item.purchase_request_item_id) : undefined,
            enquiryNumber: sourceReference,
            itemCode: item.item_code_snapshot || "",
            itemName: item.item_description_snapshot || "",
            specification: item.item_specification_snapshot || "",
            quantity: Number(item.ordered_quantity || 0),
            uom: item.uom_code_snapshot || "",
            rate: Number(item.unit_price || 0),
            taxPercent: Number(item.tax_percent || 0),
            discount: Number(item.discount_amount || 0),
            freightAndOther: /RFQ|PE\//i.test(sourceReference) ? Number(item.packing_amount || 0) + Number(item.freight_amount || 0) + Number(item.other_charges_amount || 0) : 0,
          })),
        };
        if (!active) return;
        setDrafts((current) => [draft, ...current.filter((entry) => entry.id !== draft.id)]);
        setActiveDraftId(draft.id);
        const storedAttachments = Array.isArray(attachmentResponse?.data) ? attachmentResponse.data as StoredAttachment[] : [];
        if (storedAttachments[0]) {
          setAttachments((current) => ({ ...current, [draft.id]: { file: null, stored: storedAttachments[0] } }));
        }
      } catch (loadError) {
        if (active) setError(apiMessage(loadError));
      } finally {
        if (active) setExistingOrderLoading(false);
      }
    };
    void loadExistingOrder();
    return () => { active = false; };
  }, [editPoId]);

  const prepareDirectDrafts = async () => {
    const selectedRows = directRequests.filter((request) => selectedDirectIds.includes(String(request.id)));
    if (!selectedRows.length) return;
    setDirectPreparing(true);
    setDirectError("");
    try {
      const details = await Promise.all(selectedRows.map(async (row) => {
        const response = await purchaseApi.getRequisition(row.id);
        return { row, detail: response?.data as PurchaseRequestDetail };
      }));
      const supplierGroups = new Map<string, typeof details>();
      details.forEach((entry) => {
        const supplierId = String(entry.row.preferredSupplierId || "");
        supplierGroups.set(supplierId, [...(supplierGroups.get(supplierId) || []), entry]);
      });
      const today = todayInAppTimeZone();
      const directDrafts: SupplierPurchaseOrderDraft[] = Array.from(supplierGroups.entries()).map(([supplierId, entries], draftIndex) => {
        const first = entries[0].row;
        const sourceNumbers = entries.map((entry) => entry.row.prNumber);
        const requiredDates = entries.map((entry) => inputDate(entry.detail.required_date || entry.row.requiredDate)).filter(Boolean).sort();
        const expectedDelivery = requiredDates[requiredDates.length - 1] || "";
        const lines: PurchaseOrderLine[] = entries.flatMap(({ row, detail }) => (detail.items || [])
          .filter((item) => item.approval_status === "APPROVED")
          .map((item) => ({
            id: Number(item.purchase_request_item_id),
            sourceItemId: String(item.purchase_request_item_id),
            enquiryNumber: row.prNumber,
            itemCode: item.item_code || `ITEM-${item.item_id}`,
            itemName: item.item_description,
            specification: item.item_specification || "",
            quantity: Number(item.approved_quantity ?? item.requested_quantity),
            uom: item.uom_code,
            rate: Number(item.estimated_rate_per_qty || 0),
            taxPercent: Number(item.tax_percent || 0),
            discount: 0,
            freightAndOther: 0,
          })));
        return {
          id: `PO-DIRECT-${supplierId}-${draftIndex + 1}`,
          supplierId,
          supplierCode: first.preferredSupplierCode || "",
          status: "DRAFT",
          form: {
            mode: "DIRECT_PR",
            poNumber: `PO/DRAFT/${String(drafts.length + draftIndex + 1).padStart(4, "0")}`,
            poDate: today,
            supplierName: `${first.preferredSupplierName || ""}${first.preferredSupplierCode ? ` · ${first.preferredSupplierCode}` : ""}`,
            sourceReference: sourceNumbers.join(", "),
            expectedDelivery,
            paymentTerms: "As per supplier terms",
            transportMode: "",
            billingAddress: "Atech Automation · Coimbatore",
            deliveryAddress: "Atech Coimbatore / Main Stores",
            packingCharges: 0,
            freightCharges: 0,
            otherCharges: 0,
            remarks: `Direct PO from approved existing-item requisitions ${sourceNumbers.join(", ")}. RFQ not required.`,
            specialInstructions: "Mention PO number on invoice and delivery challan. Supply the approved items as per specification.",
          },
          lines,
        };
      });
      if (!directDrafts.length || directDrafts.some((draft) => !draft.lines.length)) throw new Error("No approved line items are available for the selected PRs.");
      setDrafts((current) => [...current.filter((draft) => draft.form.mode !== "DIRECT_PR"), ...directDrafts]);
      setActiveDraftId(directDrafts[0].id);
      setSelectedDirectIds([]);
      setPreviewOpen(false);
      showSuccess(`${directDrafts.length} supplier-wise direct PO ${directDrafts.length === 1 ? "draft" : "drafts"} prepared.`);
    } catch (prepareError) {
      setDirectError(apiMessage(prepareError));
    } finally {
      setDirectPreparing(false);
    }
  };

  const patchDraft = (updater: (draft: SupplierPurchaseOrderDraft) => SupplierPurchaseOrderDraft) => setDrafts((current) => current.map((draft) => draft.id === activeDraft.id ? updater(draft) : draft));
  const patchValue = (patch: Partial<PurchaseOrderFormState>) => patchDraft((draft) => ({ ...draft, form: { ...draft.form, ...patch } }));
  const patchLine = (lineId: number, patch: Partial<PurchaseOrderLine>) => patchDraft((draft) => ({ ...draft, lines: draft.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) }));

  const validate = () => {
    if (!activeDraft.form.supplierName.trim() || !activeDraft.form.sourceReference || !activeDraft.form.expectedDelivery || !activeDraft.form.transportMode || activeDraft.lines.some((line) => line.quantity <= 0 || line.rate < 0)) {
      setError("Complete the supplier, source, delivery date, actual transport mode and valid item quantity/rate before submission.");
      return false;
    }
    setError("");
    return true;
  };

  const backendPayload = () => ({
    expectedDeliveryDate: activeDraft.form.expectedDelivery,
    paymentTerms: activeDraft.form.paymentTerms,
    transportMode: activeDraft.form.transportMode,
    billingAddress: activeDraft.form.billingAddress,
    deliveryAddress: activeDraft.form.deliveryAddress,
    remarks: activeDraft.form.remarks,
    specialInstructions: activeDraft.form.specialInstructions,
    items: activeDraft.lines.map((line, index) => ({
      purchaseOrderItemId: line.id,
      quantity: line.quantity,
      rate: line.rate,
      discount: line.discount || 0,
      taxPercent: line.taxPercent,
      packing: activeDraft.form.mode === "DIRECT_PR" && index === 0 ? Number(activeDraft.form.packingCharges || 0) : 0,
      freight: activeDraft.form.mode === "DIRECT_PR" && index === 0 ? Number(activeDraft.form.freightCharges || 0) : line.freightAndOther || 0,
      otherCharges: activeDraft.form.mode === "DIRECT_PR" && index === 0 ? Number(activeDraft.form.otherCharges || 0) : 0,
    })),
  });

  const acknowledgeDraft = (snapshot: string, savedAttachments = attachments) => {
    const saved = JSON.parse(snapshot);
    const baseline = JSON.parse(unsaved.baseline());
    const draft = saved.drafts.find((entry: SupplierPurchaseOrderDraft) => entry.id === activeDraft.id);
    const existed = baseline.drafts.some((entry: SupplierPurchaseOrderDraft) => entry.id === activeDraft.id);
    const drafts = baseline.drafts.map((entry: SupplierPurchaseOrderDraft) => entry.id === activeDraft.id ? draft : entry);
    if (!existed && draft) drafts.push(draft);
    // Saving one supplier's PO must not clear other drafts or unuploaded attachments.
    const attachmentState = {
      ...(baseline.attachments || {}),
      [activeDraft.id]: savedAttachments[activeDraft.id] || saved.attachments?.[activeDraft.id] || null,
    };
    unsaved.markSavedValue({ ...baseline, drafts, attachments: attachmentState });
  };

  const saveAttachment = async (): Promise<StoredAttachment | undefined> => {
    if (!editPoId) return undefined;
    const attachment = attachments[activeDraft.id];
    if (!attachment?.file) return attachment?.stored;
    const uploaded = await attachmentApi.upload("PURCHASE_ORDER", editPoId, attachment.file, {
      attachmentType: "SUPPORTING_DOCUMENT",
      attachmentName: attachment.file.name,
    });
    const stored = uploaded.data as StoredAttachment;
    if (attachment.stored?.attachmentId) {
      await attachmentApi.remove("PURCHASE_ORDER", editPoId, attachment.stored.attachmentId);
    }
    return stored;
  };

  const saveDraft = async () => {
    const savedSnapshot = unsaved.snapshot();

    if (!validate()) return;
    try {
      if (!editPoId) { setError("Open a saved purchase order to save changes to the backend. This prepared draft has not been saved yet."); return; }
      await purchaseApi.updatePurchaseOrder(editPoId, backendPayload());
      const stored = await saveAttachment();
      const nextAttachments = { ...attachments, [activeDraft.id]: { file: null, stored } };
      setAttachments(nextAttachments);
      acknowledgeDraft(savedSnapshot, nextAttachments); showSuccess(`${activeDraft.form.poNumber} saved as draft.`);
    } catch (saveError) {
      setError(apiMessage(saveError));
    }
  };

  const submit = async () => {
    const savedSnapshot = unsaved.snapshot();

    if (!validate()) return;
    if (editPoId) {
      try {
        await purchaseApi.updatePurchaseOrder(editPoId, backendPayload());
        const stored = await saveAttachment();
        const nextAttachments = { ...attachments, [activeDraft.id]: { file: null, stored } };
        setAttachments(nextAttachments);
        await purchaseApi.submitPurchaseOrder(editPoId);
        acknowledgeDraft(savedSnapshot, nextAttachments); showSuccess(`${activeDraft.form.poNumber} submitted for approval.`);
        navigate("/purchase/orders", { replace: true });
      } catch (submitError) {
        setError(apiMessage(submitError));
      }
      return;
    }
    const submittedDraft: SupplierPurchaseOrderDraft = { ...activeDraft, status: "SUBMITTED" };
    patchDraft(() => submittedDraft);
    submitPurchaseOrderForApproval(submittedDraft);
    acknowledgeDraft(savedSnapshot); showSuccess(`${activeDraft.form.poNumber} submitted for approval. Other supplier drafts remain separate.`);
  };

  return (
    <div className="purchase-page">
      <header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" aria-label="Go back" onClick={() => navigate(-1)}><ArrowLeft size={19} /></button><span className="purchase-page-module-icon"><ShoppingBag size={19} /></span><div><p>Purchase / Purchase Order</p><h1>Supplier-wise Purchase Orders</h1><span>Create POs from approved supplier decisions or approved existing-item PRs</span></div></div></header>
      <PurchaseModuleTabs />
      <div className="purchase-po-page">
        {!editPoId && <PurchaseOrderDirectPrList
          requests={directRequests}
          selectedIds={selectedDirectIds}
          loading={directLoading}
          preparing={directPreparing}
          error={directError}
          onToggle={(id) => setSelectedDirectIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])}
          onPrepare={() => { void prepareDirectDrafts(); }}
          onRefresh={() => { void loadDirectRequests(true); }}
          onView={(request) => setViewRequest(mapApiRfqPurchaseRequest(request))}
        />}
        {existingOrderLoading ? <section className="purchase-po-no-draft"><ShoppingBag size={22} /><div><h2>Loading PO draft…</h2><p>The newly created purchase-order draft is being prepared for editing.</p></div></section> : activeDraft ? <>
          <div className="purchase-comparison-heading"><ShoppingBag size={18} /><div><strong>Supplier-wise generation applied</strong><span>Items for the same supplier are combined; different suppliers remain in separate POs.</span></div></div>
          <PurchaseOrderDraftSelector drafts={drafts} activeDraftId={activeDraft.id} onSelect={(draftId) => { setActiveDraftId(draftId); setError(""); setPreviewOpen(false); }} action={<div className="purchase-section-actions"><button type="button" className="purchase-secondary-button" onClick={() => { void saveDraft(); }}><Save size={16} /> Save Current Draft</button><button type="button" className="purchase-primary-button" onClick={() => { void submit(); }}><Send size={16} /> Submit Current PO</button></div>} />
          <PurchaseOrderSourceDetails value={activeDraft.form} status={activeDraft.status} onChange={patchValue} />
          <PurchaseOrderAddressSection value={activeDraft.form} transportOptions={transportOptions} onChange={patchValue} />
          <PurchaseOrderLineItems lines={activeDraft.lines} value={activeDraft.form} onChange={patchLine} onFormChange={patchValue} />
          <PurchaseOrderInstructions value={activeDraft.form} attachmentName={attachments[activeDraft.id]?.file?.name || attachments[activeDraft.id]?.stored?.fileName || ""} attachmentUrl={attachments[activeDraft.id]?.stored?.fileUrl} attachmentDisabled={!editPoId} error={error} onChange={patchValue} onAttachment={(file) => setAttachments((current) => ({ ...current, [activeDraft.id]: { file, stored: current[activeDraft.id]?.stored } }))} onPreview={() => setPreviewOpen(true)} onSave={() => { void saveDraft(); }} onSubmit={() => { void submit(); }} />
        </> : <section className="purchase-po-no-draft"><ShoppingBag size={22} /><div><h2>No purchase-order draft selected</h2><p>Select an approved existing-item PR above and prepare the PO draft, or complete supplier selection in Quote Comparison.</p></div><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/quotation-comparison")}>Go to Quote Comparison</button></section>}
      </div>
      {activeDraft && <PurchaseOrderPreviewDialog open={previewOpen} value={activeDraft.form} lines={activeDraft.lines} onClose={() => setPreviewOpen(false)} />}
      <PurchaseRequestViewDialog request={viewRequest} onClose={() => setViewRequest(null)} />
    </div>
  );
}
