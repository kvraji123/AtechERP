import { AppError } from "../../utils/AppError.js";

export function validatePoLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new AppError("A purchase order must contain at least one item.");
  return lines.map((line, index) => {
    const quantity = Number(line.quantity ?? line.orderedQuantity);
    const rate = Number(line.rate ?? line.unitPrice);
    const packing = Number(line.packing ?? line.packingAmount ?? 0);
    const freight = Number(line.freight ?? line.freightAmount ?? 0);
    const otherCharges = Number(line.otherCharges ?? line.otherChargesAmount ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError(`PO quantity must be greater than zero at row ${index + 1}.`);
    if (!Number.isFinite(rate) || rate < 0) throw new AppError(`PO rate cannot be negative at row ${index + 1}.`);
    if (![packing, freight, otherCharges].every((amount) => Number.isFinite(amount) && amount >= 0)) throw new AppError(`PO packing, freight and other charges cannot be negative at row ${index + 1}.`);
    return { ...line, quantity, rate, discount: Number(line.discount || 0), taxPercent: Number(line.taxPercent || 0), packing, freight, otherCharges };
  });
}
