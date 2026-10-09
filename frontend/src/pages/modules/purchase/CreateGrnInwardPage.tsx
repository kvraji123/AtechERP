import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { customerApi } from "../../../api/customer.api";
import { supplierApi } from "../../../api/supplier.api";
import { itemApi } from "../../../api/item.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import GrnInwardForm from "./components/GrnInwardForm";
import GrnWorkflowStepper from "./components/GrnWorkflowStepper";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import type { GateEntryRecord, GateEntryType } from "./gateEntryData";
import type { GrnItem, GrnReceiptType, GrnRecord } from "./grnData";
import { mapGateEntry, mapGrn } from "./purchaseReceiptMappers";
import "./PurchaseFlow.css";

const receiptTypeForGate: Record<GateEntryType, GrnReceiptType> = {
  REGULAR_PURCHASE: "REGULAR_PURCHASE",
  CUSTOMER_PURCHASE: "CUSTOMER_SUPPLIED",
  OPEN_PURCHASE: "OPEN_PURCHASE",
  OUTSOURCING_PARTS: "OUTSOURCING_PRODUCT",
};
const gateTypeLabel: Record<GateEntryType, string> = {
  REGULAR_PURCHASE: "Regular purchase",
  CUSTOMER_PURCHASE: "Customer purchase",
  OPEN_PURCHASE: "Open purchase",
  OUTSOURCING_PARTS: "Outsourcing parts",
};
const directReceipt = (type: GrnReceiptType) => type !== "REGULAR_PURCHASE";
const emptyItem = (): GrnItem => ({ id: Date.now(), itemName: "", itemCode: "", specification: "", uom: "", orderedQuantity: 0, previouslyReceivedQuantity: 0, currentReceivedQuantity: 0, directRatePerQty: 0, taxPercent: 0, batchSerialNumber: "", inspectionRequired: true, acceptedQuantity: 0, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "PENDING", rejectionReason: "", qualityRemarks: "", warehouse: "Main Stores", binLocation: "" });

const blankRegularDraft = (gate: GateEntryRecord, po: any): GrnRecord => ({
  id: "", grnNumber: "Generated on save", gateEntryId: gate.id, gateEntryNumber: gate.gateEntryNumber, gateEntryReferenceNumber: gate.referenceNumber || "", poId: gate.poId, poNumber: gate.poNumber, supplierName: gate.supplierName, supplierCode: gate.supplierCode, receiptType: "REGULAR_PURCHASE", customerId: null, customerName: "", customerPlantCode: "", receiptDate: todayInAppTimeZone(), supplierInvoiceNumber: "", supplierInvoiceDate: "", deliveryChallanNumber: "", attachmentName: "", receivedBy: "", stockPostingDate: "", remarks: "", status: "DRAFT",
  items: (po.items || []).filter((item: any) => ["OPEN", "PARTIALLY_RECEIVED"].includes(item.line_status)).map((item: any): GrnItem => ({ id: Number(item.purchase_order_item_id), purchaseOrderItemId: Number(item.purchase_order_item_id), itemCode: item.item_code_snapshot || "", itemName: item.item_description_snapshot || "", specification: item.item_specification_snapshot || "", uom: item.uom_code_snapshot || "", orderedQuantity: Number(item.ordered_quantity || 0), previouslyReceivedQuantity: Number(item.received_quantity || 0), currentReceivedQuantity: 0, batchSerialNumber: "", inspectionRequired: true, acceptedQuantity: 0, rejectedQuantity: 0, onHoldQuantity: 0, inspectionResult: "PENDING", rejectionReason: "", qualityRemarks: "", warehouse: "Main Stores", binLocation: "" })),
});

const blankDirectDraft = (gate: GateEntryRecord, receiptType: Exclude<GrnReceiptType, "REGULAR_PURCHASE">): GrnRecord => ({
  id: "", grnNumber: "Generated on save", gateEntryId: gate.id, gateEntryNumber: gate.gateEntryNumber, gateEntryReferenceNumber: gate.referenceNumber || "", poId: "", poNumber: "", supplierName: gate.supplierName, supplierCode: gate.supplierCode, supplierId: gate.supplierId || null, outsourcingPartId:gate.partId || null,outsourcingPartNumber:gate.partNumber || gate.referenceNumber || "",outsourcingPartName:gate.partName || "",outsourcingPartUom:gate.partUom || "", receiptType, customerId: gate.customerId || null, customerName: gate.customerName || "", customerPlantCode: "", receiptDate: todayInAppTimeZone(), supplierInvoiceNumber: "", supplierInvoiceDate: "", deliveryChallanNumber: "", attachmentName: "", receivedBy: "", stockPostingDate: "", remarks: "", status: "DRAFT", items: receiptType === "OUTSOURCING_PRODUCT" ? [{ ...emptyItem(), itemName:gate.partName || gate.partNumber || gate.referenceNumber || "Outsourced part", itemCode:gate.partNumber || gate.referenceNumber || "", uom:gate.partUom || "" }] : [],
});
const gateText = (gate: GateEntryRecord) => `${gate.gateEntryNumber} · ${gateTypeLabel[gate.entryType || "REGULAR_PURCHASE"]} · ${gate.referenceNumber || gate.poNumber}`;

