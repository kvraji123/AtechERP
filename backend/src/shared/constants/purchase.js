export const PURCHASE_PERMISSIONS = Object.freeze([
  "PR_CREATE",
  "PR_SUBMIT",
  "PR_APPROVE",
  "RFQ_CREATE",
  "QUOTE_ENTER",
  "SUPPLIER_SELECT",
  "PO_CREATE",
  "PO_APPROVE",
  "GRN_POST",
  "REPORT_VIEW",
]);

export const PR_TRANSITIONS = Object.freeze({
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "PARTIALLY_APPROVED", "PENDING_APPROVAL", "RETURNED", "REJECTED"],
  PENDING_APPROVAL: ["APPROVED", "PARTIALLY_APPROVED", "RETURNED", "REJECTED"],
  RETURNED: ["SUBMITTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  // A partially approved request can be sent back through approval after
  // the requester updates clarification lines.
  PARTIALLY_APPROVED: ["SUBMITTED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
});

export const PO_TRANSITIONS = Object.freeze({
  DRAFT: ["SUBMITTED", "CANCELLED"],
  RETURNED: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "RETURNED", "REJECTED"],
  APPROVED: ["PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
});

export const GRN_TRANSITIONS = Object.freeze({
  DRAFT: ["INWARD", "CANCELLED"],
  INWARD: ["INSPECTION_PENDING", "INSPECTION_HOLD", "ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"],
  INSPECTION_PENDING: ["INSPECTION_HOLD", "ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"],
  INSPECTION_HOLD: ["INSPECTION_HOLD", "ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"],
  ACCEPTED: ["POSTED", "CANCELLED"],
  PARTIALLY_ACCEPTED: ["POSTED", "CANCELLED"],
  REJECTED: ["CANCELLED"],
  POSTED: [],
  CANCELLED: [],
});

export function assertTransition(transitions, from, to) {
  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid status transition: ${from} -> ${to}.`);
  }
}

export function calculateLineAmounts({ quantity, unitPrice, discount = 0, taxPercent = 0, freight = 0, packing = 0, otherCharges = 0 }) {
  const qty = Number(quantity);
  const price = Number(unitPrice);
  const discountAmount = Number(discount) || 0;
  const taxable = Math.max(0, qty * price - discountAmount);
  const tax = taxable * (Number(taxPercent) || 0) / 100;
  return {
    basicAmount: qty * price,
    discountAmount,
    freightAmount: Number(freight) || 0,
    packingAmount: Number(packing) || 0,
    otherChargesAmount: Number(otherCharges) || 0,
    taxAmount: tax,
    lineTotalAmount: taxable + tax + (Number(freight) || 0) + (Number(packing) || 0) + (Number(otherCharges) || 0),
  };
}
