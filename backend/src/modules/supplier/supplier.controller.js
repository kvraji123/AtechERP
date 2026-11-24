import { sendSuccess } from "../../utils/response.js";
import * as service from "./supplier.service.js";

export async function listSuppliers(req, res) {
  const result = await service.listSuppliers(req.query);

  return sendSuccess(res, {
    data: result.rows,
    meta: {
      total: result.total,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
    },
  });
}

export async function lookupActiveSuppliers(req, res) {
  return sendSuccess(res, {
    data: await service.lookupActiveSuppliers(req.query),
  });
}

export async function getSupplier(req, res) {
  const supplier = await service.getSupplier(req.params.supplierId);
  return sendSuccess(res, { data: supplier });
}

export async function createSupplier(req, res) {
  const result = await service.createSupplier(
    req.body,
    req.user
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: "Supplier created successfully.",
    data: result,
  });
}

export async function updateSupplier(req, res) {
  const supplier = await service.updateSupplier(
    req.params.supplierId,
    req.body,
    req.user
  );

  return sendSuccess(res, {
    message: "Supplier updated successfully.",
    data: supplier,
  });
}

export async function changeSupplierStatus(req, res) {
  const supplier = await service.changeSupplierStatus(
    req.params.supplierId,
    req.body,
    req.user.userCode
  );

  return sendSuccess(res, {
    message: "Supplier status updated successfully.",
    data: supplier,
  });
}

export async function hardDeleteSupplier(req, res) {
  await service.hardDeleteSupplier(req.params.supplierId, req.user);

  return sendSuccess(res, {
    message: "Inactive supplier permanently deleted.",
  });
}
