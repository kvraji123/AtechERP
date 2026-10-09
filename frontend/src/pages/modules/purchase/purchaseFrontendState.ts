const LEGACY_PURCHASE_KEYS = [
  "atech.purchase.pr-approval-statuses.v1",
  "atech.purchase.rfq-pr-list.v1",
  "atech.purchase.approved-pr-lines.v1",
  "atech.purchase.rfq-tracking.v1",
  "atech.purchase.rfq-tracking-quotations.v1",
  "atech.purchase.comparison-decisions.v1",
  "atech.purchase.po-approvals.v1",
  "atech.purchase.supplier-assignments.v1",
  "atech.purchase.gate-entries.v1",
  "atech.purchase.grn-records.v1",
];

const CLEANUP_MARKER = "atech.purchase.frontend-demo-cleared.v1";

/** Remove records created by the former frontend-only demo flow once per browser. */
export const clearLegacyPurchaseDemoData = () => {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(CLEANUP_MARKER) === "1") return;
    LEGACY_PURCHASE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem(CLEANUP_MARKER, "1");
  } catch {
    // Storage may be unavailable in private browsing; API-backed screens still work.
  }
};

