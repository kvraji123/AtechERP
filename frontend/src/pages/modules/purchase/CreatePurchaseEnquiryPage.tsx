import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, ClipboardCheck, FileSearch, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { supplierApi } from "../../../api/supplier.api";
import { purchaseApi, type SupplierAssignmentEligibleItem } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import PurchaseEnquiryFilters from "./components/PurchaseEnquiryFilters";
import PurchaseEnquiryLines from "./components/PurchaseEnquiryLines";
import PurchaseFormSection from "./components/PurchaseFormSection";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import SupplierAssignmentDrawer from "./components/SupplierAssignmentDrawer";
import SupplierRfqDocuments, { type SupplierRfqDocument } from "./components/SupplierRfqDocuments";
import type { PurchaseEnquiryLine, SupplierOption } from "./types";
import "./PurchaseFlow.css";

type SupplierRow = { supplierId: number; supplierCode: string; supplierName: string; partyType: string };
type RfqRecord = { purchase_enquiry_id: number; enquiry_number: string; enquiry_status: "DRAFT" | "SENT" };
const today = todayInAppTimeZone();

const mapLine = (item: SupplierAssignmentEligibleItem): PurchaseEnquiryLine => ({
  id: Number(item.purchaseRequestItemId), prNumber: item.prNumber, itemCode: item.itemCode || `ITEM-${item.itemId}`,
  itemName: item.itemDescription, itemDescription: item.itemSpecification || "", quantity: Number(item.approvedQuantity), uom: item.uomCode || "—",
  requisitionType: "New Item", enquiryRequired: true, selected: true,
  selectedSupplierIds: String(item.assignedSupplierIds || "").split(",").map((value) => value.trim()).filter(Boolean), enquiryStatus: "Ready", quotes: [],
});

export default function CreatePurchaseEnquiryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess } = useAppFeedback();
  const requestedPrNumbers = searchParams.getAll("pr");
  const prKey = requestedPrNumbers.join("|");
  const [lines, setLines] = useState<PurchaseEnquiryLine[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdRfq, setCreatedRfq] = useState<RfqRecord | null>(null);
  const [selectedPr, setSelectedPr] = useState("ALL");
  const [enquiryDate, setEnquiryDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState("");
  const [deliveryRequiredDate, setDeliveryRequiredDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("Atech Coimbatore / Main Stores");
  const [commercialTerms, setCommercialTerms] = useState("Unit price, GST, freight, payment terms, lead time and quotation validity.");
  const [supplierNotes, setSupplierNotes] = useState("Please mention the RFQ number in your quotation and respond before the due date.");
  const [assigningLineId, setAssigningLineId] = useState<number | null>(null);

  const unsaved = useUnsavedChanges({lines,enquiryDate,dueDate,subject,deliveryRequiredDate,deliveryLocation,commercialTerms,supplierNotes});

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(""); setCreatedRfq(null);
      try {
        const [itemResponse, supplierResponse] = await Promise.all([
          purchaseApi.listSupplierAssignmentEligibleItems(),
          supplierApi.list({ page: 1, pageSize: 100, activeFlag: "Y" }),
        ]);
        if (!active) return;
        const eligible = Array.isArray(itemResponse?.data) ? itemResponse.data as SupplierAssignmentEligibleItem[] : [];
        const suppliers = Array.isArray(supplierResponse?.data) ? supplierResponse.data as SupplierRow[] : [];
        const selectedPrs = new Set(requestedPrNumbers);
        const nextLines = eligible.filter((item) => !selectedPrs.size || selectedPrs.has(item.prNumber)).map(mapLine);
        setLines(nextLines);
        const prNumbers = Array.from(new Set(nextLines.map((line) => line.prNumber)));
        setSelectedPr(prNumbers.length === 1 ? prNumbers[0] : "ALL");
        if (!subject) setSubject(nextLines.length ? `RFQ for ${nextLines.map((line) => line.itemName).join(", ")}` : "");
        if (!deliveryRequiredDate) setDeliveryRequiredDate(today);
        setSupplierOptions(suppliers.map((supplier) => ({ id: String(supplier.supplierId), code: supplier.supplierCode, name: supplier.supplierName, rating: 0, leadTime: "Lead time not specified" })));
      } catch (loadError) {
        if (active) { setLines([]); setSupplierOptions([]); setError(apiMessage(loadError)); }
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [prKey]);

  const approvedPrNumbers = useMemo(() => Array.from(new Set(lines.map((line) => line.prNumber))), [lines]);
  const visibleLines = useMemo(() => selectedPr === "ALL" ? lines : lines.filter((line) => line.prNumber === selectedPr), [lines, selectedPr]);
  const rfqLines = useMemo(() => lines.filter((line) => line.enquiryRequired && line.selected), [lines]);
  const assigningLine = lines.find((line) => line.id === assigningLineId);
  const supplierById = useMemo(() => new Map(supplierOptions.map((supplier) => [supplier.id, supplier])), [supplierOptions]);
  const supplierRfqDocuments = useMemo<SupplierRfqDocument[]>(() => {
    const supplierIds = Array.from(new Set(rfqLines.flatMap((line) => line.selectedSupplierIds)));
    const status = !createdRfq ? "NOT_GENERATED" : createdRfq.enquiry_status === "SENT" ? "SENT" : "GENERATED";
    return supplierIds.map((supplierId) => {
      const supplier = supplierById.get(supplierId);
      const items = rfqLines.filter((line) => line.selectedSupplierIds.includes(supplierId)).map((line) => ({ prNumber: line.prNumber, itemCode: line.itemCode, itemName: line.itemName, specification: line.itemDescription, quantity: line.quantity, uom: line.uom }));
      return { supplierId, supplierName: supplier?.name || supplierId, supplierCode: supplier?.code || supplierId, itemCount: items.length, items, rfqNumber: createdRfq?.enquiry_number || "Pending", status };
    });
  }, [createdRfq, rfqLines, supplierById]);
  const patchLine = (id: number, patch: Partial<PurchaseEnquiryLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const payload = () => ({ enquiryDate, quoteDueDate: dueDate, subject, deliveryRequiredBy: deliveryRequiredDate || undefined, deliveryLocation, commercialTerms, notes: supplierNotes, items: rfqLines.map((line) => ({ purchaseRequestItemId: line.id, quantity: line.quantity, supplierIds: line.selectedSupplierIds.map(Number) })) });
  const saveRfqDraft = async () => {
    const savedSnapshot = unsaved.snapshot();

    if (createdRfq) { showSuccess("This RFQ draft is already saved. Send it when ready."); return; }
    setSaving(true); setError("");
    try { const response = await purchaseApi.createRfq({ ...payload(), action: "DRAFT" }); const data = response?.data as RfqRecord; unsaved.markSaved(savedSnapshot); setCreatedRfq(data); showSuccess(`${data.enquiry_number} saved as an RFQ draft.`); }
    catch (saveError) { setError(apiMessage(saveError)); } finally { setSaving(false); }
  };
  const sendRfq = async () => {
    if (!createdRfq) return;
    setSaving(true); setError("");
    try { const response = await purchaseApi.sendRfq(createdRfq.purchase_enquiry_id); setCreatedRfq(response?.data as RfqRecord); showSuccess("RFQ sent to the assigned suppliers. Email delivery is queued in the backend."); }
    catch (sendError) { setError(apiMessage(sendError)); } finally { setSaving(false); }
  };

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" aria-label="Return to approved PR list" onClick={() => navigate("/purchase/enquiries/new")}><ArrowLeft size={19} /></button><div><p>Purchase / Supplier Enquiry</p><h1>Create Purchase Enquiry</h1><span>Review approved PR items, assigned suppliers and RFQ terms</span></div></div></header>
    <PurchaseModuleTabs />
    <div className="purchase-form">
      {loading ? <div className="purchase-po-approval-empty">Loading approved PR items and supplier assignments...</div> : <>
        <PurchaseFormSection title="Enquiry & RFQ Details" description="PR and supplier assignments are read from the backend; commercial RFQ terms remain editable" icon={<FileSearch size={19} />} action={<div className="purchase-section-actions"><button type="button" className="purchase-secondary-button" disabled={saving || Boolean(createdRfq)} onClick={() => { void saveRfqDraft(); }}><Save size={16} /> {createdRfq ? "Draft Saved" : saving ? "Saving…" : "Save Draft"}</button></div>}>
          <PurchaseEnquiryFilters enquiryNumber={createdRfq?.enquiry_number || "Generated on save"} selectedPr={selectedPr} approvedPrNumbers={approvedPrNumbers} enquiryDate={enquiryDate} dueDate={dueDate} subject={subject} deliveryRequiredDate={deliveryRequiredDate} deliveryLocation={deliveryLocation} commercialTerms={commercialTerms} supplierNotes={supplierNotes} onSelectedPrChange={setSelectedPr} onEnquiryDateChange={setEnquiryDate} onDueDateChange={setDueDate} onSubjectChange={setSubject} onDeliveryRequiredDateChange={setDeliveryRequiredDate} onDeliveryLocationChange={setDeliveryLocation} onCommercialTermsChange={setCommercialTerms} onSupplierNotesChange={setSupplierNotes} />
        </PurchaseFormSection>
        <PurchaseFormSection title="Enquiry Items & Supplier Assignment" description="Supplier assignments are loaded from the backend and are applied item by item" icon={<ClipboardCheck size={19} />}>
          <PurchaseEnquiryLines lines={visibleLines} onToggleLine={(id) => patchLine(id, { selected: !lines.find((line) => line.id === id)?.selected })} onToggleAll={(selected) => setLines((current) => current.map((line) => visibleLines.some((visible) => visible.id === line.id) ? { ...line, selected } : line))} onAssignSuppliers={(line) => setAssigningLineId(line.id)} />
        </PurchaseFormSection>
        <SupplierRfqDocuments documents={supplierRfqDocuments} details={{ enquiryNumber: createdRfq?.enquiry_number || "Generated on save", enquiryDate, dueDate, subject, deliveryRequiredDate, deliveryLocation, commercialTerms, supplierNotes }} onGenerate={() => { void saveRfqDraft(); }} onSend={() => { void sendRfq(); }} onOpenComparison={() => navigate("/purchase/quotation-comparison")} />
        <SupplierAssignmentDrawer open={Boolean(assigningLine)} itemName={assigningLine?.itemName || "Item"} suppliers={supplierOptions} selectedSupplierIds={assigningLine?.selectedSupplierIds || []} onClose={() => setAssigningLineId(null)} onApply={(supplierIds) => { if (assigningLineId !== null) patchLine(assigningLineId, { selectedSupplierIds: supplierIds }); setAssigningLineId(null); showSuccess("Supplier selection will be included when the RFQ draft is saved."); }} />
      </>}
      {error && <div className="marketing-form-alert error" role="alert">{error}</div>}
    </div>
  </div>;
}
