import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '../../resume/defaultResume';
import { CURRENT_SCHEMA_VERSION } from '../../resume/migrateResume';
import type { MosaicBundle } from '../../types/bundle';
import { parseBundle } from '../parseBundle';

const TEMPLATE = {
  id: 't1',
  name: 'Backend CV',
  rev: 2,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-12T11:00:00.000Z',
};
const V1 = {
  id: 'v1',
  parentId: null,
  kind: 'auto',
  source: 'create',
  summary: 'Created',
  section: null,
  rev: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
};
const V2 = {
  id: 'v2',
  parentId: 'v1',
  kind: 'named',
  source: 'name',
  summary: 'Sent to Fastly',
  section: null,
  rev: 2,
  createdAt: '2026-09-12T11:00:00.000Z',
};

/** A backup file as written: the draft and both versions name one document. */
function createFile(): Record<string, unknown> {
  return {
    bundleVersion: 3,
    exportedAt: '2026-09-12T12:00:00.000Z',
    templates: [
      {
        template: { ...TEMPLATE },
        draftDocId: 'doc-1',
        versions: [
          { ...V1, docId: 'doc-1' },
          { ...V2, docId: 'doc-1' },
        ],
      },
    ],
    docs: { 'doc-1': createDefaultResume() },
  };
}

type RawTemplate = { template: Record<string, unknown>; versions: Record<string, unknown>[] };
const templatesOf = (file: Record<string, unknown>) => file.templates as RawTemplate[];
const docsOf = (file: Record<string, unknown>) => file.docs as Record<string, unknown>;

function parse(file: unknown) {
  return parseBundle(JSON.stringify(file));
}

describe('parseBundle', () => {
  it('reads a backup, each version holding its document', () => {
    const doc = createDefaultResume();
    const expected = {
      exportedAt: '2026-09-12T12:00:00.000Z',
      templates: [
        {
          template: TEMPLATE,
          draft: doc,
          versions: [
            { ...V1, doc },
            { ...V2, doc },
          ],
        },
      ],
    } as MosaicBundle;
    expect(parse(createFile())).toEqual({ ok: true, bundle: expected });
  });

  it('reads a document once, however many versions name it', () => {
    const result = parse(createFile());
    if (!result.ok) throw new Error(result.code);
    const [template] = result.bundle.templates;
    expect(template.versions[0].doc).toBe(template.draft);
    expect(template.versions[1].doc).toBe(template.draft);
  });

  it('keeps a snapshot’s section and where it was taken, and reads a missing section as none', () => {
    const file = createFile();
    const [v1, v2] = templatesOf(file)[0].versions;
    Object.assign(v1, { source: 'edit', section: 'Experience' });
    Object.assign(v2, { kind: 'auto', source: 'closed' });
    delete v2.section;

    const result = parse(file);
    if (!result.ok) throw new Error(result.code);
    const [first, second] = result.bundle.templates[0].versions;
    expect(first).toMatchObject({ source: 'edit', section: 'Experience' });
    expect(second).toMatchObject({ source: 'closed', section: null });
  });

  it('rejects files that are not JSON or not a bundle', () => {
    expect(parseBundle('{')).toEqual({ ok: false, code: 'invalid-json' });
    expect(parse({ hello: 'world' })).toEqual({ ok: false, code: 'not-a-bundle' });
    // A v1 vault backup from the browser build.
    expect(parse({ vaultVersion: 1, resume: {}, templates: {} })).toEqual({
      ok: false,
      code: 'not-a-bundle',
    });
    expect(parse({ ...createFile(), bundleVersion: 2 })).toEqual({
      ok: false,
      code: 'not-a-bundle',
    });
  });

  it('refuses bundles and documents written by a newer Mosaic', () => {
    expect(parse({ ...createFile(), bundleVersion: 4 })).toEqual({
      ok: false,
      code: 'unsupported-version',
    });

    const file = createFile();
    docsOf(file)['doc-1'] = { ...createDefaultResume(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(parse(file)).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('rejects a malformed document', () => {
    const file = createFile();
    docsOf(file)['doc-1'] = { schemaVersion: 1 };
    expect(parse(file)).toMatchObject({ ok: false, code: 'invalid-resume' });
  });

  it('rejects a draft or version naming a document the file doesn’t have', () => {
    const version = createFile();
    templatesOf(version)[0].versions[1].docId = 'doc-2';
    expect(parse(version)).toMatchObject({ ok: false, code: 'invalid-templates' });

    const draft = createFile();
    delete (templatesOf(draft)[0] as Record<string, unknown>).draftDocId;
    expect(parse(draft)).toMatchObject({ ok: false, code: 'invalid-templates' });

    const inherited = createFile();
    templatesOf(inherited)[0].versions[0].docId = 'toString';
    expect(parse(inherited)).toMatchObject({ ok: false, code: 'invalid-templates' });

    expect(parse({ ...createFile(), docs: undefined })).toMatchObject({
      ok: false,
      code: 'invalid-templates',
    });
  });

  it('rejects templates without history or with repeated ids', () => {
    const empty = createFile();
    templatesOf(empty)[0].versions = [];
    expect(parse(empty)).toMatchObject({ ok: false, code: 'invalid-templates' });

    const repeated = createFile();
    templatesOf(repeated)[0].versions[1].id = 'v1';
    expect(parse(repeated)).toMatchObject({ ok: false, code: 'invalid-templates' });

    expect(parse({ ...createFile(), templates: [] })).toMatchObject({
      ok: false,
      code: 'invalid-templates',
    });
  });

  it('rejects IDs and names that main would refuse later', () => {
    for (const bad of ['', '   ', 'x'.repeat(201)]) {
      const cases: Array<(file: Record<string, unknown>) => void> = [
        (f) => (templatesOf(f)[0].template.id = bad),
        (f) => (templatesOf(f)[0].template.name = bad),
        (f) => (templatesOf(f)[0].versions[1].id = bad),
      ];
      for (const breakIt of cases) {
        const file = createFile();
        breakIt(file);
        expect(parse(file)).toMatchObject({ ok: false, code: 'invalid-templates' });
      }
    }
  });

  it('rejects a section order that can’t be written back out', () => {
    const text = JSON.stringify(createFile()).replace('"order":0', '"order":1e999');
    expect(parseBundle(text)).toMatchObject({ ok: false, code: 'invalid-resume' });
  });

  it('rejects unknown version kinds, bad revs, and bad dates', () => {
    const cases: Array<(file: Record<string, unknown>) => void> = [
      (f) => (templatesOf(f)[0].versions[0].kind = 'draft'),
      (f) => (templatesOf(f)[0].versions[0].source = 'telepathy'),
      (f) => (templatesOf(f)[0].versions[0].rev = -1),
      (f) => (templatesOf(f)[0].template.rev = 1.5),
      (f) => (templatesOf(f)[0].template.createdAt = 'yesterday'),
    ];
    for (const breakIt of cases) {
      const file = createFile();
      breakIt(file);
      expect(parse(file)).toMatchObject({ ok: false, code: 'invalid-templates' });
    }
  });

  it('unlinks a parent that is not an earlier version of the same template', () => {
    const file = createFile();
    templatesOf(file)[0].versions[0].parentId = 'v2';
    templatesOf(file)[0].versions[1].parentId = 'somewhere-else';

    const result = parse(file);
    expect(result.ok && result.bundle.templates[0].versions.map((v) => v.parentId)).toEqual([
      null,
      null,
    ]);
  });
});
