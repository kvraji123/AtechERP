import { FilePlus2, Mail, RadioTower } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppFeedback } from "../../../components/AppFeedback";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import QuotationAttachmentDialog, { type SupplierQuotationEntry } from "./components/QuotationAttachmentDialog";
import RfqTrackingDashboard from "./components/RfqTrackingDashboard";
import RfqTrackingDrawer from "./components/RfqTrackingDrawer";
import RfqTrackingFilters from "./components/RfqTrackingFilters";
import RfqTrackingTable from "./components/RfqTrackingTable";
import SupplierRfqPreviewDialog, { type SupplierRfqItem } from "./components/SupplierRfqPreviewDialog";
import type { RfqTrackingRecord, RfqTrackingStatus } from "./rfqTrackingData";
import "./PurchaseFlow.css";

type ApiRow = Record<string, unknown>;
type RfqDetail = { items?: ApiRow[]; suppliers?: ApiRow[] } & ApiRow;
const displayDate = (value: unknown) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB") : "—";
const number = (value: unknown) => Number(value || 0);
const attachmentUrl = (value: unknown) => {
  const path = String(value || ""); if (!path || !path.startsWith("/")) return path || undefined;
  return `${(import.meta.env.VITE_API_BASE_URL || "http://localhost:4100/api/v1").replace(/\/api\/v1$/, "")}${path}`;
};
const attachmentPath = (value?: string) => { try { return value?.startsWith("http") ? new URL(value).pathname : value; } catch { return value; } };

const mapTrackingRecord = (row: ApiRow): RfqTrackingRecord => ({
  id: `${row.enquiryId}-${row.supplierId}`,
  enquiryId: number(row.enquiryId), supplierId: number(row.supplierId),
  rfqNumber: String(row.enquiryNumber || "—"), revision: row.supplierQuotationNumber ? `Quote ${row.supplierQuotationNumber}` : "Original",
  enquiryNumber: String(row.enquiryNumber || "—"), prNumbers: String(row.prNumbers || "—"),
  supplierName: String(row.supplierName || "—"), supplierCode: String(row.supplierCode || "—"), supplierEmail: row.supplierEmail as string | null,
  itemCount: number(row.itemCount), itemSummary: String(row.itemSummary || "—"), items: [],
  sentDate: displayDate(row.sentOn || row.emailCompletedAt || row.emailQueuedAt || row.enquiryDate), dueDate: displayDate(row.quoteDueDate),
  response: String(row.response || "Awaiting supplier reply"), status: String(row.status || "AWAITING_RESPONSE") as RfqTrackingStatus,
  subject: row.subject as string | null, deliveryRequiredBy: row.deliveryRequiredBy as string | null,
  deliveryLocation: row.deliveryLocation as string | null, commercialTerms: row.commercialTerms as string | null, notes: row.notes as string | null,
  supplierQuotationId: row.supplierQuotationId ? number(row.supplierQuotationId) : null,
  supplierQuotationNumber: row.supplierQuotationNumber as string | null, quotationStatus: row.quotationStatus as string | null,
  quotationReceivedOn: row.quotationReceivedOn as string | null, emailJobStatus: row.emailJobStatus as string | null,
  emailQueuedAt: row.emailQueuedAt as string | null, emailCompletedAt: row.emailCompletedAt as string | null, emailLastError: row.emailLastError as string | null,
});

const assignedItems = (detail: RfqDetail, supplierId: number): SupplierRfqItem[] => {
  const assignmentIds = new Set((detail.suppliers || []).filter((entry) => number(entry.supplier_id) === supplierId).map((entry) => number(entry.purchase_enquiry_item_id)));
  return (detail.items || []).filter((item) => assignmentIds.has(number(item.purchase_enquiry_item_id))).map((item) => ({
    enquiryItemId: number(item.purchase_enquiry_item_id), prNumber: String(item.pr_number || "—"), itemCode: String(item.item_code || item.item_id || "—"),
    itemName: String(item.item_description || item.item_type_name || "—"), specification: String(item.item_specification || "—"),
    quantity: number(item.enquiry_quantity), uom: String(item.uom_code || "Nos"),
  }));
};

