import { describe, expect, it } from 'vitest';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';
import { resolveViewPlace, type ViewLookup } from '../resolveViewPlace';

function version(id: string, number: number, revision = 0): VersionMeta {
  return {
    id,
    templateId: 'kestrel',
    number,
    revision,
    parentId: null,
    kind: 'auto',
    source: 'edit',
    summary: '',
    section: null,
    rev: number,
    createdAt: number,
  };
}

/** Newest first: v12.1, v12, v11. */
const HISTORY = [version('v12.1', 12, 1), version('v12', 12), version('v11', 11)];

function template(id: string, name: string): TemplateSummary {
  return {
    id,
    name,
    rev: 1,
    createdAt: 1,
    updatedAt: 1,
    versionCount: HISTORY.length,
    head: HISTORY[0],
  };
}

const LOOKUP: ViewLookup = {
  templates: [
    template('kestrel', 'Tailored for Kestrel'),
    template('harbor-1', 'Harbor Freight Labs'),
    template('harbor-2', 'Harbor Freight Labs'),
  ],
  readVersions: async () => HISTORY,
  listSuggestionIds: () => ['first', 'second'],
};

describe('resolveViewPlace', () => {
  it('finds the version and the comparison its base means', async () => {
    const history = { kind: 'history', template: 'tailored for kestrel' } as const;
    expect(await resolveViewPlace({ ...history, version: 'v12.1', base: 'v12' }, LOOKUP)).toEqual({
      resolved: {
        kind: 'history',
        templateId: 'kestrel',
        versionId: 'v12.1',
        comparison: 'parent',
      },
    });
    expect(await resolveViewPlace({ ...history, version: 'v12.1', base: 'v11' }, LOOKUP)).toEqual({
      resolved: {
        kind: 'history',
        templateId: 'kestrel',
        versionId: 'v12.1',
        comparison: 'number',
      },
    });
    expect(await resolveViewPlace({ ...history, version: 'v12', base: 'draft' }, LOOKUP)).toEqual({
      resolved: { kind: 'history', templateId: 'kestrel', versionId: 'v12', comparison: 'draft' },
    });
  });

  it('says which part doesn’t exist', async () => {
    const history = { kind: 'history', template: 'Tailored for Kestrel' } as const;
    expect(await resolveViewPlace({ ...history, version: 'v40' }, LOOKUP)).toEqual({
      error: '“Tailored for Kestrel” has no v40, the newest v12.1.',
    });
    expect(await resolveViewPlace({ ...history, version: 'v12', base: 'v9' }, LOOKUP)).toEqual({
      error: 'v12 is compared with v11 or draft, not v9.',
    });
    expect(await resolveViewPlace({ kind: 'editor', template: 'Northwind' }, LOOKUP)).toEqual({
      error: 'No template named “Northwind”.',
    });
    expect(
      await resolveViewPlace(
        { kind: 'review', template: 'Tailored for Kestrel', suggestion: 3 },
        LOOKUP
      )
    ).toEqual({
      error: '“Tailored for Kestrel” has 2 suggestions waiting, so no suggestion 3.',
    });
    expect(await resolveViewPlace({ kind: 'tour', tour: 'history', step: 8 }, LOOKUP)).toEqual({
      error: 'The history tour has 7 steps.',
    });
  });

  it('hands back templates that share a name, and takes the one chosen', async () => {
    const place = { kind: 'editor', template: 'Harbor Freight Labs' } as const;
    const shared = await resolveViewPlace(place, LOOKUP);
    expect('sameName' in shared && shared.sameName.map(({ id }) => id)).toEqual([
      'harbor-1',
      'harbor-2',
    ]);
    expect(await resolveViewPlace(place, LOOKUP, 'harbor-2')).toEqual({
      resolved: { kind: 'editor', templateId: 'harbor-2', dialog: undefined },
    });
  });
});
