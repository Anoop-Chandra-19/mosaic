import { describe, expect, it } from 'vitest';
import { formatDateTimeDashed } from '../calendar';

describe('formatDateTimeDashed', () => {
  it('pads every part to a fixed width', () => {
    expect(formatDateTimeDashed(new Date(2026, 0, 5, 9, 3))).toBe('2026-01-05 09:03');
  });
});
