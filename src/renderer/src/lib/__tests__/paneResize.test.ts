import { describe, expect, it } from 'vitest';
import { clampPaneWidth, type PaneWidthLimits } from '../paneResize';

const LIMITS: PaneWidthLimits = { defaultPx: 380, minPx: 300, maxPx: 600, maxShare: 0.42 };

describe('clampPaneWidth', () => {
  it('keeps a width within the pane’s limits, in whole pixels', () => {
    expect(clampPaneWidth(412.6, LIMITS)).toBe(413);
    expect(clampPaneWidth(120, LIMITS)).toBe(LIMITS.minPx);
    expect(clampPaneWidth(5000, LIMITS)).toBe(LIMITS.maxPx);
    expect(clampPaneWidth(Number.NaN, LIMITS)).toBe(LIMITS.defaultPx);
  });
});
