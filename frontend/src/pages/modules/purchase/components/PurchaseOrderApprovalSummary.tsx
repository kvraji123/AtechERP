import { Building2, MapPin } from "lucide-react";
import type { PurchaseOrderApprovalRecord } from "../purchaseFlowStore";

export type PurchaseOrderApprovalAddressState = {
  billingSource: string;
  billingAddress: string;
  deliverySource: string;
  deliveryAddress: string;
};

type PurchaseOrderApprovalSummaryProps = {
  record: PurchaseOrderApprovalRecord;
  value: PurchaseOrderApprovalAddressState;
  onChange: (patch: Partial<PurchaseOrderApprovalAddressState>) => void;
};

const addresses: Record<string, string> = {
  "ATECH-COIMBATORE": "Atech Automation, Coimbatore, Tamil Nadu",
  "ATECH-CHENNAI": "Atech Automation, Plant 2, Chennai, Tamil Nadu 600058",
  "CUSTOMER-ALPHA": "Alpha Engineering Ltd., Ambattur Industrial Estate, Chennai 600058",
};

const addressOptions = <><option value="ATECH-COIMBATORE">Unit Master — Atech Coimbatore</option><option value="ATECH-CHENNAI">Unit Master — Atech Chennai</option><option value="CUSTOMER-ALPHA">Customer / Supplier Master — Alpha Engineering</option></>;

export default function PurchaseOrderApprovalSummary({ record, value, onChange }: PurchaseOrderApprovalSummaryProps) {
  const updateAddress = (kind: "billing" | "delivery", source: string) => onChange(kind === "billing"
    ? { billingSource: source, billingAddress: addresses[source] }
    : { deliverySource: source, deliveryAddress: addresses[source] });

  return (
    <section className="purchase-po-approval-section">
      <header><div><h2>PO and Address Details</h2><p>Verify supplier, source reference, billing and delivery location.</p></div><span className={`purchase-po-approval-status ${record.status.toLowerCase()}`}>{record.status === "SUBMITTED" ? "Pending Approval" : record.status.charAt(0) + record.status.slice(1).toLowerCase()}</span></header>
      <div className="purchase-po-approval-meta">
        <div><span>PO Number</span><strong>{record.form.poNumber}</strong><small>{record.itemCategory || "Item type unavailable"}</small></div><div><span>PO Date</span><strong>{record.form.poDate}</strong></div><div><span>Supplier</span><strong>{record.form.supplierName}</strong></div><div><span>Source</span><strong>{record.form.sourceReference}</strong></div>
      </div>
      <div className="purchase-po-approval-addresses">
        <div className="purchase-po-approval-address-card"><div className="purchase-po-approval-address-title"><Building2 size={17} /><strong>Billing Address</strong></div><label className="purchase-field"><span>Pick from Unit or Customer / Supplier Master</span><select value={value.billingSource} onChange={(event) => updateAddress("billing", event.target.value)}>{addressOptions}</select></label><label className="purchase-field"><span>Selected Address</span><textarea value={value.billingAddress} disabled /></label></div>
        <div className="purchase-po-approval-address-card"><div className="purchase-po-approval-address-title"><MapPin size={17} /><strong>Delivery Address</strong></div><label className="purchase-field"><span>Pick from Unit or Customer / Supplier Master</span><select value={value.deliverySource} onChange={(event) => updateAddress("delivery", event.target.value)}>{addressOptions}</select></label><label className="purchase-field"><span>Selected Address</span><textarea value={value.deliveryAddress} disabled /></label></div>
      </div>
    </section>
  );
}
