import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { goToPlace, showPlace } from '../showPlace';

const EXPORT = { kind: 'export', version: null } as const;
const exportOn = (templateId: string) => ({ kind: 'editor', templateId, dialog: EXPORT }) as const;

/** Opening a template only moves which one is open; the stores' own tests cover the rest. */
const openTemplate = vi.fn(async (templateId: string) => {
  useResumeStore.setState({ templateId });
});

beforeEach(() => {
  openTemplate.mockClear();
  useTemplateStore.setState({ openTemplate });
  useResumeStore.setState({ templateId: 'harbor' });
  useOverlayStore.setState({ surface: null, settingsSection: null, dialog: null, tour: null });
});

const overlay = () => useOverlayStore.getState();

describe('showPlace', () => {
  it('opens the dialog on the open template without opening it again', async () => {
    await showPlace(exportOn('harbor'));
    expect(openTemplate).not.toHaveBeenCalled();
    expect(overlay().dialog).toEqual({ request: EXPORT, isOpen: true });
  });

  it('opens another template first, and leaves a tour underneath to come back', async () => {
    overlay().startTour('gettingStarted');
    await showPlace(exportOn('lantern'));
    expect(openTemplate).toHaveBeenCalledWith('lantern');
    expect(overlay().dialog?.request).toEqual(EXPORT);
    expect(overlay().tour?.kind).toBe('gettingStarted');
  });

  it('opens nothing when the template can’t be opened', async () => {
    openTemplate.mockRejectedValueOnce(new Error('gone'));
    await expect(showPlace(exportOn('lantern'))).rejects.toThrow('gone');
    expect(overlay().dialog).toBeNull();
  });
});

describe('goToPlace', () => {
  it('clears what covers the app, opens the template, then the place', async () => {
    overlay().startTour('gettingStarted');
    overlay().openSettings('ai');
    overlay().openSurface({ kind: 'start' });
    await goToPlace({ kind: 'review', templateId: 'lantern', proposalId: 'p3' });
    expect(openTemplate).toHaveBeenCalledWith('lantern');
    expect(overlay()).toMatchObject({
      surface: { kind: 'review', proposalId: 'p3' },
      settingsSection: null,
      tour: null,
    });
  });
});
