import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import { CURRENT_SCHEMA_VERSION } from '@/lib/resume/migrateResume';
import { parseBundle } from '../parseBundle';

function createBundle(): Record<string, unknown> {
  const doc = createDefaultResume();
  return {
    bundleVersion: 2,
    exportedAt: '2026-09-12T12:00:00.000Z',
    templates: [
      {
        template: {
          id: 't1',
          name: 'Backend CV',
          rev: 2,
          createdAt: '2026-09-01T10:00:00.000Z',
          updatedAt: '2026-09-12T11:00:00.000Z',
        },
        draft: doc,
        versions: [
          {
            id: 'v1',
            parentId: null,
            kind: 'auto',
            source: 'create',
            summary: 'Created',
            rev: 0,
            createdAt: '2026-09-01T10:00:00.000Z',
            doc,
          },
          {
            id: 'v2',
            parentId: 'v1',
            kind: 'named',
            source: 'name',
            summary: 'Sent to Fastly',
            rev: 2,
            createdAt: '2026-09-12T11:00:00.000Z',
            doc,
          },
        ],
      },
    ],
  };
}

type RawTemplate = { template: Record<string, unknown>; versions: Record<string, unknown>[] };
const templatesOf = (bundle: Record<string, unknown>) => bundle.templates as RawTemplate[];

function parse(bundle: unknown) {
  return parseBundle(JSON.stringify(bundle));
}

describe('parseBundle', () => {
  it('accepts a well-formed bundle', () => {
    const result = parse(createBundle());
    expect(result).toEqual({ ok: true, bundle: createBundle() });
  });

  it('rejects files that are not JSON or not a bundle', () => {
    expect(parseBundle('{')).toEqual({ ok: false, code: 'invalid-json' });
    expect(parse({ hello: 'world' })).toEqual({ ok: false, code: 'not-a-bundle' });
    // A v1 vault backup from the browser build.
    expect(parse({ vaultVersion: 1, resume: {}, templates: {} })).toEqual({
      ok: false,
      code: 'not-a-bundle',
    });
  });

  it('refuses bundles and documents written by a newer Mosaic', () => {
    expect(parse({ ...createBundle(), bundleVersion: 3 })).toEqual({
      ok: false,
      code: 'unsupported-version',
    });

    const bundle = createBundle();
    templatesOf(bundle)[0].versions[0].doc = {
      ...createDefaultResume(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    };
    expect(parse(bundle)).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('rejects a malformed draft or version document', () => {
    const bundle = createBundle();
    (bundle.templates as Record<string, unknown>[])[0].draft = { schemaVersion: 1 };
    expect(parse(bundle)).toMatchObject({ ok: false, code: 'invalid-resume' });
  });

  it('rejects templates without history or with repeated ids', () => {
    const empty = createBundle();
    templatesOf(empty)[0].versions = [];
    expect(parse(empty)).toMatchObject({ ok: false, code: 'invalid-templates' });

    const repeated = createBundle();
    templatesOf(repeated)[0].versions[1].id = 'v1';
    expect(parse(repeated)).toMatchObject({ ok: false, code: 'invalid-templates' });

    expect(parse({ ...createBundle(), templates: [] })).toMatchObject({
      ok: false,
      code: 'invalid-templates',
    });
  });

  it('rejects unknown version kinds, bad revs, and bad dates', () => {
    const cases: Array<(bundle: Record<string, unknown>) => void> = [
      (b) => (templatesOf(b)[0].versions[0].kind = 'draft'),
      (b) => (templatesOf(b)[0].versions[0].source = 'telepathy'),
      (b) => (templatesOf(b)[0].versions[0].rev = -1),
      (b) => (templatesOf(b)[0].template.rev = 1.5),
      (b) => (templatesOf(b)[0].template.createdAt = 'yesterday'),
    ];
    for (const breakIt of cases) {
      const bundle = createBundle();
      breakIt(bundle);
      expect(parse(bundle)).toMatchObject({ ok: false, code: 'invalid-templates' });
    }
  });

  it('unlinks a parent that is not an earlier version of the same template', () => {
    const bundle = createBundle();
    templatesOf(bundle)[0].versions[0].parentId = 'v2';
    templatesOf(bundle)[0].versions[1].parentId = 'somewhere-else';

    const result = parse(bundle);
    expect(result.ok && result.bundle.templates[0].versions.map((v) => v.parentId)).toEqual([
      null,
      null,
    ]);
  });
});
