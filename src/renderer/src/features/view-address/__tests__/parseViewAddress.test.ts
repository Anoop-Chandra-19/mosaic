import { describe, expect, it } from 'vitest';
import { formatViewAddress } from '../formatViewAddress';
import { looksLikeViewAddress, parseViewAddress } from '../parseViewAddress';
import type { ViewPlace } from '../viewPlace';

const PLACES: [ViewPlace, string][] = [
  [{ kind: 'start' }, 'start'],
  [{ kind: 'editor', template: 'Base resume' }, 'editor / Base resume'],
  [
    { kind: 'editor', template: 'Base resume', dialog: 'nameVersion' },
    'editor / Base resume + name version',
  ],
  [{ kind: 'history', template: 'Tailored for Kestrel' }, 'history / Tailored for Kestrel'],
  [
    {
      kind: 'history',
      template: 'Tailored for Kestrel',
      version: 'v12',
      base: 'v11',
      reading: 'changes',
    },
    'history / Tailored for Kestrel / v12 vs v11 / changes',
  ],
  [
    { kind: 'history', template: 'Sales / Ops', version: 'v3.1', base: 'draft', reading: 'page' },
    'history / Sales / Ops / v3.1 vs draft / page',
  ],
  [{ kind: 'history', template: 'Base resume', version: 'v1' }, 'history / Base resume / v1'],
  [{ kind: 'review', template: 'Base resume' }, 'review / Base resume'],
  [
    { kind: 'review', template: 'Base resume', suggestion: 4 },
    'review / Base resume / suggestion 4',
  ],
  [{ kind: 'settings', section: 'history' }, 'settings / history'],
  [{ kind: 'tour', tour: 'gettingStarted', step: 3 }, 'tour / getting started / step 3'],
];

describe('view addresses', () => {
  it('read back to the view they were written from', () => {
    for (const [place, address] of PLACES) {
      expect(formatViewAddress(place)).toBe(address);
      expect(parseViewAddress(address)).toEqual({ place: expect.objectContaining(place) });
    }
  });

  it('read typed ones loosely: any case, a tour from its first step', () => {
    expect(parseViewAddress('  History / Base resume  /  V12 VS Draft / Changes ')).toEqual({
      place: {
        kind: 'history',
        template: 'Base resume',
        version: 'v12',
        base: 'draft',
        reading: 'changes',
      },
    });
    expect(parseViewAddress('tour / history')).toEqual({
      place: { kind: 'tour', tour: 'history', step: 1 },
    });
    expect(parseViewAddress('settings / Appearance')).toEqual({
      place: { kind: 'settings', section: 'appearance' },
    });
  });

  it('say which part can’t be read', () => {
    const errors: [string, RegExp][] = [
      ['histry / Base resume', /starts with start, editor/],
      ['editor', /names its template/],
      ['editor / Base resume + print', /No dialog called “print”/],
      ['history / Base resume / changes', /Name a version before/],
      ['settings / colours', /No Settings section called “colours”/],
      ['tour / onboarding', /No tour called “onboarding”/],
      ['tour / history / third', /as a step/],
      ['start / now', /only “start”/],
    ];
    for (const [address, error] of errors) {
      expect(parseViewAddress(address)).toEqual({ error: expect.stringMatching(error) });
    }
  });

  it('are told from a search by their first part', () => {
    expect(looksLikeViewAddress('history / Base resume')).toBe(true);
    expect(looksLikeViewAddress('history')).toBe(false);
    expect(looksLikeViewAddress('start screen')).toBe(false);
  });
});