export default function CreateGrnInwardPage() {
  const navigate = useNavigate();
  const { grnId } = useParams();
  const [searchParams] = useSearchParams();
  const { showSuccess } = useAppFeedback();
  const [value, setValue] = useState<GrnRecord | null>(null);
  const [customers, setCustomers] = useState<Array<{ customerId: number; customerName: string; customerCode: string; plantCode: string }>>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [gates, setGates] = useState<GateEntryRecord[]>([]);
  const [selectedGateId, setSelectedGateId] = useState("");
  const [gatesLoading, setGatesLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const draftForGate = async (gateId: string): Promise<GrnRecord> => {
    const response = await purchaseApi.getGateEntry(gateId);
    const gate = mapGateEntry(response.data);
    const entryType = gate.entryType || "REGULAR_PURCHASE";
    const receiptType = receiptTypeForGate[entryType];
    if (receiptType !== "REGULAR_PURCHASE") return blankDirectDraft(gate, receiptType);
    const po = await purchaseApi.getPurchaseOrder(gate.poId);
    return blankRegularDraft(gate, po.data);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (grnId) {
          const response = await purchaseApi.getGrn(grnId);
          if (active) setValue(mapGrn(response.data));
          return;
        }
        const gateId = searchParams.get("gateEntryId");
        if (!gateId) return;
        const draft = await draftForGate(gateId);
        if (active) setValue(draft);
      } catch (reason) {
        if (active) setError(apiMessage(reason));
      }
    };
    void load();
    return () => { active = false; };
  }, [grnId, searchParams]);

  useEffect(() => {
    let active = true;
    customerApi.list({ activeFlag: "Y", pageSize: 100 }).then((response) => {
      if (active) setCustomers((response.data || []).map((row: any) => ({ customerId: Number(row.customerId), customerName: row.customerName || "", customerCode: row.customerCode || "", plantCode: row.plantCode || "" })));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([supplierApi.list({ activeFlag: "Y", pageSize: 100 }), itemApi.list({ activeFlag: "Y", pageSize: 100 })]).then(([supplierResponse, itemResponse]) => {
      if (!active) return;
      setSuppliers((supplierResponse.data || []).map((row: any) => ({ supplierId: Number(row.supplierId), supplierName: row.supplierName || "", supplierCode: row.supplierCode || "" })));
      setItems((itemResponse.data || []).map((row: any) => ({ itemId: Number(row.itemId), itemCode: row.itemCode || "", itemDescription: row.itemDescription || "", itemSpecification: row.itemSpecification || "", uomCode: row.uomCode || "", purchaseRate: Number(row.purchaseRate || 0) })));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    purchaseApi.listGateEntries({ page: 1, pageSize: 100, status: "GATE_ENTERED" }).then((response) => {
      if (active) setGates((response.data || []).map(mapGateEntry).filter((gate: GateEntryRecord) => gate.status === "GATE_ENTERED"));
    }).catch((reason) => { if (active) setError(apiMessage(reason)); }).finally(() => { if (active) setGatesLoading(false); });
    return () => { active = false; };
  }, []);

  const unsaved = useUnsavedChanges(value, undefined, value !== null);
  const patchItem = (itemId: number, patch: Partial<GrnItem>) => setValue((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : current);
  const save = async (action: "DRAFT" | "INWARD") => {
    if (!value || busy) return;
    const direct = directReceipt(value.receiptType);
    const customer = value.receiptType === "CUSTOMER_SUPPLIED";
    const supplierRequired = ["OPEN_PURCHASE", "OUTSOURCING_PRODUCT"].includes(value.receiptType);
    if (!value.gateEntryId || !value.receiptDate || (!direct && !value.poId)) { setError("Select a completed Gate Entry and a receipt date."); return; }
    if (customer && (!value.customerId || !value.customerPlantCode.trim())) { setError("Select a customer and enter the customer plant code."); return; }
    if (supplierRequired && !value.supplierId) { setError("Select a supplier."); return; }
    const outsourcing = value.receiptType === "OUTSOURCING_PRODUCT";
    if (!value.items.length || (direct && !outsourcing && value.items.some((item) => !item.itemId))) { setError("Add at least one valid receipt item."); return; }
    if (outsourcing && (!value.outsourcingPartId || value.items.length !== 1 || !value.items[0].batchSerialNumber.trim())) { setError("The gate-entry Part Master part, one received quantity and a batch or serial number are required."); return; }
    if (action === "INWARD" && (!value.deliveryChallanNumber.trim() || (!customer && (!value.supplierInvoiceNumber.trim() || !value.supplierInvoiceDate)))) { setError(customer ? "Enter the customer delivery challan." : "Complete the supplier invoice number, date and delivery challan."); return; }
    if (value.items.some((item) => !Number.isFinite(item.currentReceivedQuantity) || item.currentReceivedQuantity < 0 || (action === "INWARD" && item.currentReceivedQuantity === 0) || (!direct && item.currentReceivedQuantity > item.orderedQuantity - item.previouslyReceivedQuantity))) { setError("Enter valid received quantities within the pending PO quantity."); return; }
    const snapshot = unsaved.snapshot();
    setBusy(true);
    try {
      const inspectionRequired = outsourcing ? false : value.items.some((item) => item.inspectionRequired);
      const body = { purchaseOrderId: Number(value.poId) || null, gateEntryId: Number(value.gateEntryId), gateEntryNumber: value.gateEntryNumber, supplierId: value.supplierId, grnDate: value.receiptDate, receiptType: value.receiptType, customerId: value.customerId, customerName: value.customerName, customerPlantCode: value.customerPlantCode, jobReference: value.jobReference, supplierInvoiceNumber: value.supplierInvoiceNumber, supplierInvoiceDate: value.supplierInvoiceDate, deliveryChallanNumber: value.deliveryChallanNumber, receivedBy: value.receivedBy, remarks: value.remarks, inspectionRequired, action, items: value.items.map((item) => ({ purchaseOrderItemId: item.purchaseOrderItemId || null, itemId: item.itemId, receivedQuantity: item.currentReceivedQuantity, directRatePerQty: item.directRatePerQty, taxPercent: item.taxPercent, batchSerialNumber: item.batchSerialNumber })) };
      const response = value.id ? await purchaseApi.updateGrn(value.id, body) : await purchaseApi.createGrn(body);
      const saved = mapGrn(response.data);
      unsaved.markSaved(snapshot);
      showSuccess(action === "DRAFT" ? `${saved.grnNumber} saved as draft.` : outsourcing ? "Outsourced part received into Outsourcing WIP for its Process Plan operation." : inspectionRequired ? "GRN Inward submitted for inspection." : "GRN Inward accepted and ready for stock posting.");
      navigate(action === "DRAFT" ? "/purchase/grn" : outsourcing ? "/inventory/outsourcing-wip" : inspectionRequired ? `/purchase/grn/${saved.id}/inspection` : `/purchase/grn/${saved.id}/stock-receipt`, { replace: true });
    } catch (reason) { setError(apiMessage(reason)); } finally { setBusy(false); }
  };

  if (!value && !grnId && !searchParams.get("gateEntryId")) return <div className="purchase-page"><section className="purchase-grn-form-section"><header><div className="purchase-grn-form-title"><span><PackagePlus size={18} /></span><div><h2>Create GRN</h2><p>Select the completed Gate Entry for this incoming material.</p></div></div></header>{gatesLoading ? <div className="purchase-grn-empty">Loading completed Gate Entries…</div> : !gates.length ? <div className="purchase-grn-empty">No completed Gate Entries are available for GRN creation.</div> : <label className="purchase-field purchase-grn-gate-picker"><span>Completed Gate Entry <b>*</b></span><select value={selectedGateId} onChange={(event) => setSelectedGateId(event.target.value)}><option value="">Select completed gate entry</option>{gates.map((gate) => <option key={gate.id} value={gate.id}>{gateText(gate)}</option>)}</select></label>}{error && <p className="purchase-grn-error" role="alert">{error}</p>}<footer><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/grn")}>Back</button><button type="button" className="purchase-primary-button" disabled={!selectedGateId} onClick={() => navigate(`/purchase/grn/new?gateEntryId=${selectedGateId}`)}>Continue</button></footer></section></div>;
  if (!value) return <div className="purchase-page"><section className="purchase-grn-form-section"><div className="purchase-grn-empty">{error || "Loading completed Gate Entry…"}</div><footer><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/gate-entries")}>Back to Gate Entry</button></footer></section></div>;
  return <div className="purchase-page"><header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" onClick={() => navigate("/purchase/grn")}><ArrowLeft size={19} /></button><span className="purchase-page-module-icon"><PackagePlus size={19} /></span><div><p>Purchase / GRN</p><h1>GRN Inward</h1><span>Receive material only from a completed Gate Entry.</span></div></div></header><PurchaseModuleTabs /><div className="purchase-grn-page"><GrnWorkflowStepper stage="INWARD" /><fieldset className="purchase-grn-edit-fields" disabled={busy}><GrnInwardForm receiptTypeLocked={Boolean(value.gateEntryId)} value={value} customers={customers} suppliers={suppliers} items={items} error={error} onChange={(patch) => { const { receiptType: _receiptType, ...safePatch } = patch; setValue({ ...value, ...safePatch }); setError(""); }} onItemChange={(itemId, patch) => { patchItem(itemId, patch); setError(""); }} onAddItem={() => setValue((current) => current ? { ...current, items: [...current.items, emptyItem()] } : current)} onRemoveItem={(itemId) => setValue((current) => current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current)} onBack={() => navigate("/purchase/grn")} onSaveDraft={() => { void save("DRAFT"); }} onSubmit={() => { void save("INWARD"); }} /></fieldset></div></div>;
}
