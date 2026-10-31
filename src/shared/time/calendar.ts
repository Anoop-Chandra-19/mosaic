export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** The first moment of that day, on this computer's clock. */
export const startOfDay = (ms: number): number => new Date(ms).setHours(0, 0, 0, 0);

/** The first moment of that month, on this computer's clock. */
export function startOfMonth(ms: number): number {
  const date = new Date(ms);
  date.setDate(1);
  return date.setHours(0, 0, 0, 0);
}

/** "2026-09-22", on this computer's clock. */
export const formatDateDashed = (date: Date): string =>
  `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

/** "2026-09-22 14:03", on this computer's clock. */
export const formatDateTimeDashed = (date: Date): string =>
  `${formatDateDashed(date)} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
