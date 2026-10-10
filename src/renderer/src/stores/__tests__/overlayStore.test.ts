import { beforeEach, describe, expect, it } from 'vitest';
import { selectTourStep, useOverlayStore } from '../overlayStore';

const overlay = () => useOverlayStore.getState();

describe('dialogs', () => {
  beforeEach(() => useOverlayStore.setState({ dialog: null }));

  it('shows one dialog at a time: opening one replaces another', () => {
    overlay().openDialog({ kind: 'export', version: null });
    overlay().openDialog({ kind: 'import', asNewOnly: true });
    expect(overlay().dialog).toEqual({
      request: { kind: 'import', asNewOnly: true },
      isOpen: true,
    });
  });

  it('a closed dialog keeps its request, so it animates out unchanged', () => {
    overlay().openDialog({ kind: 'shortcuts', place: 'history' });
    overlay().closeDialog('shortcuts');
    expect(overlay().dialog).toEqual({
      request: { kind: 'shortcuts', place: 'history' },
      isOpen: false,
    });
  });

  it('closes a dialog only by its own kind', () => {
    overlay().openDialog({ kind: 'nameVersion' });
    overlay().closeDialog('export');
    expect(overlay().dialog?.isOpen).toBe(true);
  });
});

describe('tours', () => {
  beforeEach(() => useOverlayStore.setState({ tour: null, surface: null }));

  it('runs one tour at a time: starting one replaces another', () => {
    overlay().startTour('gettingStarted');
    overlay().setTourStep(3);
    overlay().startTour('history');
    expect(overlay().tour).toEqual({ kind: 'history', step: 0 });
    expect(selectTourStep('gettingStarted')(overlay())).toBeNull();
  });

  it('ends a tour only by its own kind', () => {
    overlay().startTour('gettingStarted');
    overlay().endTour('history');
    expect(overlay().tour?.kind).toBe('gettingStarted');
    overlay().endTour('gettingStarted');
    expect(overlay().tour).toBeNull();
  });

  it('closing the full history ends the history tour, and leaves the first-run tour', () => {
    overlay().openSurface({ kind: 'history', templateId: 't1' });
    overlay().startTour('history');
    overlay().closeSurface('history');
    expect(overlay().tour).toBeNull();

    overlay().openSurface({ kind: 'history', templateId: 't1' });
    overlay().startTour('gettingStarted');
    overlay().closeSurface('history');
    expect(overlay().tour?.kind).toBe('gettingStarted');
  });
});
