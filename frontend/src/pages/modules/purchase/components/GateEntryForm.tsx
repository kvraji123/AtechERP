import { ClipboardCheck, LogIn, Save } from "lucide-react";
import { useMemo, useState } from "react";
import DateInput from "../../../../components/DateInput";
import type { GateEntryRecord, GateEntryType, GateServiceType } from "../gateEntryData";
import type { EligibleGateOrder } from "../purchaseReceiptMappers";
import { dateTimeLocalNowInAppTimeZone } from "../../../../utils/formatDateTime";

type PartyOption = { customerId?: number; customerName?: string; customerCode?: string; supplierId?: number; supplierName?: string; supplierCode?: string; transportModes?: string[] };
type PartOption = { partId: number; partNumber: string; partName: string; unitOfMeasurement?: string };
type Payload = { entryType: GateEntryType; serviceType: GateServiceType | null; purchaseOrderId: number | null; customerId: number | null; supplierId: number | null; partId: number | null; referenceNumber: string; entryDateTime: string; transportMode: string; courierName: string; courierReceiptNumber: string; vehicleNumber: string; driverName: string; drivingLicenceNumber: string; action: "DRAFT" | "GATE_ENTERED" };
type Props = { approvedPos: EligibleGateOrder[]; customers: PartyOption[]; suppliers: PartyOption[]; parts: PartOption[]; transportOptions: Array<{ value: string; label: string }>; initialRecord?: GateEntryRecord; initialEntryType?: GateEntryType; initialServiceType?: GateServiceType; onCancel: () => void; onSave: (payload: Payload) => void };

const entryTypes: Array<{ value: GateEntryType; label: string; referenceLabel: string; helper: string }> = [
  { value: "REGULAR_PURCHASE", label: "Purchase Order", referenceLabel: "Purchase Order No.", helper: "Select the approved purchase order for this material arrival." },
  { value: "CUSTOMER_PURCHASE", label: "Customer Supply", referenceLabel: "DC No.", helper: "Select the customer and enter the customer delivery challan number." },
  { value: "OPEN_PURCHASE", label: "Open Purchase", referenceLabel: "Order / Invoice No.", helper: "Select the supplier and enter the supplier order or invoice number." },
  { value: "OUTSOURCING_PARTS", label: "Outsourcing Parts", referenceLabel: "DC No.", helper: "Enter the supplier delivery challan number and identify the returned outsourced part." },
  { value: "OTHER_SERVICES", label: "Other Services", referenceLabel: "Service DC / Invoice No.", helper: "Record an other-services entry received from a service supplier." },
];

const isOtherServiceType = (entryType: GateEntryType) => entryType === "OTHER_SERVICES";
const isCourierMode = (transportMode: string) => transportMode.trim().toUpperCase() === "COURIER";

