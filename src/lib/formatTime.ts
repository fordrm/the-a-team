/**
 * Formats a date string as a relative timestamp.
 * - Under 1 minute: "Just now"
 * - Under 1 hour: "12m ago"
 * - Under 24 hours: "3h ago"
 * - Under 7 days: "2d ago"
 * - Under 1 year: "Feb 15"
 * - Over 1 year: "Feb 15, 2025"
 *
 * If `includeTime` is true, dates older than 24h also show the time, e.g. "Feb 15 at 2:30 PM"
 */
export function formatRelativeTime(dateStr: string, includeTime = false): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  const time = date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  if (sameYear) {
    return includeTime ? `${month} ${day} at ${time}` : `${month} ${day}`;
  }
  return includeTime
    ? `${month} ${day}, ${date.getFullYear()} at ${time}`
    : `${month} ${day}, ${date.getFullYear()}`;
}

/**
 * Full date+time format for tooltips: "Feb 15, 2026 at 2:30 PM"
 */
export function formatFullDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
