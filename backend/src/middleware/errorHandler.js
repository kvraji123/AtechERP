import multer from "multer";

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error?.code === "ER_DUP_ENTRY") {
    const duplicateMessage = String(error.sqlMessage || "");
    const message = duplicateMessage.includes("uq_item_code")
      ? "Item Code already exists."
      : duplicateMessage.includes("uq_item_supplier")
        ? "The same supplier cannot be selected more than once."
        : duplicateMessage.includes("uq_part_number")
      ? "Part Number already exists in Part Master."
      : duplicateMessage.includes("uq_customer_code")
        ? "Customer Code already exists."
      : duplicateMessage.includes("uq_customer_purchase_order_customer_reference")
        ? "This customer PO number already exists for the selected customer."
        : duplicateMessage.includes("uq_customer_purchase_order_number")
          ? "Customer PO document number already exists."
        : "A record with the same unique value already exists.";
    return res.status(409).json({
      success: false,
      message,
      details: error.sqlMessage,
    });
  }

  if (error?.code === "ER_NO_REFERENCED_ROW_2") {
    const constraint = String(error.constraint || error.sqlMessage || "");
    const foreignKeyMessages = {
      fk_item_group: "The selected Item Group no longer exists. Refresh the form and select it again.",
      fk_item_type: "The selected Item Category no longer exists for this Item Group. Refresh the form and select it again.",
      fk_item_uom: "The selected UOM no longer exists. Refresh the form and select it again.",
      fk_item_material: "The selected Material no longer exists. Refresh the form and select it again.",
      fk_item_material_grade: "The selected Material & Grade no longer exists. Refresh the form and select it again.",
      fk_item_machine_type: "The selected Machine Type no longer exists. Refresh the form and select it again.",
      fk_item_supplier_party: "The selected supplier no longer exists. Refresh the form and select it again.",
      fk_item_specification_field: "This Item Category's specification setup has changed. Refresh the form and select the category again.",
      fk_item_specification_uom: "A selected specification UOM no longer exists. Refresh the form and select it again.",
      fk_item_incoming_inspection_characteristic: "A selected Incoming Inspection characteristic no longer exists. Refresh the form and select it again.",
      fk_item_incoming_inspection_tolerance: "The selected tolerance grade no longer exists. Refresh the form and select it again.",
      fk_item_incoming_inspection_instrument: "The selected inspection instrument no longer exists. Refresh the form and select it again.",
      fk_purchase_request_preferred_supplier: "The preferred supplier on this purchase request no longer exists. Edit the purchase request and select an active supplier again.",
      fk_purchase_request_item_master: "An item on this purchase request no longer exists. Edit the purchase request and select the current item again.",
      fk_pr_supplier_assignment_item: "The selected purchase-request line no longer exists. Refresh the supplier assignment and select the current line again.",
      fk_pr_supplier_assignment_supplier: "The supplier assigned to this purchase-request line no longer exists. Select an active supplier again.",
      fk_purchase_order_supplier: "The supplier selected for this purchase order no longer exists. Update the purchase request with an active preferred supplier and try again.",
      fk_purchase_order_item_request_line: "An approved purchase-request line no longer exists. Refresh the PO workspace and select the purchase request again.",
      fk_purchase_order_item_master: "An item in the selected purchase request no longer exists. Edit the purchase request and select the current item again.",
      fk_purchase_order_source_header: "The purchase-order draft could not be saved because its header reference changed. Refresh the PO workspace and try again.",
      fk_purchase_order_source_item: "The purchase-order line could not be saved because its source reference changed. Refresh the PO workspace and try again.",
      fk_item_supplier_item: "The selected item no longer exists for the supplier update. Edit the purchase request and select the current item again.",
      fk_item_supplier_party: "The selected supplier no longer exists for the supplier update. Select an active supplier again.",
    };
    const message = Object.entries(foreignKeyMessages).find(([name]) => constraint.includes(name))?.[1]
      || "A selected master record no longer exists. Refresh the form and select the current master value again.";
    return res.status(400).json({
      success: false,
      message,
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal server error.",
    details: error.details || undefined,
  });
}
