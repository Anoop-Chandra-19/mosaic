import { startOfDay } from '@shared/time/calendar';
import { formatMonthName, formatShortDate, formatTimeOfDay } from '@shared/time/formatTime';
import type { ConversationSummary } from '@shared/types/agentBridge';

/** A conversation whose first message has no words to name it by. */
export const UNTITLED = 'No words to name it by';

/** "Today", "Yesterday", the month this year, then the year. */
function labelGroup(lastActiveAt: number, now: number): string {
  const today = startOfDay(now);
  const day = startOfDay(lastActiveAt);
  if (day === today) return 'Today';
  if (day === startOfDay(today - 1)) return 'Yesterday';
  const year = new Date(lastActiveAt).getFullYear();
  return year === new Date(now).getFullYear() ? formatMonthName(lastActiveAt) : String(year);
}

export interface ConversationGroup {
  label: string;
  rows: ConversationSummary[];
}

/** Rows come most recently active first, so each group is one run of them. */
export function groupConversations(
  rows: ConversationSummary[],
  now: number = Date.now()
): ConversationGroup[] {
  const groups: ConversationGroup[] = [];
  for (const row of rows) {
    const label = labelGroup(row.lastActiveAt, now);
    const last = groups.at(-1);
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

/** Under Today and Yesterday, the clock time; under a month or a year, the date. */
export function formatLastActive(lastActiveAt: number, now: number = Date.now()): string {
  const isRecent = startOfDay(lastActiveAt) >= startOfDay(startOfDay(now) - 1);
  return isRecent ? formatTimeOfDay(lastActiveAt) : formatShortDate(lastActiveAt);
}

/** "A", "A and B", "A, B and 2 more". */
export function formatResumeNames(names: string[]): string {
  if (names.length < 3) return names.join(' and ');
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
