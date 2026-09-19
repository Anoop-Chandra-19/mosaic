import { describe, expect, it, vi } from 'vitest';

// The store's settings storage is the window's; only the pure helper is under test here.
vi.mock('@/lib/storage/settingsStorage', () => ({ settingsStorage: {} }));

const { AGENT_PANE_WIDTH, clampPaneWidth, SIDEBAR_WIDTH } = await import('../uiStore');

describe('pane widths', () => {
  it('keeps a width within the pane’s limits, in whole pixels', () => {
    expect(clampPaneWidth(412.6, SIDEBAR_WIDTH)).toBe(413);
    expect(clampPaneWidth(120, SIDEBAR_WIDTH)).toBe(SIDEBAR_WIDTH.minPx);
    expect(clampPaneWidth(5000, AGENT_PANE_WIDTH)).toBe(AGENT_PANE_WIDTH.maxPx);
    expect(clampPaneWidth(Number.NaN, SIDEBAR_WIDTH)).toBe(SIDEBAR_WIDTH.defaultPx);
  });
});
