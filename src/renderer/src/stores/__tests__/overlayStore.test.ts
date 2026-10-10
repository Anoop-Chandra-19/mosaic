import { beforeEach, describe, expect, it } from 'vitest';
import { selectTourStep, useOverlayStore } from '../overlayStore';

const overlay = () => useOverlayStore.getState();

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
