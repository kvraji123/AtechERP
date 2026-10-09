import { AppError } from "../../utils/AppError.js";

export function transitionOrThrow(transitions, from, to) {
  if (!transitions[from]?.includes(to)) {
    throw new AppError(`Cannot change status from ${from} to ${to}.`, 409, { from, to });
  }
}

export function requireReason(reason, message = "A reason is required for this action.") {
  if (!String(reason || "").trim()) throw new AppError(message, 400);
  return String(reason).trim();
}

export function requirePositive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new AppError(`${label} must be greater than zero.`);
  return number;
}
