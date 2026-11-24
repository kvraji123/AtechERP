import DateInput from "../../../../components/DateInput";
import { CalendarDays, FileSearch } from "lucide-react";

type PurchaseEnquiryFiltersProps = {
  enquiryNumber: string;
  selectedPr: string;
  approvedPrNumbers: string[];
  enquiryDate: string;
  dueDate: string;
  subject: string;
  deliveryRequiredDate: string;
  deliveryLocation: string;
  commercialTerms: string;
  supplierNotes: string;
  onSelectedPrChange: (value: string) => void;
  onEnquiryDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onDeliveryRequiredDateChange: (value: string) => void;
  onDeliveryLocationChange: (value: string) => void;
  onCommercialTermsChange: (value: string) => void;
  onSupplierNotesChange: (value: string) => void;
};

export default function PurchaseEnquiryFilters({
  enquiryNumber,
  selectedPr,
  approvedPrNumbers,
  enquiryDate,
  dueDate,
  subject,
  deliveryRequiredDate,
  deliveryLocation,
  commercialTerms,
  supplierNotes,
  onSelectedPrChange,
  onEnquiryDateChange,
  onDueDateChange,
  onSubjectChange,
  onDeliveryRequiredDateChange,
  onDeliveryLocationChange,
  onCommercialTermsChange,
  onSupplierNotesChange,
}: PurchaseEnquiryFiltersProps) {
  return (
    <div className="purchase-enquiry-filters">
      <label className="purchase-field">
        <span>RFQ / Purchase Enquiry No.</span>
        <div className="purchase-input-with-icon readonly"><FileSearch size={16} /><input value={enquiryNumber} readOnly /></div>
      </label>
      <label className="purchase-field">
        <span>Approved Purchase Request <b>*</b></span>
        <select value={selectedPr} onChange={(event) => onSelectedPrChange(event.target.value)}>
          {approvedPrNumbers.length > 1 && <option value="ALL">Multiple PRs — {approvedPrNumbers.join(" & ")}</option>}
          {approvedPrNumbers.map((prNumber) => <option key={prNumber} value={prNumber}>{prNumber}</option>)}
        </select>
        <small>Multiple approved PRs can be combined in one enquiry</small>
      </label>
      <label className="purchase-field">
        <span>Enquiry Date <b>*</b></span>
        <div className="purchase-input-with-icon"><CalendarDays size={16} /><DateInput type="date" value={enquiryDate} onChange={(event) => onEnquiryDateChange(event.target.value)} /></div>
      </label>
      <label className="purchase-field">
        <span>Quotation Due Date <b>*</b></span>
        <div className="purchase-input-with-icon"><CalendarDays size={16} /><DateInput type="date" min={enquiryDate} value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} /></div>
      </label>
      <label className="purchase-field span-2">
        <span>Subject <b>*</b></span>
        <input value={subject} onChange={(event) => onSubjectChange(event.target.value)} placeholder="RFQ subject" />
      </label>
      <label className="purchase-field">
        <span>Delivery Location</span>
        <select value={deliveryLocation} onChange={(event) => onDeliveryLocationChange(event.target.value)}><option>Atech Coimbatore / Main Stores</option><option>Atech Coimbatore / Production Stores</option></select>
      </label>
      <label className="purchase-field">
        <span>Delivery Required By <b>*</b></span>
        <div className="purchase-input-with-icon"><CalendarDays size={16} /><DateInput type="date" min={enquiryDate} value={deliveryRequiredDate} onChange={(event) => onDeliveryRequiredDateChange(event.target.value)} /></div>
      </label>
      <label className="purchase-field span-2">
        <span>Commercial Terms to Request</span>
        <textarea value={commercialTerms} onChange={(event) => onCommercialTermsChange(event.target.value)} placeholder="Price, tax, freight, payment and delivery terms required from the supplier" />
      </label>
      <label className="purchase-field span-2">
        <span>Notes to Supplier</span>
        <textarea value={supplierNotes} onChange={(event) => onSupplierNotesChange(event.target.value)} placeholder="Additional instructions for the supplier" />
      </label>
    </div>
  );
}
