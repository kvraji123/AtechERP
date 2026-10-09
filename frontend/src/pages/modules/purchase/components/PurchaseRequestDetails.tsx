import DateInput from "../../../../components/DateInput";
import { CalendarDays, FileText, UserRound } from "lucide-react";
import { departmentOptions } from "../purchaseData";
import type { PurchaseRequestDetailsState, SupplierOption } from "../types";

type PurchaseRequestDetailsProps = {
  value: PurchaseRequestDetailsState;
  onChange: (next: PurchaseRequestDetailsState) => void;
  supplierOptions?: SupplierOption[];
};

export default function PurchaseRequestDetails({ value, onChange, supplierOptions = [] }: PurchaseRequestDetailsProps) {
  const update = <K extends keyof PurchaseRequestDetailsState>(
    key: K,
    fieldValue: PurchaseRequestDetailsState[K]
  ) => onChange({ ...value, [key]: fieldValue });

  return (
    <div className="purchase-details-grid">
      <label className="purchase-field">
        <span>PR Requisition No.</span>
        <div className="purchase-input-with-icon readonly">
          <FileText size={16} />
          <input value={value.prNumber} placeholder="Generated on save" readOnly />
        </div>
        <small>Generated automatically with financial year</small>
      </label>

      <label className="purchase-field">
        <span>Requested By</span>
        <div className="purchase-input-with-icon readonly">
          <UserRound size={16} />
          <input value={value.requestedBy} placeholder="Logged-in user" readOnly />
        </div>
      </label>

      <label className="purchase-field">
        <span>Department <b>*</b></span>
        <select value={value.department} onChange={(event) => update("department", event.target.value)} required>
          <option value="">Select department</option>
          {departmentOptions.map((department) => <option key={department}>{department}</option>)}
        </select>
      </label>

      <label className="purchase-field">
        <span>Requisition Type <b>*</b></span>
        <select
          value={value.requisitionType}
          onChange={(event) => update("requisitionType", event.target.value as PurchaseRequestDetailsState["requisitionType"])}
          required
        >
          <option value="NEW_ITEM">New Item</option>
          <option value="EXISTING_ITEM">Existing Item</option>
        </select>
      </label>

      <label className="purchase-field">
        <span>Priority <b>*</b></span>
        <select
          value={value.priority}
          onChange={(event) => update("priority", event.target.value as PurchaseRequestDetailsState["priority"])}
          required
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>

      <label className="purchase-field">
        <span>Date <b>*</b></span>
        <div className="purchase-input-with-icon">
          <CalendarDays size={16} />
          <DateInput type="date" value={value.requestDate} onChange={(event) => update("requestDate", event.target.value)} required />
        </div>
      </label>

      <label className="purchase-field">
        <span>Required Date <b>*</b></span>
        <div className="purchase-input-with-icon">
          <CalendarDays size={16} />
          <DateInput type="date" value={value.requiredDate} min={value.requestDate} onChange={(event) => update("requiredDate", event.target.value)} required />
        </div>
      </label>

      <label className="purchase-field">
        <span>Preferred Supplier</span>
        <select value={value.preferredSupplier} onChange={(event) => update("preferredSupplier", event.target.value)}>
          <option value="">No preference</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.code})</option>
          ))}
        </select>
        <small>Suggestion only; Purchase Manager can invite other approved suppliers</small>
      </label>

      <label className="purchase-field purchase-field-quotation">
        <span>Quotation Reference</span>
        <input value={value.quoteReference} onChange={(event) => update("quoteReference", event.target.value)} placeholder="Reference number, if available" />
      </label>

      <label className="purchase-field purchase-field-remarks">
        <span>Remarks</span>
        <textarea value={value.remarks} onChange={(event) => update("remarks", event.target.value)} placeholder="Add request-level notes or special instructions" />
      </label>
    </div>
  );
}
