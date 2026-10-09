import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requirePermission } from "../../shared/middleware/requirePermission.js";
import * as controller from "./inventory.controller.js";
import { listLocations } from "./inventory-location.repository.js";
import { sendSuccess } from "../../utils/response.js";

const router = Router();
router.get("/locations", requirePermission("GRN_POST"), asyncHandler(async (req,res) =>
  sendSuccess(res, { data: await listLocations(req.user.tenantId) })));

// Inventory visibility follows the current GRN stock-posting permission until dedicated inventory roles are configured.
router.get("/dashboard", requirePermission("GRN_POST"), asyncHandler(controller.dashboard));
router.get("/stock", requirePermission("GRN_POST"), asyncHandler(controller.stock));
router.get("/transactions", requirePermission("GRN_POST"), asyncHandler(controller.transactions));
router.get("/quality-hold", requirePermission("GRN_POST"), asyncHandler(controller.qualityHold));
router.get("/outsourcing-wip", requirePermission("GRN_POST"), asyncHandler(controller.outsourcingWip));
router.get("/rejection-inventory", requirePermission("GRN_POST"), asyncHandler(controller.rejectionInventory));
router.get("/customer-stock", requirePermission("GRN_POST"), asyncHandler(controller.customerStock));
router.get("/return-to-customer", requirePermission("GRN_POST"), asyncHandler(controller.customerReturnDocuments));
router.post("/customer-material-jobs/issue", requirePermission("GRN_POST"), asyncHandler(controller.issueCustomerMaterialToJob));
router.post("/customer-material-jobs/return", requirePermission("GRN_POST"), asyncHandler(controller.returnCustomerMaterialFromJob));
router.post("/customer-material-jobs/consume", requirePermission("GRN_POST"), asyncHandler(controller.consumeCustomerMaterialForJob));
router.post("/return-to-customer", requirePermission("GRN_POST"), asyncHandler(controller.createReturnToCustomerDocument));
router.post("/return-to-customer/:documentId/approve", requirePermission("PO_APPROVE"), asyncHandler(controller.approveReturnToCustomerDocument));
router.post("/return-to-customer/:documentId/acknowledge", requirePermission("GRN_POST"), asyncHandler(controller.acknowledgeReturnToCustomerDocument));
router.post("/return-to-customer/:documentId/dispatch", requirePermission("GRN_POST"), asyncHandler(controller.dispatchReturnToCustomerDocument));
router.post("/rejection-inventory/:balanceId/resolve", requirePermission("GRN_POST"), asyncHandler(controller.resolveRejectionInventory));
router.post("/return-to-vendor/:rtvDocumentId/approve", requirePermission("PO_APPROVE"), asyncHandler(controller.approveReturnToVendor));
router.post("/return-to-vendor/:rtvDocumentId/acknowledge", requirePermission("GRN_POST"), asyncHandler(controller.acknowledgeReturnToVendor));
router.post("/return-to-vendor/:rtvDocumentId/dispatch", requirePermission("GRN_POST"), asyncHandler(controller.dispatchReturnToVendor));
router.post("/rejection-resolutions/:requestId/approve", requirePermission("PO_APPROVE"), asyncHandler(controller.approveRejectionResolution));
router.post("/rejection-resolutions/:requestId/acknowledge-customer", requirePermission("GRN_POST"), asyncHandler(controller.acknowledgeReturnToCustomer));
router.post("/rejection-resolutions/:requestId/execute", requirePermission("GRN_POST"), asyncHandler(controller.executeRejectionResolution));
router.post("/rework-balances/:reworkBalanceId/complete", requirePermission("GRN_POST"), asyncHandler(controller.completeRework));
router.post("/rework-balances/:reworkBalanceId/reinspect", requirePermission("GRN_POST"), asyncHandler(controller.reinspectRework));
router.post("/rework-balances/:reworkBalanceId/post", requirePermission("GRN_POST"), asyncHandler(controller.postReworkedStock));
router.get("/reorder-alerts", requirePermission("GRN_POST"), asyncHandler(controller.reorderAlerts));

export default router;
