import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import { createMarkdownExport } from '@/features/export/markdown';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { markdownToText } from '../markdownToText';
import { parseResumeText } from '../parseResumeText';

describe('markdownToText', () => {
  it('drops heading marks, emphasis, rules, and escapes', () => {
    expect(
      markdownToText(
        ['# Ada Lovelace', '', '## Experience ##', '***', '**Analyst** at *Babbage \\& Co*'].join(
          '\n'
        )
      )
    ).toBe(['Ada Lovelace', '', 'Experience', '', 'Analyst at Babbage & Co'].join('\n'));
  });

  it('keeps list markers, so bullets stay bullets', () => {
    expect(markdownToText('- Led the migration\n* Cut costs')).toBe(
      '- Led the migration\n* Cut costs'
    );
  });

  it('keeps a link’s text and address', () => {
    expect(markdownToText('[Portfolio](https://ada.dev) · [ada.dev](https://ada.dev)')).toBe(
      'Portfolio https://ada.dev · https://ada.dev'
    );
  });

  it('reads Mosaic’s own Markdown export back into the same sections', () => {
    const resume = createDefaultResume();
    // Headings the parser knows; "Education & Certificates" is a label it does not.
    for (const section of resume.sections) {
      if (section.kind !== 'custom') section.label = SECTION_PRESETS[section.kind].label;
    }
    const exported = normalizeResumeForExport(resume);
    const markdown = createMarkdownExport(exported);

    const { resume: imported } = parseResumeText(markdownToText(markdown));

    expect(imported.contact.name).toBe(exported.contact.name);
    const shape = (s: { kind: string; layout: string; label: string }) => [
      s.kind,
      s.layout,
      s.label,
    ];
    expect(imported.sections.map(shape)).toEqual(exported.sections.map(shape));
    const bullets = (sections: { items: { bullets: unknown[] }[] }[]) =>
      sections.flatMap((s) => s.items.flatMap((i) => i.bullets)).length;
    expect(bullets(imported.sections)).toBe(
      exported.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).length
    );
    expect(bullets(imported.sections)).toBeGreaterThan(0);
  });
});
