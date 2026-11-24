import type { GateEntryRecord } from "./gateEntryData";
import type { GrnItem, GrnRecord } from "./grnData";
import { formatDateTimeLocalInput } from "../../../utils/formatDateTime";

const number = (value: unknown) => Number(value || 0);
const date = (value: unknown) => String(value || "").slice(0, 10);

export type EligibleGateOrder = {
  id: number; poNumber: string; supplierName: string; supplierCode: string;
  itemCategory: string; deliveryLocation: string; itemCount: number; openQuantity: number;
  transportMode?: string; allowedTransportModes: string[];
};

const transportModes = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
};

export const mapGateEntry = (row: any): GateEntryRecord => ({
  id: String(row.id), gateEntryNumber: row.gateEntryNumber || "", entryType: row.entryType || row.entry_type || "REGULAR_PURCHASE", serviceType: row.serviceType || row.service_type || null,
  referenceNumber: row.referenceNumber || row.reference_number || row.partNumber || row.poNumber || "", poNumber: row.poNumber || "", poId: String(row.purchaseOrderId || ""), supplierId: number(row.supplierId || row.supplier_id) || null,
  partId: number(row.partId || row.part_id) || null, partNumber: row.partNumber || row.part_number_snapshot || "", partName: row.partName || row.part_name_snapshot || "", partUom: row.partUom || row.part_uom_snapshot || "", itemCategory: row.itemCategory || "",
  supplierName: row.supplierName || "", supplierCode: row.supplierCode || "", customerId: number(row.customerId || row.customer_id) || null, customerName: row.customerName || row.customer_name_snapshot || "", transportMode: row.transportMode || row.transport_mode || "",
  courierName: row.courierName || row.courier_name || "", courierReceiptNumber: row.courierReceiptNumber || row.courier_receipt_number || "", entryDateTime: formatDateTimeLocalInput(row.entryDateTime), lastUpdatedAt: row.lastUpdatedAt || row.updated_at || row.created_at || null,
  vehicleNumber: row.vehicleNumber || "", driverName: row.driverName || "", drivingLicenceNumber: row.drivingLicenceNumber || "", itemCount: number(row.itemCount), totalQuantity: number(row.totalQuantity), deliveryLocation: row.deliveryLocation || "", status: row.status,
});

export const mapEligibleGateOrder = (row: any): EligibleGateOrder => ({
  id: number(row.id), poNumber: row.poNumber || "", supplierName: row.supplierName || "", supplierCode: row.supplierCode || "", itemCategory: row.itemCategory || "Item type unavailable", deliveryLocation: row.deliveryLocation || "", itemCount: number(row.itemCount), openQuantity: number(row.openQuantity), transportMode: row.transportMode || "", allowedTransportModes: transportModes(row.allowedTransportModes),
});

const status = (value: string): GrnRecord["status"] => ({ ACCEPTED: "READY_FOR_STOCK", PARTIALLY_ACCEPTED: "READY_FOR_STOCK", POSTED: "STOCK_POSTED", INWARD: "INSPECTION_PENDING" }[value] as GrnRecord["status"]) || value as GrnRecord["status"];

const defaultReceiptSubinventory = (itemGroupCode: unknown) => {
  const groupCode = String(itemGroupCode || "").toUpperCase();
  if (groupCode === "TL") return "TOOLS";
  if (["RM", "FG"].includes(groupCode)) return groupCode;
  return "";
};

