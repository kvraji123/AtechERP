import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { recordAudit } from "../../shared/services/audit.service.js";
import { calculateLineAmounts } from "../../shared/constants/purchase.js";
import * as repository from "./supplier-quotation.repository.js";
import { validateQuotation } from "./supplier-quotation.validation.js";

export { extractQuotationPdf } from "./supplier-quotation-pdf.service.js";

const REVISION_WRITE_ATTEMPTS = 3;

function isRevisionConflict(error) {
  if (error?.code !== "ER_DUP_ENTRY") return false;

  const message = String(error?.sqlMessage || error?.message || "");
  return message.includes("uq_supplier_quotation_revision");
}

async function createQuotationRevision(data, user) {
  return withTransaction(async (connection) => {
    const supplier = await repository.supplier(connection, data.supplierId);
    if (!supplier) throw new AppError("Supplier is invalid or inactive.", 409);

    const assigned = await repository.enquirySupplier(
      connection,
      user.tenantId,
      data.purchaseEnquiryId,
      data.supplierId,
    );
    const allowed = new Set(assigned.map((entry) => Number(entry.itemId)));

    for (const item of data.items) {
      if (!allowed.has(item.purchaseEnquiryItemId)) {
        throw new AppError(
          "Quotation item is not assigned to this supplier for the selected enquiry.",
          409,
        );
      }
    }

    const enquiryItems = await repository.enquiryItems(
      connection,
      user.tenantId,
      data.purchaseEnquiryId,
      data.items.map((item) => item.purchaseEnquiryItemId),
    );
    const enquiryById = new Map(
      enquiryItems.map((entry) => [Number(entry.itemId), entry]),
    );
    const revision = await repository.nextRevision(
      connection,
      user.tenantId,
      data.purchaseEnquiryId,
      data.supplierId,
    );

    let subtotal = 0;
    let tax = 0;
    let packing = 0;
    let freight = 0;
    let other = 0;
    let grand = 0;
    const itemAmounts = [];

    for (const item of data.items) {
      const enquiryItem = enquiryById.get(item.purchaseEnquiryItemId);
      if (!enquiryItem) {
        throw new AppError(
          "Quotation item does not belong to the selected enquiry.",
          409,
        );
      }
      if (
        item.quoteResponse === "QUOTED" &&
        item.quotedQuantity > Number(enquiryItem.enquiryQuantity)
      ) {
        throw new AppError("Quoted quantity cannot exceed the enquiry quantity.", 409);
      }

      const amounts =
        item.quoteResponse === "NOT_QUOTED"
          ? {
              taxAmount: 0,
              lineTotalAmount: 0,
              basicAmount: 0,
              discountAmount: 0,
              packingAmount: Number(item.packingAmount || 0),
              freightAmount: Number(item.freightAmount || 0),
              otherChargesAmount: Number(item.otherChargesAmount || 0),
            }
          : calculateLineAmounts({
              quantity: item.quotedQuantity,
              unitPrice: item.unitPrice,
              discount: item.discountAmount,
              taxPercent: item.taxPercent,
              freight: item.freightAmount,
              packing: item.packingAmount,
              otherCharges: item.otherChargesAmount,
            });

      subtotal += amounts.basicAmount - amounts.discountAmount;
      tax += amounts.taxAmount;
      packing += amounts.packingAmount;
      freight += amounts.freightAmount;
      other += amounts.otherChargesAmount;
      grand += amounts.lineTotalAmount;
      itemAmounts.push({ item, amounts });
    }

    const quoteId = await repository.insertHeader(connection, [
      user.tenantId,
      data.purchaseEnquiryId,
      data.supplierId,
      data.supplierQuotationNumber || null,
      data.supplierQuotationDate || null,
      revision,
      revision > 1 ? "REVISED" : "RECEIVED",
      data.currencyCode || "INR",
      data.paymentTerms || null,
      data.deliveryTerms || null,
      data.quotationValidUntil || null,
      subtotal,
      tax,
      packing,
      freight,
      other,
      grand,
      data.attachmentFileName || null,
      data.attachmentFileUrl || null,
      data.remarks || null,
      user.userCode,
    ]);

    for (const { item, amounts } of itemAmounts) {
      await repository.insertItem(connection, [
        user.tenantId,
        quoteId,
        item.purchaseEnquiryItemId,
        item.quoteResponse,
        item.quotedQuantity,
        item.unitPrice,
        item.discountAmount || 0,
        item.taxPercent || 0,
        amounts.taxAmount,
        amounts.freightAmount,
        amounts.packingAmount,
        amounts.otherChargesAmount,
        amounts.lineTotalAmount,
        item.deliveryDate || null,
        item.deliveryLeadDays || null,
        item.offeredMakeBrand || null,
        item.paymentTerms || data.paymentTerms || null,
        item.warrantyMonths || null,
        item.itemRemarks || null,
      ]);
    }

    await repository.setEnquiryStatus(
      connection,
      user.tenantId,
      data.purchaseEnquiryId,
    );
    await recordAudit({
      connection,
      tenantId: user.tenantId,
      module: "PURCHASE",
      entityType: "SUPPLIER_QUOTATION",
      entityId: quoteId,
      action: revision > 1 ? "QUOTATION_REVISED" : "QUOTATION_RECEIVED",
      newValue: {
        enquiryId: data.purchaseEnquiryId,
        supplierId: data.supplierId,
        revision,
      },
      performedBy: user.userCode,
    });

    return repository.get(quoteId, user.tenantId, connection);
  });
}

export async function create(raw, user) {
  const data = validateQuotation(raw);

  for (let attempt = 1; attempt <= REVISION_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await createQuotationRevision(data, user);
    } catch (error) {
      if (!isRevisionConflict(error)) throw error;

      if (attempt === REVISION_WRITE_ATTEMPTS) {
        throw new AppError(
          "Another quotation revision was saved at the same time. Please try again.",
          409,
        );
      }
    }
  }

  throw new AppError("Unable to create the supplier quotation.", 500);
}

export const get = async (id, user) => {
  const result = await repository.get(id, user.tenantId);
  if (!result) throw new AppError("Supplier quotation not found.", 404);
  return result;
};

export async function list(query, user) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const rows = await repository.list({
    tenantId: user.tenantId,
    enquiryId: String(query.purchaseEnquiryId || ""),
    supplierId: String(query.supplierId || ""),
    status: String(query.status || "").toUpperCase(),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { rows, page, pageSize };
}
