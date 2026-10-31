import { HOUR, MINUTE, startOfDay } from './calendar';

// Made once: a formatter is slow to make, and every row on screen formats its time on each
// step through the history.
const TIME_OF_DAY = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const WEEKDAY_DATE = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const WEEKDAY_DATE_WITH_YEAR = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

const isSameYear = (ms: number, now: number) =>
  new Date(ms).getFullYear() === new Date(now).getFullYear();

/** "9:12 PM", as this computer writes a clock time. */
export const formatTimeOfDay = (ms: number): string => TIME_OF_DAY.format(ms);

/** "3.4": for a sentence that says "seconds" itself. */
export const toSeconds = (ms: number): string => (Math.max(0, ms) / 1000).toFixed(1);

/** "3.4s". */
export const formatSeconds = (ms: number): string => `${toSeconds(ms)}s`;

/** "Mar 4". */
export const formatShortDate = (ms: number): string => SHORT_DATE.format(ms);

/** "Mar 2026". */
export const formatMonth = (ms: number): string => MONTH.format(ms);

/** A day as a heading: "Today", "Yesterday", "Wed, Mar 4", with the year only when it differs. */
export function formatDay(ms: number, now: number = Date.now()): string {
  const today = startOfDay(now);
  const day = startOfDay(ms);
  if (day === today) return 'Today';
  if (day === startOfDay(today - 1)) return 'Yesterday';
  return (isSameYear(ms, now) ? WEEKDAY_DATE : WEEKDAY_DATE_WITH_YEAR).format(ms);
}

/** "just now", "12 min ago" or "3h ago" for a moment today; null before today. */
function formatAgoToday(ms: number, now: number): string | null {
  const ago = now - ms;
  if (ago < MINUTE) return 'just now';
  if (ms < startOfDay(now)) return null;
  return ago < HOUR ? `${Math.floor(ago / MINUTE)} min ago` : `${Math.floor(ago / HOUR)}h ago`;
}

/** A time under its day's heading: how long ago today, "9:12 PM" before. */
export const formatTimeInDay = (ms: number, now: number = Date.now()): string =>
  formatAgoToday(ms, now) ?? formatTimeOfDay(ms);

/**
 * When something happened, with no heading to lean on: how long ago today; "Yesterday, 9:12 PM";
 * "Mar 4" this year; "Mar 4, 2025" before that.
 */
export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const agoToday = formatAgoToday(ms, now);
  if (agoToday !== null) return agoToday;
  if (ms >= startOfDay(startOfDay(now) - 1)) return `Yesterday, ${formatTimeOfDay(ms)}`;
  return (isSameYear(ms, now) ? SHORT_DATE : SHORT_DATE_WITH_YEAR).format(ms);
}
