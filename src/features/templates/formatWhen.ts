const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function startOfDay(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * When something happened, as a history row says it: "just now", "12 min ago", "3h ago"
 * today; "Yesterday, 9:12 PM"; "Mar 4" this year; "Mar 4, 2025" before that.
 */
export function formatWhen(ms: number, now: number = Date.now()): string {
  const ago = now - ms;
  if (ago < MINUTE) return 'just now';
  const today = startOfDay(now);
  if (ms >= today) {
    return ago < HOUR ? `${Math.floor(ago / MINUTE)} min ago` : `${Math.floor(ago / HOUR)}h ago`;
  }
  const date = new Date(ms);
  if (ms >= startOfDay(today - 1)) {
    return `Yesterday, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
