import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '../../resume/defaultResume';
import type { BundleVersion, MosaicBundle } from '../../types/bundle';
import type { ResumeData } from '../../types/resume';
import { formatBundle, formatBundleText } from '../formatBundle';
import { parseBundle } from '../parseBundle';

const resumeNamed = (name: string): ResumeData => {
  const doc = createDefaultResume();
  return { ...doc, contact: { ...doc.contact, name } };
};

const version = (id: string, doc: ResumeData): BundleVersion => ({
  id,
  parentId: null,
  kind: 'auto',
  source: 'edit',
  summary: `Version ${id}`,
  section: null,
  rev: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  doc,
});

/** Two templates whose versions repeat documents, as a long history does. */
function createBundle(): MosaicBundle {
  const template = (id: string) => ({
    id,
    name: `CV ${id}`,
    rev: 3,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
  });
  return {
    exportedAt: '2026-09-12T12:00:00.000Z',
    templates: [
      {
        template: template('t1'),
        draft: resumeNamed('A'),
        versions: [version('v1', resumeNamed('A')), version('v2', resumeNamed('B'))],
      },
      {
        template: template('t2'),
        draft: resumeNamed('B'),
        versions: [version('v3', resumeNamed('B')), version('v4', resumeNamed('A'))],
      },
    ],
  };
}

describe('formatBundle', () => {
  it('writes each distinct document once, however many drafts and versions hold it', () => {
    const file = JSON.parse(formatBundleText(createBundle()));
    expect(Object.keys(file.docs)).toEqual(['doc-1', 'doc-2']);
    expect(file.templates[0].draftDocId).toBe('doc-1');
    expect(file.templates[1].versions.map((v: { docId: string }) => v.docId)).toEqual([
      'doc-2',
      'doc-1',
    ]);
  });

  it('reads back as it was written', () => {
    const bundle = createBundle();
    expect(parseBundle(formatBundleText(bundle))).toEqual({ ok: true, bundle });
  });

  it('writes a template or a document at a time, and indents the whole file', () => {
    const pieces = [...formatBundle(createBundle())];
    // The opening, two templates, the turn to the documents, two documents, the close.
    expect(pieces).toHaveLength(7);
    const text = pieces.join('');
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it('writes an empty bundle as valid JSON', () => {
    const text = formatBundleText({ exportedAt: '', templates: [] });
    expect(JSON.parse(text)).toEqual({ bundleVersion: 3, exportedAt: '', templates: [], docs: {} });
  });
});
