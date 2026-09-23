import { describe, expect, it } from 'vitest';
import {
  clampHistoryWindow,
  NEWEST_WINDOW,
  revealInHistoryWindow,
  showEarlierInHistoryWindow,
  showNewerInHistoryWindow,
  WINDOW_ROWS,
  WINDOW_STEP,
} from '../moveHistoryWindow';

describe('revealInHistoryWindow', () => {
  it('leaves the window alone when the version is already well inside it', () => {
    expect(revealInHistoryWindow(NEWEST_WINDOW, 0)).toBe(NEWEST_WINDOW);
    expect(revealInHistoryWindow(NEWEST_WINDOW, 100)).toBe(NEWEST_WINDOW);
  });

  it('moves to a version past the end, with some history above it', () => {
    expect(revealInHistoryWindow(NEWEST_WINDOW, 2024)).toEqual({
      from: 1984,
      to: 2024 + WINDOW_ROWS,
    });
  });

  it('moves when the version would sit against an edge of the window', () => {
    expect(revealInHistoryWindow(NEWEST_WINDOW, WINDOW_ROWS - 1).from).toBeGreaterThan(0);
    expect(revealInHistoryWindow({ from: 500, to: 650 }, 500)).toEqual({ from: 460, to: 650 });
  });

  it('never starts before the newest version', () => {
    expect(revealInHistoryWindow({ from: 500, to: 650 }, 10)).toEqual({ from: 0, to: 160 });
  });
});

describe('growing the window', () => {
  it('adds a step at either end, and stops at the newest version', () => {
    expect(showEarlierInHistoryWindow(NEWEST_WINDOW)).toEqual({ from: 0, to: 150 + WINDOW_STEP });
    expect(showNewerInHistoryWindow({ from: 1000, to: 1150 })).toEqual({ from: 600, to: 1150 });
    expect(showNewerInHistoryWindow({ from: 100, to: 250 })).toEqual({ from: 0, to: 250 });
  });
});

describe('clampHistoryWindow', () => {
  it('cuts the window to the matches there are, and keeps one row when there are any', () => {
    expect(clampHistoryWindow({ from: 0, to: 150 }, 12)).toEqual({ from: 0, to: 12 });
    expect(clampHistoryWindow({ from: 900, to: 1050 }, 30)).toEqual({ from: 29, to: 30 });
    expect(clampHistoryWindow({ from: 0, to: 150 }, 0)).toEqual({ from: 0, to: 0 });
  });
});
