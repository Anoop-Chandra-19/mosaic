import { describe, expect, it } from 'vitest';
import { formatWhen } from '../formatWhen';

// Sunday 13 September 2026, 15:30 local time.
const now = new Date(2026, 8, 13, 15, 30).getTime();
const at = (month: number, day: number, hour: number, minute = 0, year = 2026) =>
  new Date(year, month, day, hour, minute).getTime();

describe('formatWhen', () => {
  it('says how long ago for today', () => {
    expect(formatWhen(now - 20_000, now)).toBe('just now');
    expect(formatWhen(at(8, 13, 15, 18), now)).toBe('12 min ago');
    expect(formatWhen(at(8, 13, 12, 10), now)).toBe('3h ago');
    expect(formatWhen(at(8, 13, 0, 5), now)).toBe('15h ago');
  });

  it('names yesterday with the time', () => {
    expect(formatWhen(at(8, 12, 21, 12), now)).toMatch(/^Yesterday, 9:12/);
  });

  it('gives the date for anything older, with the year only when it differs', () => {
    expect(formatWhen(at(2, 4, 10), now)).toMatch(/Mar 4|4 Mar/);
    expect(formatWhen(at(2, 4, 10, 0, 2025), now)).toMatch(/2025/);
  });
});
