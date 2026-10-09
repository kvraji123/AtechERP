import { db } from "../config/db.js";
import { AppError } from "./AppError.js";

const clean = (value) => String(value ?? "").trim().toUpperCase();

export function parseTransportModes(value, legacyValue = "") {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }

  const modes = Array.isArray(source) ? source : [];
  const normalized = [...new Set(modes.map(clean).filter(Boolean))];
  if (normalized.length) return normalized;

  const legacy = clean(legacyValue);
  return legacy ? [legacy] : [];
}

export function readTransportModes(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
        try { return JSON.parse(value); } catch { return [value]; }
      })()
      : [];
  return [...new Set((Array.isArray(source) ? source : []).map(clean).filter(Boolean))];
}

export async function assertActiveTransportModes(modes, connection = db) {
  if (!modes.length) return;
  const placeholders = modes.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT value_code FROM marketing_reference_values
      WHERE reference_type='TRANSPORT_MODE' AND active_flag='Y'
        AND value_code IN (${placeholders})`,
    modes
  );
  const activeModes = new Set(rows.map((row) => clean(row.value_code)));
  const invalid = modes.filter((mode) => !activeModes.has(mode));
  if (invalid.length) {
    throw new AppError(`Transport mode${invalid.length > 1 ? "s" : ""} ${invalid.join(", ")} ${invalid.length > 1 ? "are" : "is"} not active in the Transport Mode master.`);
  }
}

export async function assertPartyTransportMode({
  selectedMode,
  allowedModes,
  partyLabel,
  connection = db,
}) {
  const mode = clean(selectedMode);
  const allowed = parseTransportModes(allowedModes);

  if (!mode) {
    throw new AppError(`Select the actual transport mode for this ${partyLabel.toLowerCase()} shipment.`);
  }
  if (!allowed.length) {
    throw new AppError(`${partyLabel} has no allowed transport modes. Update the ${partyLabel} Master before creating this shipment.`);
  }
  if (!allowed.includes(mode)) {
    throw new AppError(`${mode} is not an allowed transport mode for this ${partyLabel.toLowerCase()}.`);
  }
  await assertActiveTransportModes([mode], connection);
  return mode;
}

export function transportModesJson(modes) {
  return modes.length ? JSON.stringify(modes) : null;
}