const mapGrnItem = (item: any, row: any): GrnItem => ({
  id: number(item.grn_item_id), itemId: number(item.item_id) || undefined, itemGroupCode: item.item_group_code || "", directRatePerQty: number(item.direct_rate_per_qty), taxPercent: number(item.tax_percent), purchaseOrderItemId: number(item.purchase_order_item_id),
  itemCode: item.item_code_snapshot || "", itemName: item.item_description_snapshot || "", specification: item.item_specification_snapshot || "", uom: item.uom_code_snapshot || "", orderedQuantity: number(item.ordered_quantity), previouslyReceivedQuantity: number(item.previously_received_quantity), currentReceivedQuantity: number(item.received_quantity), batchSerialNumber: item.batch_serial_number || "",
  inspectionRequired: row.inspection_status !== "NOT_REQUIRED" && row.inspection_status !== "PROCESS_PLAN_PENDING",
  mtcApplicable: String(item.item_mtc_applicable ?? item.mtcApplicable ?? "N").toUpperCase() === "Y",
  mtcCertificates: (item.mtc_certificates || item.mtcCertificates || []).map((certificate: any) => ({
    attachmentId: number(certificate.attachmentId || certificate.attachment_id), grnItemId: number(certificate.grnItemId || certificate.grn_item_id), attachmentType: certificate.attachmentType || certificate.attachment_type || "MTC_CERTIFICATE", attachmentName: certificate.attachmentName || certificate.attachment_name || "",
    fileName: certificate.fileName || certificate.file_name || "", fileUrl: certificate.fileUrl || certificate.file_url || "", mimeType: certificate.mimeType || certificate.mime_type || "", fileSizeBytes: number(certificate.fileSizeBytes || certificate.file_size_bytes), uploadedBy: certificate.uploadedBy || certificate.uploaded_by || "", uploadedAt: certificate.uploadedAt || certificate.uploaded_at || "",
  })),
  acceptedQuantity: number(item.accepted_quantity), rejectedQuantity: number(item.rejected_quantity), onHoldQuantity: number(item.on_hold_quantity), inspectionResult: number(item.on_hold_quantity) ? "ON_HOLD" : number(item.rejected_quantity) ? (number(item.accepted_quantity) ? "PARTIAL" : "REJECTED") : number(item.accepted_quantity) ? "ACCEPTED" : "PENDING", inspectionDisposition: item.inspection_disposition || "PENDING",
  inspectionCharacteristics: (item.inspectionCharacteristics || []).map((characteristic: any) => ({
    id: number(characteristic.grn_inspection_characteristic_id), characteristicCode: characteristic.characteristic_code_snapshot || "", characteristicName: characteristic.characteristic_name_snapshot || "", characteristicType: characteristic.characteristic_type_snapshot || "", specifiedDimension: characteristic.specified_dimension === null ? null : number(characteristic.specified_dimension), toleranceGrade: characteristic.tolerance_grade_text || "", toleranceMinus: characteristic.tolerance_minus === null ? null : number(characteristic.tolerance_minus), tolerancePlus: characteristic.tolerance_plus === null ? null : number(characteristic.tolerance_plus), lsl: characteristic.lsl === null ? null : number(characteristic.lsl), usl: characteristic.usl === null ? null : number(characteristic.usl), drawingGrid: characteristic.drawing_grid || "", instrument: characteristic.instrument_name_snapshot || "", sampleSize: characteristic.sample_size_snapshot || "", inspectionFrequency: characteristic.inspection_frequency_snapshot || "", actualValue: characteristic.actual_value || "", inspectionResult: characteristic.inspection_result || "PENDING", remarks: characteristic.remarks || "",
  })),
  rejectionReasonId: number(item.rejection_reason_id) || undefined, rejectionDispositionId: number(item.rejection_disposition_id) || undefined, rejectionReason: item.rejection_reason || "", rejectionAttachmentReference: item.rejection_attachment_reference || "",
  rejectionAttachments: (item.rejection_attachments || item.rejectionAttachments || []).map((attachment: any) => ({ rejectionAttachmentId: number(attachment.rejectionAttachmentId || attachment.grn_rejection_attachment_id), grnItemId: number(attachment.grnItemId || attachment.grn_item_id), fileName: attachment.fileName || attachment.file_name || "", fileUrl: attachment.fileUrl || attachment.file_url || "", mimeType: attachment.mimeType || attachment.mime_type || "", fileSizeBytes: number(attachment.fileSizeBytes || attachment.file_size_bytes), uploadedBy: attachment.uploadedBy || attachment.uploaded_by || "", uploadedAt: attachment.uploadedAt || attachment.uploaded_at || "" })),
  qualityRemarks: item.quality_remarks || "", warehouse: item.item_group_code === "TL" ? "Tool Crib" : item.warehouse_code || "Main Stores", subinventoryCode: item.item_group_code === "TL" ? "TOOLS" : item.sub_inventory_code || defaultReceiptSubinventory(item.item_group_code), binLocation: item.item_group_code === "TL" ? "Tooling" : item.bin_location || "",
});

export const mapGrn = (row: any): GrnRecord => ({
  id: String(row.id || row.grn_id), grnNumber: row.grnNumber || row.grn_number || "", gateEntryId: String(row.gate_entry_id || row.gateEntryId || ""), gateEntryNumber: row.gate_entry_number || row.gateEntryNumber || "", gateEntryReferenceNumber: row.gateEntryReferenceNumber || row.gate_entry_reference_number || row.outsourcing_part_number_snapshot || "",
  poId: String(row.purchaseOrderId || row.purchase_order_id || ""), poNumber: row.poNumber || "", supplierName: row.supplierName || row.supplier_name_snapshot || "", supplierCode: row.supplierCode || "", supplierId: number(row.supplier_id || row.supplierId) || null,
  outsourcingPartId: number(row.outsourcing_part_id || row.outsourcingPartId) || null, outsourcingPartNumber: row.outsourcing_part_number_snapshot || row.outsourcingPartNumber || "", outsourcingPartName: row.outsourcing_part_name_snapshot || row.outsourcingPartName || "", outsourcingPartUom: row.outsourcing_part_uom_snapshot || row.outsourcingPartUom || "", outsourcingProcessPlanId: number(row.outsourcing_process_plan_id || row.outsourcingProcessPlanId) || null, outsourcingProcessPlanCode: row.outsourcing_process_plan_code || row.outsourcingProcessPlanCode || "", outsourcingProcessOperationId: number(row.outsourcing_process_operation_id || row.outsourcingProcessOperationId) || null,
  purchaseReason: row.purchase_reason || "", purchaseApprovedBy: row.purchase_approved_by || row.purchaseApprovedBy || "", jobReference: row.job_reference || "", receiptType: row.receipt_type || row.receiptType || "REGULAR_PURCHASE", customerId: row.customer_id ? number(row.customer_id) : (row.customerId ? number(row.customerId) : null), customerName: row.customer_name_snapshot || row.customerName || "", customerPlantCode: row.customer_plant_code || row.customerPlantCode || "",
  receiptDate: date(row.grnDate || row.grn_date), lastUpdatedAt: row.lastUpdatedAt || row.updated_at || row.created_at || null, supplierInvoiceNumber: row.supplierInvoiceNumber || row.supplier_invoice_number || "", supplierInvoiceDate: date(row.supplier_invoice_date), deliveryChallanNumber: row.deliveryChallanNumber || row.delivery_challan_number || "", attachmentName: "", receivedBy: row.received_by || "", stockPostingDate: date(row.stock_posting_date), remarks: row.remarks || "", status: status(row.status || "DRAFT"),
  items: (row.items || (number(row.itemCount) ? [{ grn_item_id: 0, received_quantity: row.receivedQuantity, accepted_quantity: row.acceptedQuantity, rejected_quantity: row.rejectedQuantity }] : [])).map((item: any) => mapGrnItem(item, row)),
});