export default function RfqTrackingPage() {
  const navigate = useNavigate(); const [searchParams] = useSearchParams(); const { showSuccess } = useAppFeedback();
  const [records, setRecords] = useState<RfqTrackingRecord[]>([]); const [summary, setSummary] = useState({ total: 0, quotesReceived: 0, awaitingResponse: 0 }); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("pr") || ""); const [status, setStatus] = useState<"ALL" | RfqTrackingStatus>("ALL"); const [supplier, setSupplier] = useState("ALL"); const [suppliers, setSuppliers] = useState<string[]>([]); const [dueDate, setDueDate] = useState("ALL");
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<RfqTrackingRecord | null>(null); const [quotationRecord, setQuotationRecord] = useState<RfqTrackingRecord | null>(null); const [previewRecord, setPreviewRecord] = useState<RfqTrackingRecord | null>(null); const [quotationInitialValue, setQuotationInitialValue] = useState<SupplierQuotationEntry | undefined>();

  const loadRecords = useCallback(async () => {
    setLoading(true); setLoadError("");
    try { const [response, summaryResponse] = await Promise.all([purchaseApi.listRfqTracking({ page, pageSize: PAGE_SIZE, search, status, supplier: supplier === "ALL" ? "" : supplier, dueDate }), purchaseApi.rfqTrackingSummary()]); setRecords(((response?.data || []) as ApiRow[]).map(mapTrackingRecord)); setTotal(Number(response?.meta?.total || 0)); setSummary(summaryResponse?.data || {}); }
    catch (error) { setLoadError(apiMessage(error)); setRecords([]); }
    finally { setLoading(false); }
  }, [dueDate, page, search, status, supplier]);
  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => { void purchaseApi.listRfqTrackingSuppliers().then((response) => setSuppliers(Array.isArray(response?.data) ? response.data.filter(Boolean) : [])).catch((reason) => setLoadError(apiMessage(reason))); }, []);

  const filtered = useMemo(() => records, [records]);

  const loadDetail = async (record: RfqTrackingRecord) => {
    const response = await purchaseApi.getRfq(record.enquiryId); const detail = response?.data as RfqDetail;
    return { detail, record: { ...record, items: assignedItems(detail, record.supplierId) } };
  };
  const openQuotation = async (record: RfqTrackingRecord) => {
    try {
      const { record: enriched } = await loadDetail(record); let initial: SupplierQuotationEntry | undefined;
      if (record.supplierQuotationId) { const quoteResponse = await purchaseApi.getSupplierQuotation(record.supplierQuotationId); const quote = quoteResponse?.data as ApiRow & { items?: ApiRow[] }; initial = { supplierId: String(record.supplierId), quotationNumber: String(quote.supplier_quotation_number || ""), quotationDate: String(quote.supplier_quotation_date || "").slice(0, 10), validUntil: String(quote.quotation_valid_until || "").slice(0, 10), paymentTerms: String(quote.payment_terms || ""), packingPercent: number(quote.subtotal_amount) ? String(number(quote.packing_amount) * 100 / number(quote.subtotal_amount)) : "0", attachmentName: String(quote.attachment_file_name || ""), attachmentUrl: attachmentUrl(quote.attachment_file_url), status: "RECEIVED", lines: enriched.items.map((item) => { const saved = quote.items?.find((line) => number(line.purchase_enquiry_item_id) === item.enquiryItemId); return { itemCode: item.itemCode, itemName: item.itemName, quantity: item.quantity, uom: item.uom, unitRate: String(saved?.unit_price ?? ""), discount: String(saved?.discount_amount ?? 0), taxPercent: String(saved?.tax_percent ?? 0), packingCharge: String(saved?.packing_amount ?? 0), freightAndOther: String(number(saved?.freight_amount) + number(saved?.other_charges_amount)), deliveryDays: String(saved?.delivery_lead_days ?? ""), warranty: saved?.warranty_months ? `${saved.warranty_months} months` : "" }; }) }; }
      setQuotationInitialValue(initial); setQuotationRecord(enriched);
    } catch (error) { window.alert(apiMessage(error)); }
  };
  const openPreview = async (record: RfqTrackingRecord) => { try { const { record: enriched } = await loadDetail(record); setSelectedRecord(null); setPreviewRecord(enriched); } catch (error) { window.alert(apiMessage(error)); } };
  const saveQuotation = async (entry: SupplierQuotationEntry) => {
    if (!quotationRecord) return;
    try {
      await purchaseApi.createSupplierQuotation({ purchaseEnquiryId: quotationRecord.enquiryId, supplierId: quotationRecord.supplierId, supplierQuotationNumber: entry.quotationNumber, supplierQuotationDate: entry.quotationDate, quotationValidUntil: entry.validUntil || undefined, paymentTerms: entry.paymentTerms, attachmentFileName: entry.attachmentName || undefined, attachmentFileUrl: attachmentPath(entry.attachmentUrl), items: entry.lines.map((line) => { const source = quotationRecord.items.find((item) => item.itemCode === line.itemCode); return { purchaseEnquiryItemId: number(source?.enquiryItemId), quoteResponse: "QUOTED", quotedQuantity: line.quantity, unitPrice: number(line.unitRate), discountAmount: number(line.discount), taxPercent: number(line.taxPercent), freightAmount: 0, packingAmount: number(line.packingCharge), otherChargesAmount: number(line.freightAndOther), deliveryLeadDays: number(line.deliveryDays) || undefined, warrantyMonths: Number(String(line.warranty).match(/\d+/)?.[0]) || undefined }; }) });
      setQuotationRecord(null); setQuotationInitialValue(undefined); await loadRecords(); showSuccess("Supplier quotation saved to the backend and is ready for comparison.");
    } catch (error) { window.alert(apiMessage(error)); }
  };

  const previewDetails = { enquiryNumber: previewRecord?.enquiryNumber || "", approvedPrReferences: previewRecord?.prNumbers || "", enquiryDate: previewRecord?.sentDate === "—" ? "" : previewRecord?.sentDate.split("/").reverse().join("-") || "", dueDate: previewRecord?.dueDate === "—" ? "" : previewRecord?.dueDate.split("/").reverse().join("-") || "", subject: previewRecord?.subject || "", deliveryRequiredDate: previewRecord?.deliveryRequiredBy || "", deliveryLocation: previewRecord?.deliveryLocation || "", commercialTerms: previewRecord?.commercialTerms || "", supplierNotes: previewRecord?.notes || "" };

  return <div className="purchase-page"><header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-back-button"><RadioTower size={19} /></span><div><p>Purchase / RFQ Tracking</p><h1>RFQ Tracking</h1><span>Track supplier-wise RFQ dispatch, received quotations and comparison readiness</span></div></div></header><PurchaseModuleTabs /><div className="purchase-rfq-tracking-page"><RfqTrackingDashboard summary={summary} activeStatus={status} onStatusChange={(value) => { setStatus(value); setPage(1); }} /><section className="purchase-rfq-tracking-list"><header><div><h2>Supplier RFQ Records</h2><p>RFQ, supplier assignment, email-job and quotation information is read from the backend.</p></div><div className="purchase-list-head-actions"><span>{total} records</span><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/rfqs/email-outbox")}><Mail size={15} /> Email Outbox</button><button type="button" className="purchase-primary-button" onClick={() => navigate("/purchase/enquiries/new")}><FilePlus2 size={15} /> Create RFQ</button></div></header><RfqTrackingFilters suppliers={suppliers} search={search} status={status} supplier={supplier} dueDate={dueDate} onSearchChange={(value) => { setSearch(value); setPage(1); }} onStatusChange={(value) => { setStatus(value); setPage(1); }} onSupplierChange={(value) => { setSupplier(value); setPage(1); }} onDueDateChange={(value) => { setDueDate(value); setPage(1); }} onRefresh={() => { void loadRecords(); }}  pagination={<Pagination page={page} total={total} onPageChange={setPage} itemLabel="RFQ records" disabled={loading} />} />{loading ? <div className="purchase-rfq-tracking-empty">Loading RFQ tracking records…</div> : loadError ? <div className="purchase-rfq-tracking-empty">Unable to load RFQ tracking: {loadError}</div> : <RfqTrackingTable records={filtered} onView={setSelectedRecord} onRemind={(record) => showSuccess(`A reminder can be queued after the email worker is configured for ${record.supplierName}.`)} onQuotation={(record) => { void openQuotation(record); }} />}</section></div><RfqTrackingDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} onRemind={(record) => showSuccess(`A reminder can be queued after the email worker is configured for ${record.supplierName}.`)} onQuotation={(record) => { void openQuotation(record); }} onViewRfq={(record) => { void openPreview(record); }} onOpenComparison={() => navigate(`/purchase/quotation-comparison?enquiry=${selectedRecord?.enquiryId || ""}`)} /><SupplierRfqPreviewDialog document={previewRecord ? { supplierName: previewRecord.supplierName, supplierCode: previewRecord.supplierCode, rfqNumber: previewRecord.rfqNumber, itemCount: previewRecord.itemCount, items: previewRecord.items } : null} details={previewDetails} onClose={() => { setPreviewRecord(null); }} /><QuotationAttachmentDialog open={Boolean(quotationRecord)} supplierId={String(quotationRecord?.supplierId || "")} supplierName={quotationRecord?.supplierName || ""} rfqNumber={quotationRecord?.rfqNumber || ""} items={quotationRecord?.items || []} initialValue={quotationInitialValue} onClose={() => { setQuotationRecord(null); setQuotationInitialValue(undefined); }} onSave={(entry) => { void saveQuotation(entry); }} onExtractPdf={async (file) => { try { const response = await purchaseApi.uploadSupplierQuotationAttachment(file); return response?.data || {}; } catch (error) { throw new Error(apiMessage(error)); } }} /></div>;
}
