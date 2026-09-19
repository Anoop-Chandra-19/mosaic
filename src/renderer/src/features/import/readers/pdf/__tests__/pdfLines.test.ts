import { describe, expect, it } from 'vitest';
import { markLink, type ImportLine } from '../../../parsing/importLines';
import type { PdfLink, PdfPage, PdfRule, PdfRun } from '../pdfModel';
import { pdfLines } from '../pdfLines';

/** Every character half an em wide, so a run's width follows from its text. */
const CHARACTER_WIDTH = 5;
const SIZE = 10;
const MARGIN = 540;

function run(text: string, x: number, y: number, more: Partial<PdfRun> = {}): PdfRun {
  return {
    text,
    x,
    y,
    width: text.length * CHARACTER_WIDTH,
    size: SIZE,
    bold: false,
    italic: false,
    font: 'Body',
    upright: true,
    ...more,
  };
}

const bold = (text: string, x: number, y: number) => run(text, x, y, { bold: true, font: 'Bold' });
const italic = (text: string, x: number, y: number) =>
  run(text, x, y, { italic: true, font: 'Italic' });
/** Text ending at the right margin. */
const right = (text: string, y: number, more: Partial<PdfRun> = {}) =>
  run(text, MARGIN - text.length * CHARACTER_WIDTH, y, more);
/** A line of text that fills the width from `x` to the margin. */
const full = (text: string, x: number, y: number) => run(text, x, y, { width: MARGIN - x });

const page = (runs: PdfRun[], links: PdfLink[] = [], rules: PdfRule[] = []): PdfPage => ({
  width: 612,
  height: 792,
  runs,
  links,
  rules,
});

const read = (...pages: PdfPage[]) => pdfLines({ pages, notes: [] });

/** Lines as role, text, and aside, for comparing. */
const shape = (lines: ImportLine[]) =>
  lines.map(({ role, text, aside }) => [role ?? '', text, ...(aside === undefined ? [] : [aside])]);

