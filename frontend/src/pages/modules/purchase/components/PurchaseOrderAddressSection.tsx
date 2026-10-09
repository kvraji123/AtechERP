import type { PurchaseOrderFormState } from "../purchaseOrderTypes";

type PurchaseOrderAddressSectionProps = {
  value: PurchaseOrderFormState;
  transportOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<PurchaseOrderFormState>) => void;
};

export default function PurchaseOrderAddressSection({ value, transportOptions, onChange }: PurchaseOrderAddressSectionProps) {
  return (
    <section className="purchase-po-section">
      <header><div><h2>Billing & Delivery Address</h2><p>Auto-populated from Unit Master; choose the applicable company location.</p></div></header>
      <div className="purchase-po-fields">
        <label className="purchase-field span-2"><span>Billing Address <b>*</b></span><select value={value.billingAddress} onChange={(event) => onChange({ billingAddress: event.target.value })}><option>Atech Automation · Coimbatore</option></select><div className="purchase-po-address"><strong>ATECH AUTOMATION</strong><span>Coimbatore, Tamil Nadu</span><span>GSTIN: 33ABCDE1234F1Z5</span></div></label>
        <label className="purchase-field span-2"><span>Delivery Address <b>*</b></span><select value={value.deliveryAddress} onChange={(event) => onChange({ deliveryAddress: event.target.value })}><option>Atech Coimbatore / Main Stores</option><option>Atech Coimbatore / Production Stores</option></select><div className="purchase-po-address"><strong>{value.deliveryAddress}</strong><span>Coimbatore, Tamil Nadu</span><span>Contact: Stores In-charge · +91 98765 43210</span></div></label>
        <label className="purchase-field span-2"><span>Actual Transport Mode <b>*</b></span><select value={value.transportMode} onChange={(event) => onChange({ transportMode: event.target.value })} disabled={!transportOptions.length}><option value="">{transportOptions.length ? "Select actual transport mode" : "No allowed transport mode set for supplier"}</option>{transportOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Only modes enabled in this supplier's master record can be selected.</small></label>
      </div>
    </section>
  );
}
