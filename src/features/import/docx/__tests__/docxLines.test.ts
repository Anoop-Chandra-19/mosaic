import { describe, expect, it } from 'vitest';
import { docxLines } from '../docxLines';
import type { DocxBlock, DocxDocument, DocxParagraph, DocxSource } from '../docxModel';
import type { ImportLine } from '../../importLines';

/**
 * These drive the interpreting half on made-up paragraphs, so a rule can be shown on its
 * own. `readDocx.test.ts` covers what real files hold, and `importDocx.test.ts` what the
 * two together make of a whole document.
 */

const source = (at: string, over: Partial<DocxSource> = {}): DocxSource => ({
  path: 'word/document.xml',
  part: 'body',
  at,
  ...over,
});

let next = 0;
function p(text: string, over: Partial<DocxParagraph> = {}): DocxParagraph {
  return {
    kind: 'paragraph',
    text,
    style: 'Normal',
    rightTab: false,
    bold: false,
    italic: false,
    caps: false,
    size: 22,
    spaceBefore: 0,
    source: source(`body/p[${++next}]`),
    ...over,
  };
}

const heading = (text: string) => p(text, { bold: true, size: 26 });
const bullet = (text: string) => p(text, { list: { id: '1', level: 0, marker: true } });

const linesOf = (blocks: DocxBlock[], notes: DocxDocument['notes'] = []) =>
  docxLines({ blocks, notes });

const roles = (lines: ImportLine[]) => lines.map((line) => [line.text, line.role ?? '-']);