export default function GateEntryForm({ approvedPos, customers, suppliers, parts, transportOptions, initialRecord, initialEntryType, initialServiceType, onCancel, onSave }: Props) {
  const [entryType, setEntryType] = useState<GateEntryType>(initialRecord?.entryType || initialEntryType || "REGULAR_PURCHASE");
  const [serviceType, setServiceType] = useState<GateServiceType | "">(initialRecord?.serviceType || initialServiceType || "");
  const [poId, setPoId] = useState(initialRecord?.poId || "");
  const [customerId, setCustomerId] = useState(String(initialRecord?.customerId || ""));
  const [supplierId, setSupplierId] = useState(String(initialRecord?.supplierId || ""));
  const [partId, setPartId] = useState(String(initialRecord?.partId || ""));
  const [partSearch, setPartSearch] = useState(initialRecord?.partNumber || "");
  const [referenceNumber, setReferenceNumber] = useState(initialRecord?.referenceNumber || "");
  const [entryDateTime, setEntryDateTime] = useState(initialRecord?.entryDateTime || dateTimeLocalNowInAppTimeZone());
  const [transportMode, setTransportMode] = useState(initialRecord?.transportMode || "");
  const [courierName, setCourierName] = useState(initialRecord?.courierName || "");
  const [courierReceiptNumber, setCourierReceiptNumber] = useState(initialRecord?.courierReceiptNumber || "");
  const [vehicleNumber, setVehicleNumber] = useState(initialRecord?.vehicleNumber || "");
  const [driverName, setDriverName] = useState(initialRecord?.driverName || "");
  const [drivingLicenceNumber, setDrivingLicenceNumber] = useState(initialRecord?.drivingLicenceNumber || "");
  const [error, setError] = useState("");
  const readOnly = Boolean(initialRecord && initialRecord.status !== "DRAFT");
  const typeDetails = entryTypes.find((type) => type.value === entryType) || entryTypes[0];
  const isRegularPurchase = entryType === "REGULAR_PURCHASE";
  const isCustomerSupply = entryType === "CUSTOMER_PURCHASE";
  const outsourcing = entryType === "OUTSOURCING_PARTS";
  const isOtherService = isOtherServiceType(entryType);
  const isCalibrationReturn = isOtherService && serviceType === "CALIBRATION_RETURN";
  const isToolReturn = isOtherService && serviceType === "TOOL_RETURN";
  const isCourierTransport = isCourierMode(transportMode);
  const needsSupplier = ["OPEN_PURCHASE", "OUTSOURCING_PARTS", "OTHER_SERVICES"].includes(entryType);
  const selectedPo = useMemo(() => approvedPos.find((po) => String(po.id) === poId), [approvedPos, poId]);
  const selectedCustomer = useMemo(() => customers.find((customer) => String(customer.customerId) === customerId), [customers, customerId]);
  const selectedSupplier = useMemo(() => suppliers.find((supplier) => String(supplier.supplierId) === supplierId), [suppliers, supplierId]);
  const selectedPart = useMemo(() => parts.find((part) => String(part.partId) === partId), [parts, partId]);
  const allowedTransportModes = isRegularPurchase ? selectedPo?.allowedTransportModes || [] : isCustomerSupply ? selectedCustomer?.transportModes || [] : selectedSupplier?.transportModes || [];
  const availableTransportOptions = transportOptions.filter((option) => allowedTransportModes.includes(option.value));
  const canSave = isRegularPurchase ? Boolean(poId) : Boolean(referenceNumber.trim()) && (isCustomerSupply ? Boolean(customerId) : Boolean(supplierId)) && (!outsourcing || Boolean(partId));

  const changeType = (nextType: GateEntryType) => {
    setEntryType(nextType); setServiceType(""); setPoId(""); setCustomerId(""); setSupplierId(""); setPartId(""); setPartSearch(""); setReferenceNumber(""); setTransportMode(""); setCourierName(""); setCourierReceiptNumber(""); setVehicleNumber(""); setDriverName(""); setDrivingLicenceNumber(""); setError("");
  };

  const save = (action: Payload["action"]) => {
    if (!entryDateTime) { setError("Enter the gate entry date and time."); return; }
    if (isRegularPurchase && !poId) { setError("Select an approved purchase order."); return; }
    if (!isRegularPurchase && !referenceNumber.trim()) { setError(`${typeDetails.referenceLabel} is required.`); return; }
    if (outsourcing && !partId) { setError("Select the outsourced part from Part Master."); return; }
    if (isCustomerSupply && !customerId) { setError("Select the customer."); return; }
    if (needsSupplier && !supplierId) { setError("Select the supplier."); return; }
    if (action === "GATE_ENTERED" && !transportMode) { setError("Select the actual transport mode."); return; }
    if (action === "GATE_ENTERED" && isCourierTransport && (!courierName.trim() || !courierReceiptNumber.trim())) { setError("Courier name and Courier Receipt number are required."); return; }
    if (action === "GATE_ENTERED" && !isCourierTransport && (!vehicleNumber.trim() || !driverName.trim())) { setError("Vehicle number and driver name are required."); return; }
    setError("");
    onSave({ entryType, serviceType: isOtherService ? serviceType || null : null, purchaseOrderId: isRegularPurchase ? Number(poId) : null, customerId: isCustomerSupply ? Number(customerId) : null, supplierId: needsSupplier ? Number(supplierId) : null, partId: outsourcing ? Number(partId) : null, referenceNumber: isRegularPurchase ? "" : referenceNumber, entryDateTime, transportMode, courierName, courierReceiptNumber, vehicleNumber, driverName, drivingLicenceNumber, action });
  };

  const regularSupplier = isRegularPurchase && (selectedPo || (initialRecord ? { supplierName: initialRecord.supplierName, poNumber: initialRecord.poNumber, itemCategory: initialRecord.itemCategory || "Item type unavailable", itemCount: initialRecord.itemCount, openQuantity: initialRecord.totalQuantity, deliveryLocation: initialRecord.deliveryLocation } : null));
  const partyName = isCustomerSupply ? selectedCustomer?.customerName || initialRecord?.customerName || "Pending" : selectedSupplier?.supplierName || initialRecord?.supplierName || "Pending";
  const partyCode = isCustomerSupply ? selectedCustomer?.customerCode : selectedSupplier?.supplierCode;
  const partSelection = <label className="purchase-field"><span>Outsourced Part <b>*</b></span><input list="outsourcing-part-master" value={partSearch} readOnly={readOnly} onChange={(event) => { const query = event.target.value; const found = parts.find((part) => part.partNumber === query || `${part.partNumber} — ${part.partName}` === query); setPartSearch(query); setPartId(found ? String(found.partId) : ""); setError(""); }} placeholder="Search Part Number or Part Name" /><datalist id="outsourcing-part-master">{parts.map((part) => <option key={part.partId} value={`${part.partNumber} — ${part.partName}`}>{part.unitOfMeasurement || ""}</option>)}</datalist><small>{selectedPart ? `${selectedPart.partName}${selectedPart.unitOfMeasurement ? ` · ${selectedPart.unitOfMeasurement}` : ""}` : "Select the part to continue its Outsourcing WIP workflow"}</small></label>;

  return <section className="purchase-gate-form-section">
    <header><div className="purchase-gate-form-title"><span><ClipboardCheck size={18} /></span><div><h2>Vehicle and Entry Details</h2><p>{typeDetails.helper}</p></div></div><div className="purchase-section-actions">{readOnly ? <button type="button" className="purchase-secondary-button" onClick={onCancel}>Back to Gate Entry List</button> : <><button type="button" className="purchase-secondary-button" disabled={!canSave} onClick={() => save("DRAFT")}><Save size={15} /> Save Draft</button><button type="button" className="purchase-primary-button" disabled={!canSave} onClick={() => save("GATE_ENTERED")}><LogIn size={15} /> Create Gate Entry</button></>}</div></header>
    <div className="purchase-gate-form-grid">
      <label className="purchase-field"><span>Gate Entry No.</span><input value={initialRecord?.gateEntryNumber || "Generated on save"} readOnly /><small className="purchase-gate-auto">Generated automatically</small></label>
      <label className="purchase-field"><span>Entry Type <b>*</b></span><select value={entryType} disabled={readOnly} onChange={(event) => changeType(event.target.value as GateEntryType)}>{entryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      {isOtherService && <label className="purchase-field"><span>Service Type</span><select value={serviceType} disabled={readOnly} onChange={(event) => { setServiceType(event.target.value as GateServiceType | ""); setError(""); }}><option value="">General service — no GRN</option><option value="CALIBRATION_RETURN">Calibration Return</option><option value="TOOL_RETURN">Tool Return</option></select><small>{isCalibrationReturn ? "Creates a GRN Inward path to receive Gauge IDs against the original dispatch challan." : isToolReturn ? "Creates a GRN Inward path to receive tools against their original regrinding DC." : "General service entries do not create inventory or a GRN."}</small></label>}
      {isRegularPurchase ? <label className="purchase-field"><span>Purchase Order <b>*</b></span><select value={poId} disabled={readOnly} onChange={(event) => { setPoId(event.target.value); setTransportMode(""); setError(""); }}><option value="">Select approved purchase order</option>{approvedPos.map((po) => <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName} · {po.itemCategory}</option>)}</select></label> : <label className="purchase-field"><span>{typeDetails.referenceLabel} <b>*</b></span><input value={referenceNumber} readOnly={readOnly} onChange={(event) => { setReferenceNumber(event.target.value); setError(""); }} placeholder={`Enter ${typeDetails.referenceLabel}`} /></label>}
      {outsourcing && partSelection}
      {isCustomerSupply && <label className="purchase-field"><span>Customer Name <b>*</b></span><select value={customerId} disabled={readOnly} onChange={(event) => { setCustomerId(event.target.value); setTransportMode(""); setError(""); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName} · {customer.customerCode}</option>)}</select></label>}
      {needsSupplier && <label className="purchase-field"><span>Supplier Name <b>*</b></span><select value={supplierId} disabled={readOnly} onChange={(event) => { setSupplierId(event.target.value); setTransportMode(""); setError(""); }}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName} · {supplier.supplierCode}</option>)}</select></label>}
      <label className="purchase-field"><span>Actual Transport Mode <b>*</b></span><select value={transportMode} disabled={readOnly || !availableTransportOptions.length} onChange={(event) => { const nextMode = event.target.value; setTransportMode(nextMode); if (isCourierMode(nextMode)) { setVehicleNumber(""); setDriverName(""); setDrivingLicenceNumber(""); } else { setCourierName(""); setCourierReceiptNumber(""); } setError(""); }}><option value="">{availableTransportOptions.length ? "Select actual transport mode" : "No allowed mode set for party"}</option>{availableTransportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Modes come from the selected party's master record.</small></label>
      <label className="purchase-field"><span>Date &amp; Time <b>*</b></span><DateInput type="datetime-local" value={entryDateTime} readOnly={readOnly} onChange={(event) => { setEntryDateTime(event.target.value); setError(""); }} /></label>
      {isCourierTransport ? <><label className="purchase-field"><span>Courier Name <b>*</b></span><input value={courierName} readOnly={readOnly} onChange={(event) => { setCourierName(event.target.value); setError(""); }} placeholder="Courier company / service" /></label><label className="purchase-field"><span>Courier Receipt No. <b>*</b></span><input value={courierReceiptNumber} readOnly={readOnly} onChange={(event) => { setCourierReceiptNumber(event.target.value); setError(""); }} placeholder="Receipt / docket number" /></label></> : <><label className="purchase-field"><span>Vehicle Number <b>*</b></span><input value={vehicleNumber} readOnly={readOnly} onChange={(event) => { setVehicleNumber(event.target.value); setError(""); }} /></label><label className="purchase-field"><span>Driver Name <b>*</b></span><input value={driverName} readOnly={readOnly} onChange={(event) => { setDriverName(event.target.value); setError(""); }} /></label><label className="purchase-field"><span>Driving Licence Number</span><input value={drivingLicenceNumber} readOnly={readOnly} onChange={(event) => { setDrivingLicenceNumber(event.target.value); setError(""); }} /></label></>}
    </div>
    {regularSupplier && <div className="purchase-gate-po-summary"><div><small>Supplier</small><strong>{regularSupplier.supplierName}</strong></div><div><small>Purchase Order</small><strong>{regularSupplier.poNumber}</strong><small>{regularSupplier.itemCategory}</small></div><div><small>Expected Items</small><strong>{regularSupplier.itemCount} items · {regularSupplier.openQuantity} open quantity</strong></div><div><small>Delivery Location</small><strong>{regularSupplier.deliveryLocation}</strong></div></div>}
    {!isRegularPurchase && <div className="purchase-gate-po-summary"><div><small>Entry Type</small><strong>{typeDetails.label}</strong></div><div><small>{typeDetails.referenceLabel}</small><strong>{referenceNumber || "Pending"}</strong></div><div><small>{isCustomerSupply ? "Customer" : "Supplier"}</small><strong>{partyName}</strong><small>{partyCode || ""}</small></div><div><small>{outsourcing ? "Outsourced Part" : "Next step"}</small><strong>{outsourcing ? selectedPart?.partNumber || initialRecord?.partNumber || "Pending" : isCalibrationReturn ? "Continue in GRN Inward to select the original calibration dispatch challan." : isToolReturn ? "Continue in GRN Inward to select the original Tool Regrinding DC." : isOtherService ? "Gate Entry record only — no stock is created." : "Capture against this gate entry in GRN Inward"}</strong></div></div>}
    {isRegularPurchase && !approvedPos.length && !initialRecord && <p className="purchase-gate-form-error">No approved purchase orders are available for Gate Entry.</p>}
    {error && <p className="purchase-gate-form-error" role="alert">{error}</p>}
  </section>;
}
