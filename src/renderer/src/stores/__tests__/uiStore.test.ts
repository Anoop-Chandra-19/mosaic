import { describe, expect, it, vi } from 'vitest';

// The store's settings storage is the window's; only the pure helper is under test here.
vi.mock('@/lib/storage/settingsStorage', () => ({ settingsStorage: {} }));

const { AGENT_PANE_WIDTH, clampPaneWidth, nextPreviewZoomStep, PREVIEW_ZOOM_STEPS, SIDEBAR_WIDTH } =
  await import('../uiStore');

describe('pane widths', () => {
  it('keeps a width within the pane’s limits, in whole pixels', () => {
    expect(clampPaneWidth(412.6, SIDEBAR_WIDTH)).toBe(413);
    expect(clampPaneWidth(120, SIDEBAR_WIDTH)).toBe(SIDEBAR_WIDTH.minPx);
    expect(clampPaneWidth(5000, AGENT_PANE_WIDTH)).toBe(AGENT_PANE_WIDTH.maxPx);
    expect(clampPaneWidth(Number.NaN, SIDEBAR_WIDTH)).toBe(SIDEBAR_WIDTH.defaultPx);
  });
});

describe('preview zoom steps', () => {
  const first = PREVIEW_ZOOM_STEPS[0];
  const last = PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1];

  it('steps to the next one past where the wheel left the zoom', () => {
    expect(nextPreviewZoomStep(1, 1)).toBe(1.15);
    expect(nextPreviewZoomStep(1, -1)).toBe(0.9);
    // Between two steps, whichever way it is going.
    expect(nextPreviewZoomStep(1.07, 1)).toBe(1.15);
    expect(nextPreviewZoomStep(1.07, -1)).toBe(1);
  });

  it('stops at each end', () => {
    expect(nextPreviewZoomStep(last, 1)).toBeUndefined();
    expect(nextPreviewZoomStep(first, -1)).toBeUndefined();
    // Below the smallest step, stepping up still lands on a step.
    expect(nextPreviewZoomStep(0.5, 1)).toBe(first);
  });
});
