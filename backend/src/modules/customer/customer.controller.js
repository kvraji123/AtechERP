import { sendSuccess } from "../../utils/response.js";
import * as service from "./customer.service.js";

export async function listCustomers(req, res) {
  const result = await service.listCustomers(req.query);

  return sendSuccess(res, {
    data: result.rows,
    meta: {
      total: result.total,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
    },
  });
}

export async function getCustomer(req, res) {
  const customer = await service.getCustomer(req.params.customerId);
  return sendSuccess(res, { data: customer });
}

export async function createCustomer(req, res) {
  const result = await service.createCustomer(
    req.body,
    req.user.userCode
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Customer created successfully.",
    data: result,
  });
}

export async function updateCustomer(req, res) {
  const customer = await service.updateCustomer(
    req.params.customerId,
    req.body,
    req.user.userCode
  );

  return sendSuccess(res, {
    message: "Customer updated successfully.",
    data: customer,
  });
}

export async function changeCustomerStatus(req, res) {
  const customer = await service.changeCustomerStatus(
    req.params.customerId,
    req.body,
    req.user.userCode
  );

  return sendSuccess(res, {
    message: "Customer status updated successfully.",
    data: customer,
  });
}
