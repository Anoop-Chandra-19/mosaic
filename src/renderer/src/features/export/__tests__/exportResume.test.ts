import { describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { createDocxExport } from '../docx/createDocxExport';
import { renderResumePdf } from '../pdf/renderResumePdf';
import { renderExport } from '../exportResume';
import { normalizeResumeForExport } from '../normalizeResumeExport';

vi.mock('@/stores/resumeStore', () => ({ saveDraftOrStop: vi.fn() }));
vi.mock('../pdf/renderResumePdf', () => ({
  renderResumePdf: vi.fn(async () => new Uint8Array()),
}));
vi.mock('../docx/createDocxExport', () => ({
  createDocxExport: vi.fn(async () => new Uint8Array()),
}));

function createExportSource() {
  return { doc: createDefaultResume(), templateId: null };
}

describe('renderExport appearance options', () => {
  it.each(['pdf', 'docx'] as const)(
    'applies local link and paper overrides to %s without changing the source',
    async (format) => {
      const source = createExportSource();
      const originalResume = structuredClone(source.doc);
      const headerLinks = { linkStyle: 'underline', linkColor: 'blue' } as const;
      const expected = normalizeResumeForExport(source.doc);
      expected.contact = { ...expected.contact, ...headerLinks };

      await renderExport(format, source, { paperSize: 'letter', headerLinks });

      if (format === 'pdf') {
        expect(renderResumePdf).toHaveBeenLastCalledWith({ data: expected, paperSize: 'letter' });
      } else {
        expect(createDocxExport).toHaveBeenLastCalledWith(expected, 'letter');
      }
      expect(source.doc).toEqual(originalResume);
    }
  );

  it.each(['pdf', 'docx'] as const)(
    'uses the source link appearance for %s when no override is supplied',
    async (format) => {
      const source = createExportSource();
      source.doc.contact.header.linkStyle = 'underline';
      source.doc.contact.header.linkColor = 'blue';
      const expected = normalizeResumeForExport(source.doc);

      await renderExport(format, source, { paperSize: 'a4' });

      if (format === 'pdf') {
        expect(renderResumePdf).toHaveBeenLastCalledWith({ data: expected, paperSize: 'a4' });
      } else {
        expect(createDocxExport).toHaveBeenLastCalledWith(expected, 'a4');
      }
    }
  );

  it('does not carry PDF/Word overrides into JSON Resume', async () => {
    const source = createExportSource();
    const options = { paperSize: 'a4' } as const;
    const withoutOverrides = await renderExport('json-resume', source, options);
    const withOverrides = await renderExport('json-resume', source, {
      ...options,
      headerLinks: { linkStyle: 'underline', linkColor: 'blue' },
    });

    expect(withOverrides).toBe(withoutOverrides);
    expect(source.doc.contact.header.linkStyle).toBe('plain');
    expect(source.doc.contact.header.linkColor).toBeUndefined();
  });
});
