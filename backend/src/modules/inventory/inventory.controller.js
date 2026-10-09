import { sendSuccess } from "../../utils/response.js";
import * as service from "./inventory.service.js";

export async function dashboard(req, res) { return sendSuccess(res, { data: await service.dashboard(req.user) }); }
const paged = (res, result) => sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
export async function stock(req, res) { return paged(res, await service.stock(req.query, req.user)); }
export async function transactions(req, res) { return paged(res, await service.transactions(req.query, req.user)); }
export async function qualityHold(req, res) { return paged(res, await service.qualityHold(req.query, req.user)); }
export async function outsourcingWip(req, res) { return paged(res, await service.outsourcingWip(req.query, req.user)); }
export async function rejectionInventory(req, res) { return paged(res, await service.rejectionInventory(req.query, req.user)); }
export async function customerStock(req, res) { const result = await service.customerStock(req.query, req.user); return sendSuccess(res, { data: { stock: result.stock, jobs: result.jobs }, meta: { total: Math.max(result.stockTotal, result.jobsTotal), stockTotal: result.stockTotal, jobsTotal: result.jobsTotal, page: result.page, pageSize: result.pageSize } }); }
export async function customerReturnDocuments(req, res) { return paged(res, await service.customerReturnDocuments(req.query, req.user)); }
export async function issueCustomerMaterialToJob(req, res) { return sendSuccess(res, { message:"Customer material issued to job.", data:await service.issueCustomerMaterialToJob(req.body,req.user) }); }
export async function returnCustomerMaterialFromJob(req, res) { return sendSuccess(res, { message:"Customer material returned from job to customer stock.", data:await service.returnCustomerMaterialFromJob(req.body,req.user) }); }
export async function consumeCustomerMaterialForJob(req, res) { return sendSuccess(res, { message:"Customer material consumption recorded.", data:await service.consumeCustomerMaterialForJob(req.body,req.user) }); }
export async function createReturnToCustomerDocument(req, res) { return sendSuccess(res, { statusCode:201,message:"Return-to-Customer document submitted for approval.", data:await service.createReturnToCustomerDocument(req.body,req.user) }); }
export async function approveReturnToCustomerDocument(req, res) { return sendSuccess(res, { message:"Return-to-Customer document approved and PDF generated.", data:await service.approveReturnToCustomerDocument(req.params.documentId,req.body,req.user) }); }
export async function acknowledgeReturnToCustomerDocument(req, res) { return sendSuccess(res, { message:"Customer acknowledgement recorded.", data:await service.acknowledgeReturnToCustomerDocument(req.params.documentId,req.body,req.user) }); }
export async function dispatchReturnToCustomerDocument(req, res) { return sendSuccess(res, { message:"Return-to-Customer dispatched and quarantined stock updated.", data:await service.dispatchReturnToCustomerDocument(req.params.documentId,req.body,req.user) }); }
export async function resolveRejectionInventory(req, res) { return sendSuccess(res, { message:"Rejection inventory updated.", data:await service.resolveRejectionInventory(req.params.balanceId,req.body,req.user) }); }
export async function approveReturnToVendor(req, res) { return sendSuccess(res, { message:"RTV approved and PDF generated.", data:await service.approveReturnToVendor(req.params.rtvDocumentId,req.body,req.user) }); }
export async function acknowledgeReturnToVendor(req, res) { return sendSuccess(res, { message:"Supplier acknowledgement recorded.", data:await service.acknowledgeReturnToVendor(req.params.rtvDocumentId,req.body,req.user) }); }
export async function dispatchReturnToVendor(req, res) { return sendSuccess(res, { message:"RTV dispatched and rejection inventory updated.", data:await service.dispatchReturnToVendor(req.params.rtvDocumentId,req.user) }); }
export async function approveRejectionResolution(req, res) { return sendSuccess(res, { message:"Rejection resolution approved and document generated.", data:await service.approveRejectionResolution(req.params.requestId,req.body,req.user) }); }
export async function acknowledgeReturnToCustomer(req, res) { return sendSuccess(res, { message:"Customer acknowledgement recorded.", data:await service.acknowledgeReturnToCustomer(req.params.requestId,req.body,req.user) }); }
export async function executeRejectionResolution(req, res) { return sendSuccess(res, { message:"Rejection resolution executed.", data:await service.executeRejectionResolution(req.params.requestId,req.body,req.user) }); }
export async function completeRework(req, res) { return sendSuccess(res, { message:"Rework completed and material returned for re-inspection.", data:await service.completeRework(req.params.reworkBalanceId,req.body,req.user) }); }
export async function reinspectRework(req, res) { return sendSuccess(res, { message:"Rework Quality re-inspection recorded.", data:await service.reinspectRework(req.params.reworkBalanceId,req.body,req.user) }); }
export async function postReworkedStock(req, res) { return sendSuccess(res, { message:"Accepted rework posted to inventory.", data:await service.postReworkedStock(req.params.reworkBalanceId,req.body,req.user) }); }
export async function reorderAlerts(req, res) { return paged(res, await service.reorderAlerts(req.query, req.user)); }
