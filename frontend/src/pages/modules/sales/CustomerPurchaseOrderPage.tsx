import { ArrowLeft, CheckCircle2, FileCheck2, Save, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import {
  customerPurchaseOrderApi,
  type CustomerPurchaseOrder,
  type CustomerPurchaseOrderItem,
  type CustomerPurchaseOrderPayload,
  type CustomerPurchaseOrderSource,
} from "../../../api/customerPurchaseOrder.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import "./CustomerPurchaseOrder.css";

type FormState = {
  customerPoNumber: string;
  customerPoDate: string;
  requiredDeliveryDate: string;
  paymentTerms: string;
  deliveryTerms: string;
  attachmentReference: string;
  remarks: string;
};

type SelectableLine = CustomerPurchaseOrderItem & { selected: boolean };

const emptyForm = (): FormState => ({
  customerPoNumber: "",
  customerPoDate: new Date().toISOString().slice(0, 10),
  requiredDeliveryDate: "",
  paymentTerms: "",
  deliveryTerms: "",
  attachmentReference: "",
  remarks: "",
});

const asNumber = (value: unknown) => Number(value || 0);
const total = (lines: SelectableLine[]) => lines.filter((line) => line.selected).reduce((sum, line) => sum + asNumber(line.orderedQuantity) * asNumber(line.unitPrice) + asNumber(line.developmentCost), 0);
const developmentTotal = (lines: SelectableLine[]) => lines.filter((line) => line.selected).reduce((sum, line) => sum + asNumber(line.developmentCost), 0);
const itemCount = (lines: SelectableLine[]) => lines.filter((line) => line.selected).length;
const dateValue = (value?: string | null) => String(value || "").slice(0, 10);

const money = (currency: string, value: number | string) => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(asNumber(value)); }
  catch { return `${currency || "INR"} ${asNumber(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`; }
};

const statusLabel = (status: string) => ({ DRAFT: "Draft", CONFIRMED: "Confirmed", PARTIALLY_CONVERTED: "Partially Converted", CONVERTED: "Converted", CANCELLED: "Cancelled" }[status] || status.replace(/_/g, " "));

function sourceLines(source: CustomerPurchaseOrderSource): SelectableLine[] {
  return source.items.map((line) => ({ ...line, id: line.id || 0, selected: asNumber(line.availableQuantity) > 0, orderedQuantity: asNumber(line.availableQuantity) }));
}

function existingLines(order: CustomerPurchaseOrder, source: CustomerPurchaseOrderSource | null = null): SelectableLine[] {
  const availableByQuotationItem = new Map(
    (source?.items || []).map((line) => [line.quotationItemId, asNumber(line.availableQuantity)])
  );
  return order.items.map((line) => ({
    ...line,
    availableQuantity: availableByQuotationItem.get(line.quotationItemId) ?? line.orderedQuantity,
    selected: true,
  }));
}