describe('docxLines', () => {
  describe('headings', () => {
    it('reads a known section name as a heading, however it is set', () => {
      const { lines } = linesOf([p('Ada Lovelace'), p('Work History'), p('Analyst')]);
      expect(roles(lines)).toEqual([
        ['Ada Lovelace', '-'],
        ['Work History', 'heading'],
        ['Analyst', '-'],
      ]);
    });

    it('reads an unknown heading as one when the known headings are set the same way', () => {
      const { lines } = linesOf([
        p('Ada Lovelace'),
        heading('Work History'),
        p('Analyst'),
        heading('Speaking'),
        p('Talked about engines'),
      ]);
      expect(lines.filter((line) => line.role === 'heading').map((l) => l.text)).toEqual([
        'Work History',
        'Speaking',
      ]);
    });

    it('does not read bold entry titles as headings when most of them are not known names', () => {
      const { lines } = linesOf([
        p('Ada Lovelace'),
        heading('Work History'),
        heading('Babbage & Co'),
        bullet('Wrote the first program'),
        heading('Menabrea Ltd'),
        bullet('Translated the paper'),
        heading('Somerville Group'),
        bullet('Studied mathematics'),
      ]);
      expect(lines.filter((line) => line.role === 'heading').map((l) => l.text)).toEqual([
        'Work History',
      ]);
      expect(lines.filter((line) => line.role === 'entry').map((l) => l.text)).toEqual([
        'Babbage & Co',
        'Menabrea Ltd',
        'Somerville Group',
      ]);
    });

    it('keeps the first line of the document out of it, name or not', () => {
      const { lines } = linesOf([
        p('ADA LOVELACE', { bold: true, size: 40 }),
        heading('Work History'),
        p('Analyst'),
      ]);
      expect(lines[0].role).toBeUndefined();
    });

    it('falls back to outline levels when no heading names are known', () => {
      const { lines } = linesOf([
        p('Ada Lovelace', { style: 'Title', size: 56 }),
        p('Background', { style: 'Heading1', outline: 0, size: 32 }),
        p('Analyst at Babbage & Co', { style: 'Heading2', outline: 1 }),
        bullet('Wrote the first program'),
        p('Things I have made', { style: 'Heading1', outline: 0, size: 32 }),
        p('Note G', { style: 'Heading2', outline: 1 }),
      ]);
      expect(lines.filter((line) => line.role === 'heading').map((l) => l.text)).toEqual([
        'Background',
        'Things I have made',
      ]);
    });

    it('title-cases a heading typed in capitals, and leaves one set in capitals as written', () => {
      const typed = linesOf([p('Ada'), p('WORK HISTORY'), p('Analyst')]).lines;
      expect(typed[1]).toMatchObject({ text: 'Work History', role: 'heading' });
      const set = linesOf([p('Ada'), p('Work History', { caps: true }), p('Analyst')]).lines;
      expect(set[1]).toMatchObject({ text: 'Work History', role: 'heading' });
    });
  });

  describe('entries and bullets', () => {
    it('takes a list item as a bullet, and the line above it as an entry', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Work History'),
        p('Analyst at Babbage & Co', { italic: true }),
        bullet('Wrote the first program'),
      ]);
      expect(roles(lines).slice(2)).toEqual([
        ['Analyst at Babbage & Co', 'entry'],
        ['Wrote the first program', 'bullet'],
      ]);
    });

    it('starts a new entry on a line after bullets', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Work History'),
        p('Analyst', { italic: true }),
        bullet('Wrote the first program'),
        p('Assistant', { italic: true }),
        bullet('Read the paper'),
      ]);
      expect(lines.filter((l) => l.role === 'entry').map((l) => l.text)).toEqual([
        'Analyst',
        'Assistant',
      ]);
    });

    it('keeps two lines of one entry’s heading together when they are set differently', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Work History'),
        p('Babbage & Co\t1842', { bold: true, rightTab: true }),
        p('Analyst\tLondon', { italic: true, rightTab: true }),
        bullet('Wrote the first program'),
      ]);
      expect(roles(lines).slice(2)).toEqual([
        ['Babbage & Co', 'entry'],
        ['Analyst', '-'],
        ['Wrote the first program', 'bullet'],
      ]);
    });

    it('keeps lines set the same way as separate entries', () => {
      const dated = { rightTab: true, style: 'Heading3', outline: 2 };
      const { lines } = linesOf([
        p('Ada'),
        heading('Education'),
        p('M.S. in Mathematics\t1843', dated),
        p('B.E. in Engines\t1840', dated),
      ]);
      expect(lines.filter((l) => l.role === 'entry').map((l) => [l.text, l.aside])).toEqual([
        ['M.S. in Mathematics', '1843'],
        ['B.E. in Engines', '1840'],
      ]);
    });

    it('reads a bullet typed by hand, with a glyph or a symbol font', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Work History'),
        p('Analyst'),
        p('• Wrote the first program'),
        p('\tTranslated the paper'),
      ]);
      expect(roles(lines).slice(3)).toEqual([
        ['Wrote the first program', 'bullet'],
        ['Translated the paper', 'bullet'],
      ]);
    });
  });

  describe('text set out to the right', () => {
    const aside = (text: string, over: Partial<DocxParagraph> = {}) =>
      linesOf([p('Ada'), heading('Work History'), p(text, over)]).lines[2];

    it('is an aside after a right-aligned tab stop', () => {
      expect(aside('Analyst\t1842 to 1843', { rightTab: true })).toMatchObject({
        text: 'Analyst',
        aside: '1842 to 1843',
      });
    });

    it('is an aside after a run of spaces, or several tabs', () => {
      expect(aside('Analyst      1842')).toMatchObject({ text: 'Analyst', aside: '1842' });
      expect(aside('Analyst\t\t\t1842')).toMatchObject({ text: 'Analyst', aside: '1842' });
    });

    it('is an aside after one tab only when it reads as a date', () => {
      expect(aside('Analyst\tSeptember 1842')).toMatchObject({ aside: 'September 1842' });
      const kept = aside('Languages:\tPython, Go');
      expect(kept.text).toBe('Languages: Python, Go');
      expect(kept.aside).toBeUndefined();
    });

    it('is not an aside when the text on the right is long', () => {
      const long = 'a sentence that carries on well past the length of any date';
      expect(aside(`Analyst      ${long}`).aside).toBeUndefined();
    });

    it('turns a list item with a date on the right into an entry, not a bullet', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Education'),
        p('M.S. in Mathematics\t1843', {
          list: { id: '1', level: 0, marker: true },
          rightTab: true,
        }),
      ]);
      expect(lines[2]).toMatchObject({ text: 'M.S. in Mathematics', aside: '1843', role: 'entry' });
    });
  });

  describe('gaps', () => {
    it('comes from a blank paragraph, or from clear space above one', () => {
      const { lines } = linesOf([
        p('Ada'),
        heading('Work History'),
        p('Analyst'),
        p(''),
        p('Assistant'),
        p('Clerk', { spaceBefore: 240 }),
      ]);
      expect(lines.map((line) => line.gapBefore ?? false)).toEqual([
        false,
        false,
        false,
        true,
        true,
      ]);
    });
  });

  describe('tables', () => {
    const cell = (...paragraphs: DocxParagraph[]) => ({
      blocks: paragraphs,
      column: 0,
      span: 1,
      continued: false,
    });
    const rows = (...pairs: DocxParagraph[][][]) => ({
      kind: 'table' as const,
      rows: pairs.map((cells) => ({
        cells: cells.map((paragraphs, index) => ({ ...cell(...paragraphs), column: index })),
        columns: cells.length,
      })),
      source: source('body/tbl[1]'),
    });

    it('reads a title with its date in the cell beside it', () => {
      const table = rows(
        [[p('Analyst at Babbage & Co')], [p('1842 – 1843')]],
        [[p('Assistant at Somerville')], [p('1840 – 1842')]]
      );
      const { lines } = linesOf([p('Ada'), heading('Work History'), table]);
      expect(lines.slice(2).map((l) => [l.text, l.aside, l.role])).toEqual([
        ['Analyst at Babbage & Co', '1842 – 1843', 'entry'],
        ['Assistant at Somerville', '1840 – 1842', 'entry'],
      ]);
    });

    it('reads a heading with its content in the cell beside it', () => {
      const table = rows(
        [[p('Skills')], [p('Mathematics, notation, and the writing of programs')]],
        [[p('Work History')], [p('Analyst at Babbage & Co, where the engine was built')]]
      );
      const { lines } = linesOf([p('Ada Lovelace'), table]);
      expect(roles(lines)).toEqual([
        ['Ada Lovelace', '-'],
        ['Skills', 'heading'],
        ['Mathematics, notation, and the writing of programs', '-'],
        ['Work History', 'heading'],
        ['Analyst at Babbage & Co, where the engine was built', '-'],
      ]);
    });

    it('keeps the content of a label table whose labels are not section names', () => {
      const table = rows(
        [[p('Languages')], [p('English, French, and a little German')]],
        [[p('Notation')], [p('The writing of operations as tables')]]
      );
      const { lines } = linesOf([p('Ada'), heading('Skills'), table]);
      // No heading among them, so the content stays as plain lines under Skills.
      expect(lines.filter((l) => l.role === 'heading').map((l) => l.text)).toEqual(['Skills']);
      expect(lines.map((l) => l.text)).toContain('English, French, and a little German');
    });

    it('reads a heading and its content however short the content is', () => {
      // The two sides' lengths say nothing here; the known section names do.
      for (const [skills, experience] of [
        ['Go', 'Engineer'],
        ['Go and Rust', 'Engineer at Acme'],
        ['Mathematics, notation, and the writing of programs', 'Analyst at Babbage & Co, London'],
      ]) {
        const table = rows([[p('Skills')], [p(skills)]], [[p('Experience')], [p(experience)]]);
        const { lines } = linesOf([p('Ada Lovelace'), table]);
        expect(roles(lines), skills).toEqual([
          ['Ada Lovelace', '-'],
          ['Skills', 'heading'],
          [skills, '-'],
          ['Experience', 'heading'],
          [experience, '-'],
        ]);
      }
    });

    it('reads down each column of a table of several rows, not across its rows', () => {
      const table = rows(
        [[heading('Skills')], [heading('Work History')]],
        [[p('Mathematics and notation')], [p('Analyst at Babbage & Co')]],
        [[p('French and German')], [p('Assistant at Somerville')]]
      );
      const { lines, notes } = linesOf([p('Ada Lovelace'), table]);
      expect(lines.map((l) => l.text)).toEqual([
        'Ada Lovelace',
        'Skills',
        'Mathematics and notation',
        'French and German',
        'Work History',
        'Analyst at Babbage & Co',
        'Assistant at Somerville',
      ]);
      expect(notes[0].message).toContain('the first column, then the next');
    });

    it('falls back to reading row by row when a row spans the columns, and says so', () => {
      const table = {
        kind: 'table' as const,
        rows: [
          {
            cells: [{ blocks: [heading('Work History')], column: 0, span: 2, continued: false }],
            columns: 2,
          },
          {
            cells: [
              { blocks: [p('Analyst at Babbage & Co')], column: 0, span: 1, continued: false },
              { blocks: [p('Assistant at Somerville')], column: 1, span: 1, continued: false },
            ],
            columns: 2,
          },
        ],
        source: source('body/tbl[1]'),
      };
      const { lines, notes } = linesOf([p('Ada Lovelace'), table]);
      expect(lines.map((l) => l.text)).toEqual([
        'Ada Lovelace',
        'Work History',
        'Analyst at Babbage & Co',
        'Assistant at Somerville',
      ]);
      expect(notes[0].message).toContain('row by row');
    });

    it('reads two independent columns one after the other, and says the order is a guess', () => {
      const table = rows([
        [heading('Skills'), p('Mathematics, notation, and the writing of programs')],
        [heading('Work History'), p('Analyst at Babbage & Co, where the engine was built')],
      ]);
      const { lines, notes } = linesOf([p('Ada Lovelace'), table]);
      expect(lines.map((l) => l.text)).toEqual([
        'Ada Lovelace',
        'Skills',
        'Mathematics, notation, and the writing of programs',
        'Work History',
        'Analyst at Babbage & Co, where the engine was built',
      ]);
      expect(notes).toContainEqual(
        expect.objectContaining({ kind: 'uncertain', message: expect.stringContaining('columns') })
      );
    });

    it('leaves a row that spans the width as a line of its own', () => {
      const table = {
        kind: 'table' as const,
        rows: [
          {
            cells: [{ blocks: [heading('Work History')], column: 0, span: 2, continued: false }],
            columns: 2,
          },
          {
            cells: [
              { blocks: [p('Analyst')], column: 0, span: 1, continued: false },
              { blocks: [p('1842')], column: 1, span: 1, continued: false },
            ],
            columns: 2,
          },
        ],
        source: source('body/tbl[1]'),
      };
      const { lines } = linesOf([p('Ada'), table]);
      expect(roles(lines)).toEqual([
        ['Ada', '-'],
        ['Work History', 'heading'],
        ['Analyst', 'entry'],
      ]);
      expect(lines[2].aside).toBe('1842');
    });
  });

  describe('page headers and footers', () => {
    const headerLine = (text: string) =>
      p(text, { source: source('header/p[1]', { part: 'header' }) });
    const footerLine = (text: string) =>
      p(text, { source: source('footer/p[1]', { part: 'footer' }) });

    it('keeps a header’s lines, which often hold the name and contact details', () => {
      const { lines } = linesOf([
        headerLine('ada@example.com'),
        p('Ada Lovelace'),
        heading('Work History'),
        p('Analyst'),
      ]);
      expect(lines.map((l) => l.text)).toEqual([
        'ada@example.com',
        'Ada Lovelace',
        'Work History',
        'Analyst',
      ]);
    });

    it('keeps what a repeated header line says that the body does not', () => {
      const { lines } = linesOf([
        { ...headerLine('Ada Lovelace\tada@example.com'), rightTab: true },
        p('Ada Lovelace'),
        heading('Skills'),
        p('Go'),
      ]);
      expect(lines.map((l) => [l.text, l.aside])).toEqual([
        ['ada@example.com', undefined],
        ['Ada Lovelace', undefined],
        ['Skills', undefined],
        ['Go', undefined],
      ]);
    });

    it('drops a header line the body already says, and page numbers', () => {
      const { lines, leftOut } = linesOf([
        headerLine('Ada Lovelace'),
        headerLine('Page 1 of 2'),
        p('Ada Lovelace'),
        heading('Work History'),
      ]);
      expect(lines.map((l) => l.text)).toEqual(['Ada Lovelace', 'Work History']);
      expect(leftOut).toEqual([]);
    });

    it('leaves a footer’s text out of the resume, but shows it as left out', () => {
      const { lines, leftOut } = linesOf([
        p('Ada Lovelace'),
        heading('Work History'),
        footerLine('References available on request'),
        footerLine('2'),
      ]);
      expect(lines.map((l) => l.text)).toEqual(['Ada Lovelace', 'Work History']);
      expect(leftOut).toEqual(['References available on request']);
    });
  });

  it('says so when a text box holds some of the file', () => {
    const { notes } = linesOf([
      p('Ada Lovelace'),
      p('Boxed', { source: source('body/p[1]/txbx[1]/p[1]', { floating: true }) }),
    ]);
    expect(notes).toContainEqual(
      expect.objectContaining({ kind: 'uncertain', message: expect.stringContaining('text box') })
    );
  });

  it('passes on what the reading of the file already noted', () => {
    const { notes } = linesOf([p('Ada')], [{ kind: 'unreadable', message: 'A picture.' }]);
    expect(notes[0]).toMatchObject({ message: 'A picture.' });
  });

  it('says where each line came from, down to the cell it was in', () => {
    const table = {
      kind: 'table' as const,
      rows: [
        {
          cells: [
            {
              blocks: [p('Analyst', { source: source('body/tbl[1]/tr[1]/tc[1]/p[1]') })],
              column: 0,
              span: 1,
              continued: false,
            },
            {
              blocks: [p('1842', { source: source('body/tbl[1]/tr[1]/tc[2]/p[1]') })],
              column: 1,
              span: 1,
              continued: false,
            },
          ],
          columns: 2,
        },
      ],
      source: source('body/tbl[1]'),
    };
    const { lines } = linesOf([p('Ada'), heading('Work History'), table]);
    expect(lines[2].origin).toBe('word/document.xml body/tbl[1]/tr[1]/tc[1]/p[1]');
  });
});
