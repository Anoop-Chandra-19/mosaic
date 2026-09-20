import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { normalizeResumeForExport } from '../../normalizeResumeExport';
import { createDocxExport } from '../createDocxExport';
import { openZip } from '@/features/import/readers/docx/openZip';
import { readDocx } from '@/features/import/readers/docx/readDocx';
import {
  createStyledHeaderResume,
  entry,
  everything,
  resume,
  section,
  shown,
} from '@/features/import/__tests__/resumeFixtures';

const exportedDocx = (data: ResumeData, paperSize: 'letter' | 'a4' = 'letter') =>
  createDocxExport(normalizeResumeForExport(data), paperSize);

async function partOf(bytes: Uint8Array, path: string): Promise<string> {
  const part = await openZip(bytes).read(path);
  return new TextDecoder().decode(part!);
}

/** A resume long enough to run onto more pages, with bullets that wrap. */
function longResume(): ResumeData {
  const bullet = (n: number) =>
    `Wrote program ${n} for the analytical engine, checking every step of it by hand against tables computed the long way.`;
  return resume([
    section(
      'experience',
      'entries',
      'Work History',
      Array.from({ length: 8 }, (_, i) =>
        entry({
          title: 'Analyst',
          organization: `Engine Works ${i + 1}`,
          location: 'London, UK',
          dates: `18${40 + i} to 18${41 + i}`,
          bullets: Array.from({ length: 5 }, (_, j) => bullet(i * 5 + j)),
        })
      )
    ),
  ]);
}

describe('createDocxExport', () => {
  it('reads back as the resume it was made from', async () => {
    for (const data of [createDefaultResume(), everything(), longResume()]) {
      for (const paperSize of ['letter', 'a4'] as const) {
        const parsed = await readDocx(await exportedDocx(data, paperSize));
        expect(shown(parsed.resume)).toEqual(shown(data));
        expect(parsed.warnings).toEqual([]);
        expect(parsed.leftOut).toEqual([]);
      }
    }
  });

  it('gives back a header’s links, separators, alignment, underlining, and blue', async () => {
    const data = createStyledHeaderResume();
    expect(shown((await readDocx(await exportedDocx(data))).resume)).toEqual(shown(data));

    const plain = createStyledHeaderResume();
    plain.contact.header.linkStyle = 'plain';
    delete plain.contact.header.linkColor;
    expect(shown((await readDocx(await exportedDocx(plain))).resume)).toEqual(shown(plain));
  });

  it('sets the page as the PDF does: paper, margins, and the right tab at the margin', async () => {
    const letter = await exportedDocx(createDefaultResume(), 'letter');
    expect(await partOf(letter, 'word/document.xml')).toContain(
      '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="1440" w:bottom="1359" w:left="1440"'
    );
    expect(await partOf(letter, 'word/styles.xml')).toContain(
      '<w:tab w:val="right" w:pos="9360"/>'
    );

    const a4 = await exportedDocx(createDefaultResume(), 'a4');
    expect(await partOf(a4, 'word/document.xml')).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(await partOf(a4, 'word/styles.xml')).toContain('<w:tab w:val="right" w:pos="9026"/>');
  });

  it('writes any text as text, never as markup', async () => {
    const data = resume([
      section('skills', 'lines', 'Tools & <Tricks>', [
        entry({ text: 'C++ & "quotes" <b>not bold</b>\u0007' }),
      ]),
    ]);
    data.contact.name = 'Ada <Lovelace> & Co';
    const bytes = await exportedDocx(data);
    const document = await partOf(bytes, 'word/document.xml');
    expect(document).toContain('Ada &lt;Lovelace&gt; &amp; Co');
    expect(document).not.toContain('<b>');

    const parsed = await readDocx(bytes);
    expect(parsed.resume.contact.name).toBe('Ada <Lovelace> & Co');
    expect(shown(parsed.resume).sections).toEqual([
      {
        layout: 'lines',
        label: 'Tools & <Tricks>',
        entries: [{ heading: '', dates: '', text: 'C++ & "quotes" <b>not bold</b>', bullets: [] }],
      },
    ]);
  });

  it('zips the same resume to the same bytes', async () => {
    const data = everything();
    expect(await exportedDocx(data)).toEqual(await exportedDocx(data));
  });
});
