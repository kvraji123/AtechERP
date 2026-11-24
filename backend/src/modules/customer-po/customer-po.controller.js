import { sendSuccess } from "../../utils/response.js";
import * as service from "./customer-po.service.js";

export async function listEligibleEnquiries(req, res) {
  return sendSuccess(res, { data: await service.listEligibleEnquiries(req.user) });
}

export async function getEnquirySource(req, res) {
  return sendSuccess(res, { data: await service.getEnquirySource(req.params.enquiryId, req.user) });
}

export async function list(req, res) {
  const result = await service.listCustomerPurchaseOrders(req.query, req.user);
  return sendSuccess(res, { data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
}

export async function get(req, res) {
  return sendSuccess(res, { data: await service.getCustomerPurchaseOrder(req.params.id, req.user) });
}

export async function create(req, res) {
  return sendSuccess(res, { statusCode: 201, message: "Customer PO draft created.", data: await service.createCustomerPurchaseOrder(req.body, req.user) });
}

export async function update(req, res) {
  return sendSuccess(res, { message: "Customer PO draft updated.", data: await service.updateCustomerPurchaseOrder(req.params.id, req.body, req.user) });
}

export async function confirm(req, res) {
  return sendSuccess(res, { message: "Customer PO confirmed.", data: await service.confirmCustomerPurchaseOrder(req.params.id, req.user) });
}

export async function convert(req, res) {
  return sendSuccess(res, { statusCode: 201, message: "Sales Order created from Customer PO.", data: await service.convertToSalesOrder(req.params.id, req.body, req.user) });
}

export async function listSalesOrders(req, res) {
  return sendSuccess(res, { data: await service.listSalesOrders(req.query, req.user) });
}
