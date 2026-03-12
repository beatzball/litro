/**
 * Formats a Date or date string into a human-readable form.
 * Uses the `en-US` locale with month-name style (e.g. "January 15, 2026").
 */
export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date as string);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Returns an ISO 8601 string (e.g. "2026-01-15") suitable for a `datetime` attribute.
 */
export function isoDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date as string);
  return d.toISOString().slice(0, 10);
}
