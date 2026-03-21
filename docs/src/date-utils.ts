/**
 * Parses a date value into a local-time Date to avoid UTC-midnight timezone shifts.
 * ISO date strings like "2026-03-21" are parsed as local noon to stay on the correct day
 * regardless of the runtime's UTC offset.
 */
function toLocalDate(date: Date | string): Date {
  // gray-matter/js-yaml parses YAML date fields as UTC midnight Date objects.
  // Re-construct using UTC parts so UTC-behind timezones don't shift the day back.
  if (date instanceof Date) {
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  }
  // Match YYYY-MM-DD at the start of any ISO string (e.g. "2026-03-21" or "2026-03-21T00:00:00.000Z")
  // and construct as local noon to avoid UTC-offset day shifts on the client after JSON deserialization.
  const m = (date as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
  return new Date(date as string);
}

/**
 * Formats a Date or date string into a human-readable form.
 * Uses the `en-US` locale with month-name style (e.g. "January 15, 2026").
 */
export function formatDate(date: Date | string): string {
  return toLocalDate(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Returns an ISO 8601 string (e.g. "2026-01-15") suitable for a `datetime` attribute.
 */
export function isoDate(date: Date | string): string {
  const d = toLocalDate(date);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}
