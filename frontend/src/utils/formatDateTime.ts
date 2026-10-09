const APP_TIME_ZONE = "Asia/Kolkata";

function dateParts(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;

  const source = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  if (dateOnly) return { year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]), hour: 0, minute: 0, hasTime: false };

  // MySQL DATETIME/TIMESTAMP strings are UTC because DB sessions are UTC.
  // Explicit offsets and ISO timestamps are parsed as instants as provided.
  const mysqlDateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(source);
  if (mysqlDateTime) {
    const instant = new Date(Date.UTC(Number(mysqlDateTime[1]), Number(mysqlDateTime[2]) - 1, Number(mysqlDateTime[3]), Number(mysqlDateTime[4]), Number(mysqlDateTime[5]), Number(mysqlDateTime[6] || 0)));
    return zonedParts(instant, true);
  }

  const instant = new Date(source);
  return Number.isNaN(instant.getTime()) ? null : zonedParts(instant, true);
}

function zonedParts(date: Date, hasTime: boolean) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const part = (type: string) => Number(values.find((item) => item.type === type)?.value || 0);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), hasTime };
}

export function formatDate(value: unknown): string {
  const parts = dateParts(value);
  if (!parts) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function formatDateTime(value: unknown): string {
  const parts = dateParts(value);
  if (!parts) return "—";
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
  if (!parts.hasTime) return date;
  return `${date} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatListDateTime(value: unknown): string {
  return formatDateTime(value);
}

export function parseDateTimeForDisplay(value: unknown): Date | null {
  const parts = dateParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
}

export function todayInAppTimeZone(): string {
  const parts = zonedParts(new Date(), false);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function dateTimeLocalNowInAppTimeZone(): string {
  const parts = zonedParts(new Date(), true);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatDateTimeLocalInput(value: unknown): string {
  const parts = dateParts(value);
  if (!parts || !parts.hasTime) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
