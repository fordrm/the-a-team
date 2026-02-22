/**
 * Consistent date formatting across the app.
 * L-6: Replaces inconsistent toLocaleDateString / toLocaleString calls.
 */

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: "numeric",
  minute: "2-digit",
};

/** Format as "Feb 22, 2026" */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString(undefined, DATE_OPTIONS);
}

/** Format as "Feb 22, 2026, 3:45 PM" */
export function formatDateTime(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleString(undefined, DATETIME_OPTIONS);
}
