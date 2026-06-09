import { describe, expect, it } from 'vitest';
import { migrateTemplateState } from '../migrateTemplateState';
import type { PersistedTemplateState } from '@/types/vault';
import type { ResumeData, TemplateVersion } from '@/types/resume';

function createSnapshot(schemaVersion = 1): ResumeData {
  return {
    schemaVersion,
    contact: {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      location: 'Detroit, MI',
      linkedin: '',
      github: '',
      website: '',
    },
    sections: [],
  };
}

function createVersion(
  templateId: string,
  id: string,
  snapshot: ResumeData = createSnapshot()
): TemplateVersion {
  return {
    id,
    templateId,
    parentVersionId: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    message: 'Initial save',
    source: 'save-new',
    snapshot,
  };
}

function createState(): PersistedTemplateState {
  return {
    templates: [
      {
        id: 'tmpl-1',
        name: 'Default',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        headVersionId: 'v1',
      },
    ],
    versionsByTemplateId: {
      'tmpl-1': [createVersion('tmpl-1', 'v1')],
    },
    activeTemplateId: 'tmpl-1',
    activeVersionId: 'v1',
  };
}

describe('migrateTemplateState', () => {
  it('passes well-formed state through unchanged', () => {
    const state = createState();
    expect(migrateTemplateState(state)).toEqual(state);
  });

  it('migrates outdated version snapshots to the current schema', () => {
    const state = createState();
    state.versionsByTemplateId['tmpl-1'] = [createVersion('tmpl-1', 'v1', createSnapshot(0))];

    const migrated = migrateTemplateState(state);
    expect(migrated.versionsByTemplateId['tmpl-1'][0].snapshot.schemaVersion).toBe(1);
  });

  it('returns empty defaults for garbage input', () => {
    for (const input of [undefined, null, 42, 'junk', []]) {
      expect(migrateTemplateState(input)).toEqual({
        templates: [],
        versionsByTemplateId: {},
        activeTemplateId: null,
        activeVersionId: null,
      });
    }
  });

  it('nulls both active ids when activeTemplateId points at a missing template', () => {
    const state = createState();
    state.activeTemplateId = 'gone';

    const migrated = migrateTemplateState(state);
    expect(migrated.activeTemplateId).toBeNull();
    expect(migrated.activeVersionId).toBeNull();
  });

  it('falls back to headVersionId when activeVersionId is dangling', () => {
    const state = createState();
    state.activeVersionId = 'gone';

    const migrated = migrateTemplateState(state);
    expect(migrated.activeTemplateId).toBe('tmpl-1');
    expect(migrated.activeVersionId).toBe('v1');
  });

  it('drops non-array version lists instead of crashing', () => {
    const state = createState() as unknown as Record<string, unknown>;
    state.versionsByTemplateId = { 'tmpl-1': 'corrupt' };

    const migrated = migrateTemplateState(state);
    expect(migrated.versionsByTemplateId).toEqual({});
  });
});
