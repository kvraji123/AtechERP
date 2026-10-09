import { env } from "../config/env.js";

export function requestContext(req, _res, next) {
  const userCode = String(
    req.headers["x-user-code"] ||
    req.headers["x-employee-code"] ||
    "SYSTEM"
  ).trim();

  const suppliedPermissions = String(
    req.headers["x-user-permissions"] || ""
  )
    .split(",")
    .map((permission) => permission.trim().toUpperCase())
    .filter(Boolean);

  const administratorPermissions = [
    "EDIT_ENQUIRY_ALL_STAGES",
    "CLOSE_FEASIBILITY",
    "GENERATE_REGRET_LETTER",
    "APPROVE_REGRET_LETTER",
    "SEND_REGRET_LETTER",
    "COMPLETE_WORKOUT",
    "CREATE_QUOTATION",
    "FINALIZE_QUOTATION",
    "GENERATE_QUOTATION_PDF",
    "SEND_QUOTATION_EMAIL",
  ];

  const role = String(
    req.headers["x-user-role"] ||
    (userCode === "SYSTEM" ? "Administrator" : "User")
  ).trim();

  const roleKey = role.toUpperCase().replace(/\s+/g, "_");
  const purchasePermissions = [
    "PR_CREATE", "PR_SUBMIT", "PR_APPROVE", "RFQ_CREATE", "QUOTE_ENTER",
    "SUPPLIER_SELECT", "PO_CREATE", "PO_APPROVE", "GRN_POST", "REPORT_VIEW",
  ];

  req.user = {
    userCode,
    employeeName: String(
      req.headers["x-user-name"] ||
      (userCode === "SYSTEM" ? "System Administrator" : userCode)
    ).trim(),
    role,
    permissions: roleKey === "ADMINISTRATOR" || roleKey === "PURCHASE_MANAGER"
      ? [...new Set([...administratorPermissions, ...purchasePermissions, ...suppliedPermissions])]
      : suppliedPermissions,
    // Tenant is resolved from server configuration/auth context, never from request body.
    tenantId: String(env.userTenantMap[userCode] || env.defaultTenantId),
    companyId: env.defaultCompanyId,
  };

  next();
}
