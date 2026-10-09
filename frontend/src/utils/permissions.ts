import type { User } from "../types";

export const Permissions = {
  editEnquiryAllStages: "EDIT_ENQUIRY_ALL_STAGES",
} as const;

const normalize = (value: unknown) =>
  String(value ?? "").trim().toUpperCase();

export function hasPermission(
  user: User | null | undefined,
  permission: string
) {
  if (!user) return false;

  const required = normalize(permission);
  const assigned = Array.isArray(user.permissions)
    ? user.permissions.map(normalize)
    : [];

  return (
    normalize(user.roleName) === "ADMINISTRATOR" ||
    assigned.includes(required)
  );
}
