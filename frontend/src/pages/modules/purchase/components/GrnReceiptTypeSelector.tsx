import type { GrnReceiptType } from "../grnData";

const options = [
  { value: "REGULAR_PURCHASE", label: "Regular purchase", description: "Receive against an approved purchase order" },
  { value: "CUSTOMER_SUPPLIED", label: "Customer supplied", description: "Receive customer-owned material" },
  { value: "OPEN_PURCHASE", label: "Open purchase", description: "Receive without a purchase order" },
  { value: "OUTSOURCING_PRODUCT", label: "Outsourcing parts", description: "Receive subcontracted parts" },
] as const;

export default function GrnReceiptTypeSelector({ value, onChange, readOnly = false }: { value: GrnReceiptType; onChange: (type: GrnReceiptType) => void; readOnly?: boolean }) {
  const selected = options.find((option) => option.value === value) || options[0];
  return <label className="purchase-field purchase-grn-receipt-type"><span>Receipt Type <b>*</b></span><select value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value as GrnReceiptType)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{readOnly ? `Inherited from Gate Entry · ${selected.description}` : selected.description}</small></label>;
}
