type ComparisonSource = { enquiryId: number; enquiryNumber: string; prNumbers?: string | null; quotationCount: number; };

type QuotationComparisonFiltersProps = {
  sources: ComparisonSource[];
  selectedEnquiryId: string;
  onEnquiryChange: (value: string) => void;
};

export default function QuotationComparisonFilters({ sources, selectedEnquiryId, onEnquiryChange }: QuotationComparisonFiltersProps) {
  const selectedSource = sources.find((source) => String(source.enquiryId) === selectedEnquiryId);
  const quotationCount = Number(selectedSource?.quotationCount || 0);
  const quotationStatus = quotationCount === 0
    ? "No quotations received"
    : `${quotationCount} quotation${quotationCount === 1 ? "" : "s"} received`;

  return <div className="purchase-comparison-filters">
    <label>
      <span>RFQ / Enquiry No.</span>
      <select value={selectedEnquiryId} onChange={(event) => onEnquiryChange(event.target.value)} aria-label="RFQ or enquiry number">
        {sources.map((source) => <option key={source.enquiryId} value={source.enquiryId}>{source.enquiryNumber}</option>)}
      </select>
    </label>
    <label>
      <span>Purchase Request(s)</span>
      <output className="purchase-comparison-readonly-field" title={selectedSource?.prNumbers || "No purchase request reference"}>{selectedSource?.prNumbers || "—"}</output>
    </label>
    <label>
      <span>Quotation Status</span>
      <output className="purchase-comparison-readonly-field">{quotationStatus}</output>
    </label>
  </div>;
}
