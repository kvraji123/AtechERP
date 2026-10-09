import { AppError } from "../../utils/AppError.js";

export function requirePermission(...required) {
  return (req, _res, next) => {
    const permissions = new Set(req.user?.permissions || []);
    if (permissions.has("*") || required.some((permission) => permissions.has(permission))) {
      return next();
    }
    return next(new AppError("You do not have permission to perform this action.", 403, { required }));
  };
}
