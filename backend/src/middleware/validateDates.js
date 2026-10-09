import { AppError } from '../utils/AppError.js';

export function isValidDate(value, withTime = false) {
  if (typeof value !== 'string') return false;
  const match = (withTime
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/
    : /^(\d{4})-(\d{2})-(\d{2})$/).exec(value);
  if (!match) return false;
  const [, y, m, d, h = '0', minute = '0', second = '0'] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1000 || month < 1 || month > 12 || Number(h) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

const extraDates = new Set(['effectiveFrom', 'effectiveTo', 'validFrom', 'validTo', 'validUntil', 'expectedDelivery', 'receivedOn',
  'effective_from', 'effective_to', 'valid_from', 'valid_to', 'valid_until', 'expected_delivery', 'received_on',
  'dateFrom', 'dateTo', 'date_from', 'date_to']);
const dateFilterTokens = new Map([
  ['dueDate', new Set(['ALL', 'TODAY', 'OVERDUE', 'WEEK'])],
]);
export function validateDateFields(value, path = '', options = {}) {
  if (!value || typeof value !== 'object') return;
  for (const [key, field] of Object.entries(value)) {
    const name = path ? `${path}.${key}` : key;
    const dateTime = /(?:DateTime|_date_time)$/.test(key);
    if (dateTime || key === 'date' || /(?:Date|_date)$/.test(key) || extraDates.has(key)) {
      if (field === '' || field === null || field === undefined) continue;
      const allowedTokens = options.query === true ? dateFilterTokens.get(key) : undefined;
      if (allowedTokens?.has(String(field).trim().toUpperCase())) continue;
      if (!isValidDate(field, dateTime)) throw new AppError(`${name} must be a real calendar date in ${dateTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD'} format, with a year between 1000 and 9999.`, 400);
    } else if (typeof field === 'object') validateDateFields(field, name, options);
  }
}
export function validateDates(req, _res, next) {
  try { validateDateFields(req.body); validateDateFields(req.query, '', { query: true }); next(); } catch (error) { next(error); }
}
