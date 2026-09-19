import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paragraphsOf } from '../docxModel';
import { openZip } from '../openZip';
import {
  decodeXml,
  descendantsNamed,
  isElement,
  parseXml,
  textOf,
  type XmlElement,
} from '../parseXml';
import { formatEntryHeading } from '@shared/resume/entryHeading';
import { readDocx, readDocxContent } from '../readDocx';
import { replaceMarkedLinksWithText } from '../../../parsing/importLines';
import type { ParsedResume } from '../../../parsing/parseResume';
import { cell, docx, para, picture, run, table, textBox } from './buildDocx';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Every word the file's own XML holds, whatever the reader made of it. Runs join without a
 * space — Word splits a word across runs as it pleases — and a tab or break separates them.
 */
function xmlText(element: XmlElement): string {
  let text = '';
  for (const child of element.children) {
    if (!isElement(child)) continue;
    if (child.ns === W && child.name === 't') text += textOf(child);
    else if (child.ns === W && ['tab', 'br', 'cr'].includes(child.name)) text += ' ';
    else text += xmlText(child);
  }
  return text;
}

/** Each word in some text, and how many times it appears there. */
function wordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.split(/[\s|]+/)) {
    if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

async function wordsInFile(bytes: Uint8Array): Promise<Map<string, number>> {
  const part = await openZip(bytes).read('word/document.xml');
  const paragraphs = descendantsNamed(parseXml(decodeXml(part!)), W, 'p');
  return wordCounts(paragraphs.map(xmlText).join('\n'));
}

/** Words the file holds more often than `text` does — as whole words, not parts of them. */
function missingFrom(text: string, inFile: Map<string, number>, ignore?: RegExp): string[] {
  const found = wordCounts(text);
  return [...inFile]
    .filter(([word, count]) => !ignore?.test(word) && (found.get(word) ?? 0) < count)
    .map(([word]) => word);
}

/** Whole documents, from the file to the resume the review step would show. */

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./documents/${name}`, import.meta.url)));

const shape = ({ resume }: ParsedResume) =>
  resume.sections.map((section) => ({
    label: section.label,
    kind: section.kind,
    layout: section.layout,
    items: section.items.map((item) =>
      [formatEntryHeading(item), item.dates, item.text, ...item.bullets.map((b) => b.text)]
        .filter(Boolean)
        .join(' | ')
    ),
  }));

/** Each header line's items as kind, text, and link. */
const headerOf = ({ resume }: ParsedResume) =>
  resume.contact.header.lines.map((line) =>
    line.items.map(({ kind, text, url }) => [kind, text, url])
  );

/** Both documents' header: how to reach Ada, then a status and where she is. */
const headerWith = (status: string) => [
  [
    ['phone', '555-0100', ''],
    ['email', 'ada@example.com', ''],
    ['linkedin', 'LinkedIn', 'https://linkedin.com/in/ada'],
  ],
  [
    ['auth', status, ''],
    ['location', 'London, UK', ''],
  ],
];

/** Every word a document holds, as often as it holds it, to check none goes missing unsaid. */
function unaccounted(parsed: ParsedResume, inFile: Map<string, number>): string[] {
  const { name, header } = parsed.resume.contact;
  const placed = [
    name,
    ...header.lines.flatMap((line) => line.items.flatMap((item) => [item.text, item.url])),
    ...parsed.resume.sections.flatMap((section) => [
      section.label,
      ...section.items.flatMap((item) => [
        // As it prints: the commas between its parts are words' commas in the file.
        formatEntryHeading(item),
        item.dates ?? '',
        item.text ?? '',
        ...item.bullets.map((bullet) => bullet.text),
      ]),
    ]),
    ...parsed.leftOut,
    ...parsed.warnings,
  ].join('\n');
  return missingFrom(placed, inFile);
}

/** Every word the reader took out of the file, as often as the file holds it. */
async function unread(bytes: Uint8Array): Promise<string[]> {
  const read = paragraphsOf((await readDocxContent(bytes)).blocks)
    .map((p) => replaceMarkedLinksWithText(p.text))
    .join('\n');
  return missingFrom(read, await wordsInFile(bytes));
}

describe('a Word file that LibreOffice wrote', () => {
  it('comes in as the resume it is', async () => {
    const parsed = await readDocx(fixture('libreoffice-resume.docx'));
    expect(parsed.resume.contact.name).toBe('Ada Lovelace');
    expect(headerOf(parsed)).toEqual(headerWith('British subject'));
    expect(shape(parsed)).toEqual([
      {
        label: 'Summary',
        kind: 'summary',
        layout: 'lines',
        items: ['Mathematician who writes programs for engines that do not exist yet.'],
      },
      {
        label: 'Work History',
        kind: 'experience',
        layout: 'entries',
        items: [
          'Analyst at Babbage & Co | 1842 to 1843 | Wrote the first published algorithm. | Corresponded on the Analytical Engine.',
        ],
      },
      {
        label: 'Education',
        kind: 'education',
        layout: 'entries',
        items: ['Tutored in mathematics, London | 1829', 'Studied under Augustus De Morgan | 1840'],
      },
      {
        label: 'Skills',
        kind: 'skills',
        layout: 'lines',
        items: ['Mathematics: analysis, algebra, notation'],
      },
    ]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.leftOut).toEqual([]);
  });

  it('places every word the file holds, or says where it went', async () => {
    const bytes = fixture('libreoffice-resume.docx');
    expect(unaccounted(await readDocx(bytes), await wordsInFile(bytes))).toEqual([]);
  });

  it('reads every word out of the file to begin with', async () => {
    expect(await unread(fixture('libreoffice-resume.docx'))).toEqual([]);
  });
});

describe('a Word file that Word wrote', () => {
  it('comes in as the resume it is, headings, dates and all', async () => {
    const parsed = await readDocx(fixture('word-resume.docx'));
    expect(parsed.resume.contact.name).toBe('Ada Lovelace');
    expect(headerOf(parsed)).toEqual(
      headerWith('British subject, work authorized through July 1845')
    );
    const sections = shape(parsed);
    expect(sections.map((s) => [s.label, s.kind, s.layout, s.items.length])).toEqual([
      ['Education & Certificates', 'education', 'entries', 2],
      ['Work History', 'experience', 'entries', 1],
      ['Projects', 'projects', 'entries', 1],
    ]);
    // List items with a date after a right-aligned tab stop are entries, not bullets.
    expect(sections[0].items[0]).toBe(
      'M.S. in Analytical Mathematics from the University of London in London, UK | 1843'
    );
    // A date pushed right with a run of spaces.
    expect(sections[1].items[0]).toContain(
      'Analyst at Babbage & Co, Remote | September 1842 to Current'
    );
    expect(parsed.warnings).toEqual([]);
    expect(parsed.leftOut).toEqual([]);
  });

  it('places every word the file holds, or says where it went', async () => {
    const bytes = fixture('word-resume.docx');
    expect(unaccounted(await readDocx(bytes), await wordsInFile(bytes))).toEqual([]);
  });

  it('reads every word out of the file to begin with', async () => {
    expect(await unread(fixture('word-resume.docx'))).toEqual([]);
  });
});

describe('what a strange document still gives up', () => {
  it('keeps the content of a file whose layout says nothing, as plain lines', async () => {
    const body = [
      para('Ada Lovelace'),
      para('ada@example.com'),
      para('Work History'),
      para('Analyst at Babbage & Co'),
      para('Wrote the first published algorithm'),
      para('Translated a paper about the engine'),
    ].join('');
    const parsed = await readDocx(await docx(body, { bare: true }));
    expect(parsed.resume.contact.name).toBe('Ada Lovelace');
    expect(shape(parsed)).toEqual([
      {
        label: 'Work History',
        kind: 'experience',
        layout: 'lines',
        items: [
          'Analyst at Babbage & Co',
          'Wrote the first published algorithm',
          'Translated a paper about the engine',
        ],
      },
    ]);
  });

  it('says what it could not read, and still reads the rest', async () => {
    const body = [
      para('Ada Lovelace'),
      para('Work History', { bold: true }),
      para([run('Analyst'), picture()]),
      para('Wrote the first program', { list: 1 }),
      para([run(''), textBox(para('A note in a box'))]),
    ].join('');
    const parsed = await readDocx(await docx(body));
    expect(parsed.resume.sections[0].items[0].title).toBe('Analyst');
    expect(parsed.warnings).toEqual([
      expect.stringContaining('a picture'),
      expect.stringContaining('text box'),
    ]);
    expect(
      parsed.resume.sections.flatMap((s) => s.items.map((i) => i.text ?? i.title ?? ''))
    ).toContain('A note in a box');
  });

  it('reads a table whose cells claim more columns than any table has', async () => {
    const left = [
      para('Skills', { bold: true }),
      para('Mathematics, notation, and the writing of programs'),
    ].join('');
    const right = [
      para('Work History', { bold: true }),
      para('Analyst at Babbage & Co, where the first program was written'),
    ].join('');
    for (const span of [4294967296, 2_000_000_000]) {
      const body = [para('Ada Lovelace'), table([[cell(left, { span }), right]])].join('');
      const parsed = await readDocx(await docx(body));
      expect(parsed.resume.sections.map((s) => s.label)).toEqual(['Skills', 'Work History']);
    }
  });

  it('reads a resume laid out in two columns, and says the order is a guess', async () => {
    const left = [
      para('Skills', { bold: true }),
      para('Mathematics, notation, and the writing of programs'),
    ].join('');
    const right = [
      para('Work History', { bold: true }),
      para('Analyst at Babbage & Co, where the first program was written'),
    ].join('');
    const parsed = await readDocx(
      await docx([para('Ada Lovelace'), table([[left, right]])].join(''))
    );
    expect(parsed.resume.sections.map((s) => s.label)).toEqual(['Skills', 'Work History']);
    expect(parsed.warnings).toEqual([expect.stringContaining('columns')]);
  });
});