describe('pdfLines', () => {
  it('joins lines that wrapped, and not lines that ended short', () => {
    const { lines } = read(
      page([
        bold('Ada Lovelace', 250, 40),
        bold('Summary', 72, 80),
        full(
          'Builds analytical engines and writes the programs that run on them, from the',
          72,
          94
        ),
        run('first loop to the last.', 72, 108),
        run('Reads widely.', 72, 122),
        run('Writes letters.', 72, 136),
      ])
    );
    expect(shape(lines)).toEqual([
      ['', 'Ada Lovelace'],
      ['heading', 'Summary'],
      [
        '',
        'Builds analytical engines and writes the programs that run on them, from the first loop to the last.',
      ],
      ['', 'Reads widely.'],
      ['', 'Writes letters.'],
    ]);
  });

  it('keeps a hyphen that ends a wrapped line, with nothing after it', () => {
    const { lines } = read(
      page([
        bold('Experience', 72, 80),
        italic('Tutor', 72, 94),
        run('•', 90, 108),
        full('Taught a course that was entirely self-', 108, 108),
        run('taught.', 108, 122),
      ])
    );
    expect(shape(lines).at(-1)).toEqual([
      'bullet',
      'Taught a course that was entirely self-taught.',
    ]);
  });

  it('reads text set apart on the right as an aside, and a bullet with one as an entry', () => {
    const { lines } = read(
      page([
        bold('Education', 72, 80),
        italic('B.S. in Mathematics', 72, 94),
        right('1840', 94, { italic: true, font: 'Italic' }),
        run('• M.S. in Engines', 72, 108),
        right('1842', 108),
        right('1844', 122, { italic: true, font: 'Italic' }),
      ])
    );
    expect(shape(lines)).toEqual([
      ['heading', 'Education'],
      ['entry', 'B.S. in Mathematics', '1840'],
      ['entry', 'M.S. in Engines', '1842'],
      ['entry', '', '1844'],
    ]);
  });

  it('sets apart short text after a tab when it dates the line or ends at the margin', () => {
    const { lines } = read(
      page([
        bold('Experience', 72, 80),
        // A tab's width after the title: a date, but not a plain word, is set apart.
        bold('Analyst at Babbage & Co', 72, 94),
        italic('1842 to 1843', 72 + 23 * CHARACTER_WIDTH + 10, 94),
        run('•', 72, 108),
        run('Wrote the first program for the engine', 90, 108),
        right('Graduated', 108),
        run('Worked with', 72, 122),
        run('Babbage', 72 + 11 * CHARACTER_WIDTH + 10, 122),
      ])
    );
    expect(shape(lines).slice(1)).toEqual([
      ['entry', 'Analyst at Babbage & Co', '1842 to 1843'],
      ['entry', 'Wrote the first program for the engine', 'Graduated'],
      ['', 'Worked with Babbage'],
    ]);
  });

  it('takes a marker set far from its text, and one left at the foot of a page', () => {
    const { lines } = read(
      page([
        bold('Projects', 72, 80),
        italic('Note G', 72, 94),
        run('•', 72, 108),
        run('Computed Bernoulli numbers', 108, 108),
        run('•', 72, 760),
      ]),
      page([run('Ran on paper', 108, 40)])
    );
    expect(shape(lines).slice(2)).toEqual([
      ['bullet', 'Computed Bernoulli numbers'],
      ['bullet', 'Ran on paper'],
    ]);
  });

  it('reads bullets drawn as shapes by their indent', () => {
    const { lines } = read(
      page([
        bold('Experience', 72, 80),
        italic('Analyst at Babbage & Co', 72, 94),
        run('Wrote the first program', 90, 108),
        run('Corrected the tables', 90, 122),
      ])
    );
    expect(shape(lines)).toEqual([
      ['heading', 'Experience'],
      ['entry', 'Analyst at Babbage & Co'],
      ['bullet', 'Wrote the first program'],
      ['bullet', 'Corrected the tables'],
    ]);
  });

  it('reads two columns one after the other, and says the order is a guess', () => {
    const { lines, notes } = read(
      page([
        run('ada@example.com | 555-0100 | London', 150, 40),
        bold('Skills', 40, 100),
        run('Mathematics', 40, 114),
        run('Poetry', 40, 128),
        run('Engines', 40, 142),
        bold('Experience', 220, 100),
        italic('Analyst at Babbage & Co', 220, 121),
        run('• Wrote the first program', 220, 135),
        run('• Corrected the tables', 220, 149),
        bold('Education', 220, 177),
        italic('Tutored by De Morgan', 220, 191),
      ])
    );
    expect(lines.map((line) => line.text)).toEqual([
      'ada@example.com | 555-0100 | London',
      'Skills',
      'Mathematics',
      'Poetry',
      'Engines',
      'Experience',
      'Analyst at Babbage & Co',
      'Wrote the first program',
      'Corrected the tables',
      'Education',
      'Tutored by De Morgan',
    ]);
    expect(notes.map((note) => note.kind)).toEqual(['uncertain']);
  });

  it('does not take titles with dates beside them for two columns', () => {
    const titles = ['B.S. in Mathematics', 'M.S. in Engines', 'Tutored in Logic', 'Fellow'];
    const { lines, notes } = read(
      page([
        bold('Education', 72, 80),
        ...titles.flatMap((title, i) => [
          italic(title, 72, 94 + i * 14),
          right(`18${40 + i}`, 94 + i * 14, { italic: true, font: 'Italic' }),
        ]),
      ])
    );
    expect(notes).toEqual([]);
    expect(lines.slice(1).map((line) => [line.text, line.aside])).toEqual(
      titles.map((title, i) => [title, `18${40 + i}`])
    );
  });

  it('drops page numbers and a header repeated on every page, keeping the header once', () => {
    const onEachPage = (n: number, body: PdfRun[]) =>
      page([run('Ada Lovelace — Resume', 72, 30), ...body, run(`Page ${n} of 2`, 280, 770)]);
    const { lines } = read(
      onEachPage(1, [bold('Experience', 72, 80), italic('Analyst', 72, 94)]),
      onEachPage(2, [bold('Education', 72, 80), italic('Tutored', 72, 94)])
    );
    expect(lines.map((line) => line.text)).toEqual([
      'Ada Lovelace — Resume',
      'Experience',
      'Analyst',
      'Education',
      'Tutored',
    ]);
  });

  it('reads letter-spaced capitals as the heading they spell', () => {
    const { lines } = read(
      page([
        bold('Ada Lovelace', 250, 40),
        bold('W O R K   H I S T O R Y', 72, 80),
        run('Analyst', 72, 94),
      ])
    );
    expect(shape(lines).slice(1)).toEqual([
      ['heading', 'Work History'],
      ['', 'Analyst'],
    ]);
  });

  it('reads a section’s name with its content beside it as the heading, then the content', () => {
    const { lines } = read(
      page([
        bold('Ada Lovelace', 250, 40),
        bold('Skills', 72, 80),
        run('Mathematics, poetry, engines, and the tables that run them', 160, 80),
      ])
    );
    expect(shape(lines).slice(1)).toEqual([
      ['heading', 'Skills'],
      ['', 'Mathematics, poetry, engines, and the tables that run them'],
    ]);
  });

  it('marks linked words with their address', () => {
    // "ada@example.com | LinkedIn": each character is 5 points wide from x = 100.
    const at = (from: number, to: number) => ({ left: 100 + from * 5, right: 100 + to * 5 });
    const { lines } = read(
      page(
        [bold('Ada Lovelace', 100, 40), run('ada@example.com | LinkedIn', 100, 60)],
        [
          { url: 'mailto:ada@example.com', ...at(0, 15), top: 50, bottom: 63 },
          { url: 'https://linkedin.com/in/ada', ...at(18, 26), top: 50, bottom: 63 },
        ]
      )
    );
    expect(lines[1].text).toBe(
      `${markLink('ada@example.com', 'mailto:ada@example.com')} | ${markLink('LinkedIn', 'https://linkedin.com/in/ada')}`
    );
  });

  it('finds links underlined by a line under their words, not by a rule across the page', () => {
    const at = (from: number, to: number) => ({ left: 100 + from * 5, right: 100 + to * 5 });
    const runs = [bold('Ada Lovelace', 100, 40), run('ada@example.com | LinkedIn', 100, 60)];
    const links: PdfLink[] = [
      { url: 'mailto:ada@example.com', ...at(0, 15), top: 50, bottom: 63 },
      { url: 'https://linkedin.com/in/ada', ...at(18, 26), top: 50, bottom: 63 },
    ];
    // Just under the baseline at y = 60, as wide as the words.
    const under = (from: number, to: number): PdfRule => ({ ...at(from, to), top: 61, bottom: 62 });

    expect(read(page(runs, links, [under(0, 15), under(18, 26)])).linkStyle).toBe('underline');
    expect(read(page(runs, links)).linkStyle).toBe('plain');
    // A rule between sections sits under the line too, but runs across the page.
    const rule: PdfRule = { left: 72, right: 540, top: 61, bottom: 62 };
    expect(read(page(runs, links, [rule])).linkStyle).toBe('plain');
    // No links: nothing to go by.
    expect(read(page(runs)).linkStyle).toBeUndefined();
  });

  it('leaves out sideways text, and says so', () => {
    const { lines, leftOut, notes } = read(
      page([bold('Ada Lovelace', 250, 40), run('DRAFT', 20, 400, { upright: false })])
    );
    expect(lines.map((line) => line.text)).toEqual(['Ada Lovelace']);
    expect(leftOut).toEqual(['DRAFT']);
    expect(notes.map((note) => note.kind)).toEqual(['excluded']);
  });
});
