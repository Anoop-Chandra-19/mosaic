import { describe, expect, it, vi } from 'vitest';

// The store's settings storage is the window's; here it keeps nothing.
vi.mock('@/lib/storage/settingsStorage', () => ({
  settingsStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));

const {
  AGENT_PANE_WIDTH,
  clampPaneWidth,
  DEFAULT_INTERFACE,
  nextPreviewZoomStep,
  PREVIEW_ZOOM_STEPS,
  SIDEBAR_WIDTH,
  useUiStore,
} = await import('../uiStore');

describe('resetting the interface', () => {
  it('puts the chrome back and keeps the preferences', () => {
    const ui = useUiStore.getState();
    ui.setTheme('light');
    ui.setSidebarWidthPx(500);
    ui.toggleSidebarCollapsed();
    ui.setPaperSize('letter');
    ui.setOpenOnLaunch('start');
    ui.setUndoHistorySteps(500);
    ui.markTourSeen();

    useUiStore.getState().resetInterface();

    const after = useUiStore.getState();
    expect(after.theme).toBe(DEFAULT_INTERFACE.theme);
    expect(after.sidebarWidthPx).toBe(DEFAULT_INTERFACE.sidebarWidthPx);
    expect(after.sidebarCollapsed).toBe(false);
    expect(after).toMatchObject({
      paperSize: 'letter',
      openOnLaunch: 'start',
      undoHistorySteps: 500,
      hasSeenTour: true,
    });
  });
});

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