export default function CustomerPurchaseOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { showSuccess } = useAppFeedback();
  const [eligibleSources, setEligibleSources] = useState<CustomerPurchaseOrderSource[]>([]);
  const [source, setSource] = useState<CustomerPurchaseOrderSource | null>(null);
  const [order, setOrder] = useState<CustomerPurchaseOrder | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<SelectableLine[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const locked = Boolean(order && order.status !== "DRAFT");
  const sourceId = source?.enquiryId || order?.enquiryId || 0;
  const currency = source?.currencyCode || order?.currencyCode || "INR";
  const grandTotal = useMemo(() => total(lines), [lines]);

  const loadEligibleSources = async () => {
    try {
      const response = await customerPurchaseOrderApi.listEligibleEnquiries();
      setEligibleSources(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      setError(apiMessage(loadError));
    }
  };

  const loadSource = async (enquiryId: string | number) => {
    if (!enquiryId) return;
    setLoading(true);
    setError("");
    try {
      const response = await customerPurchaseOrderApi.getEnquirySource(enquiryId);
      const selectedSource = response?.data as CustomerPurchaseOrderSource;
      setSource(selectedSource);
      setLines(sourceLines(selectedSource));
      setForm((current) => ({ ...current, requiredDeliveryDate: current.requiredDeliveryDate || dateValue(selectedSource.requiredDate) }));
    } catch (loadError) {
      setSource(null);
      setLines([]);
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = async (orderId: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await customerPurchaseOrderApi.get(orderId);
      const selectedOrder = response?.data as CustomerPurchaseOrder;
      setOrder(selectedOrder);
      setLines(existingLines(selectedOrder));
      setForm({
        customerPoNumber: selectedOrder.customerPoNumber || "",
        customerPoDate: dateValue(selectedOrder.customerPoDate),
        requiredDeliveryDate: dateValue(selectedOrder.requiredDeliveryDate),
        paymentTerms: selectedOrder.paymentTerms || "",
        deliveryTerms: selectedOrder.deliveryTerms || "",
        attachmentReference: selectedOrder.attachmentReference || "",
        remarks: selectedOrder.remarks || "",
      });
      const sourceResponse = await customerPurchaseOrderApi.getEnquirySource(selectedOrder.enquiryId);
      const selectedSource = sourceResponse?.data as CustomerPurchaseOrderSource;
      setSource(selectedSource);
      setLines(existingLines(selectedOrder, selectedSource));
    } catch (loadError) {
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadEligibleSources(); }, []);
  useEffect(() => {
    if (id) { void loadOrder(id); return; }
    const enquiryId = searchParams.get("enquiryId");
    if (enquiryId) void loadSource(enquiryId);
  }, [id, searchParams]);

  const updateForm = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const toggleLine = (quotationItemId: number) => {
    if (locked) return;
    setLines((current) => current.map((line) => line.quotationItemId === quotationItemId ? { ...line, selected: !line.selected } : line));
  };
  const updateQuantity = (quotationItemId: number, value: string) => {
    if (locked) return;
    const next = Number(value || 0);
    setLines((current) => current.map((line) => line.quotationItemId === quotationItemId ? { ...line, orderedQuantity: next } : line));
  };

  const payload = (): CustomerPurchaseOrderPayload | null => {
    if (!sourceId) { setError("Select an eligible Order Received enquiry."); return null; }
    const selected = lines.filter((line) => line.selected);
    if (!selected.length) { setError("Select at least one Customer PO item."); return null; }
    return {
      enquiryId: sourceId,
      customerPoNumber: form.customerPoNumber || null,
      customerPoDate: form.customerPoDate || null,
      requiredDeliveryDate: form.requiredDeliveryDate || null,
      paymentTerms: form.paymentTerms || null,
      deliveryTerms: form.deliveryTerms || null,
      attachmentReference: form.attachmentReference || null,
      remarks: form.remarks || null,
      items: selected.map((line) => ({ quotationItemId: line.quotationItemId, orderedQuantity: asNumber(line.orderedQuantity) })),
    };
  };

  const saveDraft = async (): Promise<CustomerPurchaseOrder | null> => {
    const body = payload();
    if (!body) return null;
    setSaving(true);
    setError("");
    try {
      const response = order
        ? await customerPurchaseOrderApi.update(order.id, body)
        : await customerPurchaseOrderApi.create(body);
      const saved = response?.data as CustomerPurchaseOrder;
      setOrder(saved);
      setLines(existingLines(saved, source));
      showSuccess(order ? "Customer PO draft updated." : "Customer PO draft created.");
      if (!id) navigate(`/sales/customer-pos/${saved.id}`, { replace: true });
      return saved;
    } catch (saveError) {
      setError(apiMessage(saveError));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!form.customerPoNumber.trim() || !form.customerPoDate) {
      setError("Customer PO number and Customer PO date are required before confirmation.");
      return;
    }
    const saved = await saveDraft();
    if (!saved) return;
    setSaving(true);
    setError("");
    try {
      const response = await customerPurchaseOrderApi.confirm(saved.id);
      const confirmed = response?.data as CustomerPurchaseOrder;
      setOrder(confirmed);
      setLines(existingLines(confirmed, source));
      showSuccess(`${confirmed.cpoNumber} confirmed and ready for Sales Order conversion.`);
    } catch (confirmError) {
      setError(apiMessage(confirmError));
    } finally {
      setSaving(false);
    }
  };

  const convert = async () => {
    if (!order) return;
    setSaving(true);
    setError("");
    try {
      const response = await customerPurchaseOrderApi.convertToSalesOrder(order.id);
      showSuccess(`${response?.data?.salesOrderNumber || "Sales Order"} created from ${order.cpoNumber}.`);
      await loadOrder(String(order.id));
    } catch (convertError) {
      setError(apiMessage(convertError));
    } finally {
      setSaving(false);
    }
  };

  const canConvert = Boolean(order && ["CONFIRMED", "PARTIALLY_CONVERTED"].includes(order.status));

  return (
    <div className="customer-po-page">
      <header className="customer-po-header">
        <div className="customer-po-heading"><button type="button" className="customer-po-secondary" aria-label="Back to Customer PO list" onClick={() => navigate("/sales/customer-pos")}><ArrowLeft size={15} /></button><span className="customer-po-heading-icon"><FileCheck2 size={18} /></span><div><p>Sales / Customer PO</p><h1>{order?.cpoNumber ? `${order.cpoNumber} · Customer PO` : "Create Customer PO"}</h1><span>Use only finalized quotations from enquiries marked Order Received.</span></div></div>
        {order && <span className={`customer-po-status ${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span>}
      </header>

      {error && <p className="customer-po-error" role="alert">{error}</p>}

      <div className="customer-po-form-grid">
        <div>
          <section className="customer-po-panel">
            <div className="customer-po-panel-title"><h2>Source and customer</h2><span>Order Received only</span></div>
            {!locked && <div className="customer-po-source-note"><CheckCircle2 size={15} />Select an enquiry with Order Received status. Customer, order type, quantities and commercial rates are loaded from its finalized quotation.</div>}
            <div className="customer-po-field-grid">
              <label className="wide">Enquiry document no. <span className="customer-po-required">*</span>
                <select value={sourceId || ""} disabled={Boolean(order) || loading} onChange={(event) => { void loadSource(event.target.value); }}><option value="">Select Order Received enquiry</option>{eligibleSources.map((item) => <option key={item.enquiryId} value={item.enquiryId}>{item.docNo} · {item.customerName} · {item.orderType}</option>)}</select>
              </label>
              <label>Customer name<input value={source?.customerName || order?.customerName || ""} readOnly /></label>
              <label>Order type<input value={source?.orderType || order?.orderType || ""} readOnly /></label>
              <label>Finalized quotation<input value={source?.quotationNo || order?.quotationNo || ""} readOnly /></label>
              <label>Currency<input value={currency} readOnly /></label>
            </div>
          </section>

          <section className="customer-po-panel">
            <div className="customer-po-panel-title"><h2>Customer PO and delivery details</h2><span>{locked ? "Confirmed values" : "Complete before confirmation"}</span></div>
            <div className="customer-po-field-grid">
              <label>Customer PO number <span className="customer-po-required">*</span><input value={form.customerPoNumber} disabled={locked} onChange={(event) => updateForm("customerPoNumber", event.target.value)} placeholder="Customer’s PO reference" /></label>
              <label>Customer PO date <span className="customer-po-required">*</span><input type="date" value={form.customerPoDate} disabled={locked} onChange={(event) => updateForm("customerPoDate", event.target.value)} /></label>
              <label>Required delivery date<input type="date" value={form.requiredDeliveryDate} disabled={locked} onChange={(event) => updateForm("requiredDeliveryDate", event.target.value)} /></label>
              <label>Payment terms<input value={form.paymentTerms} disabled={locked} onChange={(event) => updateForm("paymentTerms", event.target.value)} placeholder="e.g. Net 30 days" /></label>
              <label className="wide">Delivery terms<input value={form.deliveryTerms} disabled={locked} onChange={(event) => updateForm("deliveryTerms", event.target.value)} placeholder="e.g. Ex works / Delivery at customer plant" /></label>
              <label className="wide">Attachment reference<input value={form.attachmentReference} disabled={locked} onChange={(event) => updateForm("attachmentReference", event.target.value)} placeholder="Customer PO PDF file name or attachment reference" /></label>
              <label className="wide">Remarks<textarea value={form.remarks} disabled={locked} onChange={(event) => updateForm("remarks", event.target.value)} placeholder="Optional commercial or delivery remarks" /></label>
            </div>
          </section>
        </div>

        <aside>
          <section className="customer-po-panel">
            <div className="customer-po-panel-title"><h2>Commercial snapshot</h2><span>From quotation</span></div>
            <div className="customer-po-summary">
              <div className="customer-po-summary-row"><span>Enquiry</span><strong>{source?.docNo || order?.enquiryDocNo || "—"}</strong></div>
              <div className="customer-po-summary-row"><span>Quotation</span><strong>{source?.quotationNo || order?.quotationNo || "—"}</strong></div>
              <div className="customer-po-summary-row"><span>Selected lines</span><strong>{itemCount(lines)}</strong></div>
              <div className="customer-po-summary-row"><span>Development cost</span><strong>{money(currency, developmentTotal(lines))}</strong></div>
              <div className="customer-po-summary-row customer-po-summary-total"><span>Customer PO value</span><strong>{money(currency, grandTotal)}</strong></div>
            </div>
          </section>
          {canConvert && <section className="customer-po-flow"><strong>Ready for Sales Order</strong><span>Only the unconverted Customer PO quantities will be converted.</span><button type="button" className="customer-po-action" disabled={saving} onClick={() => { void convert(); }}><WandSparkles size={14} />{saving ? "Converting…" : "Convert to Sales Order"}</button></section>}
          {order?.salesOrders?.length ? <section className="customer-po-panel" style={{ marginTop: 16 }}><div className="customer-po-panel-title"><h2>Created Sales Orders</h2><span>{order.salesOrders.length}</span></div><div className="customer-po-sales-links">{order.salesOrders.map((salesOrder) => <button key={salesOrder.id} type="button" onClick={() => navigate(`/sales/orders?customerPurchaseOrderId=${order.id}`)}>{salesOrder.salesOrderNumber} · {money(order.currencyCode, salesOrder.grandTotalAmount)}</button>)}</div></section> : null}
        </aside>
      </div>

      <section className="customer-po-panel">
        <div className="customer-po-panel-title"><h2>Customer PO items</h2><span>{locked ? "Pricing is captured as a confirmed snapshot" : "Quantity defaults to the remaining quoted quantity"}</span></div>
        <div className="customer-po-table-wrap">
          <table className="customer-po-table customer-po-line-table">
            <thead><tr><th></th><th>Item</th><th>Required qty.</th><th>Available qty.</th><th>Customer PO qty.</th><th className="money">Quoted rate</th><th className="money">Development cost</th><th className="money">Line value</th></tr></thead>
            <tbody>{lines.map((line) => <tr key={line.quotationItemId} className={line.selected ? "" : "dimmed"}>
              <td><input type="checkbox" checked={line.selected} disabled={locked || asNumber(line.availableQuantity) <= 0 && !order} onChange={() => toggleLine(line.quotationItemId)} aria-label={`Include ${line.description}`} /></td>
              <td><strong className="customer-po-line-name">{line.description}</strong><small>{[line.itemCode, line.drawingNumber, line.revisionNumber && `Rev ${line.revisionNumber}`, line.unitOfMeasurement].filter(Boolean).join(" · ")}</small></td>
              <td>{asNumber(line.requiredQuantity).toLocaleString("en-IN")}</td>
              <td>{order ? asNumber(line.orderedQuantity).toLocaleString("en-IN") : asNumber(line.availableQuantity).toLocaleString("en-IN")}</td>
              <td><input className="line-input" type="number" min="0.001" max={order ? asNumber(line.orderedQuantity) : asNumber(line.availableQuantity)} step="0.001" value={line.orderedQuantity} disabled={locked || !line.selected} onChange={(event) => updateQuantity(line.quotationItemId, event.target.value)} aria-label={`${line.description} Customer PO quantity`} /></td>
              <td className="money">{money(currency, line.unitPrice)}</td><td className="money">{money(currency, line.developmentCost)}</td><td className="money">{money(currency, asNumber(line.orderedQuantity) * asNumber(line.unitPrice) + asNumber(line.developmentCost))}</td>
            </tr>)}</tbody>
          </table>
          {!loading && !lines.length && <div className="customer-po-empty">Select an Order Received enquiry to load its finalized quotation lines.</div>}
        </div>
        {!locked && <div className="customer-po-form-actions"><p>Pricing and development costs are stored from the finalized quotation; they are not editable here.</p><div><button type="button" className="customer-po-secondary" disabled={saving || loading} onClick={() => { void saveDraft(); }}><Save size={14} />{saving ? "Saving…" : "Save draft"}</button><button type="button" className="customer-po-primary" disabled={saving || loading} onClick={() => { void confirm(); }}><CheckCircle2 size={14} />Confirm Customer PO</button></div></div>}
      </section>

    </div>
  );
}
