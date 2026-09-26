import { describe, expect, it } from 'vitest';
import {
  clampVisibleRange,
  NEWEST_RANGE,
  revealInVisibleRange,
  showEarlierInVisibleRange,
  showNewerInVisibleRange,
  VISIBLE_RANGE_ROWS,
  VISIBLE_RANGE_STEP,
} from '../moveVisibleRange';

describe('revealInVisibleRange', () => {
  it('leaves the range alone when the version is already well inside it', () => {
    expect(revealInVisibleRange(NEWEST_RANGE, 0)).toBe(NEWEST_RANGE);
    expect(revealInVisibleRange(NEWEST_RANGE, 100)).toBe(NEWEST_RANGE);
  });

  it('moves to a version past the end, with some history above it', () => {
    expect(revealInVisibleRange(NEWEST_RANGE, 2024)).toEqual({
      from: 1984,
      to: 2024 + VISIBLE_RANGE_ROWS,
    });
  });

  it('moves when the version would sit against an edge of the range', () => {
    expect(revealInVisibleRange(NEWEST_RANGE, VISIBLE_RANGE_ROWS - 1).from).toBeGreaterThan(0);
    expect(revealInVisibleRange({ from: 500, to: 650 }, 500)).toEqual({ from: 460, to: 650 });
  });

  it('never starts before the newest version', () => {
    expect(revealInVisibleRange({ from: 500, to: 650 }, 10)).toEqual({ from: 0, to: 160 });
  });
});

describe('growing the range', () => {
  it('adds a step at either end, and stops at the newest version', () => {
    expect(showEarlierInVisibleRange(NEWEST_RANGE)).toEqual({
      from: 0,
      to: 150 + VISIBLE_RANGE_STEP,
    });
    expect(showNewerInVisibleRange({ from: 1000, to: 1150 })).toEqual({ from: 600, to: 1150 });
    expect(showNewerInVisibleRange({ from: 100, to: 250 })).toEqual({ from: 0, to: 250 });
  });
});

describe('clampVisibleRange', () => {
  it('cuts the range to the matches there are, and keeps one row when there are any', () => {
    expect(clampVisibleRange({ from: 0, to: 150 }, 12)).toEqual({ from: 0, to: 12 });
    expect(clampVisibleRange({ from: 900, to: 1050 }, 30)).toEqual({ from: 29, to: 30 });
    expect(clampVisibleRange({ from: 0, to: 150 }, 0)).toEqual({ from: 0, to: 0 });
  });
});
