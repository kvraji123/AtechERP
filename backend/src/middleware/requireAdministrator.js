import { AppError } from "../utils/AppError.js";

export function requireAdministrator(req, _res, next) {
  const role = String(req.user?.role || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (role !== "ADMINISTRATOR") {
    return next(new AppError("Only administrators can perform this action.", 403));
  }

  return next();
}
