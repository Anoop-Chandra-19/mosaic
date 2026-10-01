import { describe, expect, it } from 'vitest';
import {
  MAX_PREVIEW_PAGES,
  normalizeSections,
  paginateSections,
  type PaginationMeasurements,
} from '../pagination';
import type { PreviewRenderableSection } from '../PreviewSection';
import type { ResumeSection } from '@shared/types/resume';

function createMeasurements(
  overrides: Partial<PaginationMeasurements> = {}
): PaginationMeasurements {
  return {
    headerHeight: 0,
    sectionTitleHeights: {},
    entryHeights: {},
    entryHeadingHeights: {},
    bulletHeights: {},
    lineStarts: {},
    ...overrides,
  };
}

function createBullets(...texts: string[]) {
  return texts.map((text) => ({ id: text, text }));
}

function createExperienceSection(
  entries: PreviewRenderableSection['entries']
): PreviewRenderableSection {
  return {
    id: 'experience',
    layout: 'entries',
    label: 'Experience',
    entries,
  };
}

describe('normalizeSections', () => {
  it('sorts sections and excludes unselected or empty entries', () => {
    const sections: ResumeSection[] = [
      {
        id: 'experience',
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        order: 2,
        items: [
          {
            id: 'job-1',
            selected: true,
            title: ' Engineer ',
            organization: ' Mosaic ',
            dates: ' 2024 ',
            bullets: [
              { id: 'b1', text: ' Built export flow ', selected: true },
              { id: 'b2', text: ' Hidden bullet ', selected: false },
            ],
          },
          {
            id: 'job-2',
            selected: false,
            title: 'Hidden',
            bullets: [{ id: 'b3', text: 'Hidden', selected: true }],
          },
        ],
      },
      {
        id: 'summary',
        kind: 'summary',
        layout: 'lines',
        label: 'Summary',
        order: 1,
        items: [
          { id: 'summary-1', selected: true, text: '  Focused builder.  ', bullets: [] },
          { id: 'summary-2', selected: true, text: '   ', bullets: [] },
        ],
      },
    ];

    expect(normalizeSections(sections)).toEqual([
      {
        id: 'summary',
        layout: 'lines',
        label: 'Summary',
        entries: [
          { id: 'summary-1', text: 'Focused builder.', bullets: [], _sourceKey: 'summary-1' },
        ],
      },
      {
        id: 'experience',
        layout: 'entries',
        label: 'Experience',
        entries: [
          {
            id: 'job-1',
            heading: 'Engineer, Mosaic',
            dates: '2024',
            bullets: [{ id: 'b1', text: 'Built export flow' }],
            _sourceKey: 'job-1',
          },
        ],
      },
    ]);
  });
});

describe('paginateSections', () => {
  it('returns one empty page for empty content', () => {
    expect(paginateSections([], createMeasurements(), 100)).toEqual([[]]);
  });

  it('keeps entries on one page when they fit', () => {
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', heading: 'Engineer 1', bullets: createBullets('A') },
          { id: 'job-2', heading: 'Engineer 2', bullets: createBullets('B') },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: {
          'experience::job-1': 40,
          'experience::job-2': 40,
        },
      }),
      130
    );

    expect(pages).toHaveLength(1);
    expect(pages[0][0].entries.map((entry) => entry.id)).toEqual(['job-1', 'job-2']);
  });

  it('moves entries to later pages when the current page cannot fit them', () => {
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', heading: 'Engineer 1', bullets: createBullets('A') },
          { id: 'job-2', heading: 'Engineer 2', bullets: createBullets('B') },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: {
          'experience::job-1': 40,
          'experience::job-2': 40,
        },
      }),
      90
    );

    expect(pages).toHaveLength(2);
    expect(pages[0][0].entries.map((entry) => entry.id)).toEqual(['job-1']);
    expect(pages[1][0].entries.map((entry) => entry.id)).toEqual(['job-2-cont-0']);
  });

  it('moves an entry with no bullets to the next page whole, rather than losing it', () => {
    const degrees = ['edu-1', 'edu-2', 'edu-3'];
    const pages = paginateSections(
      [
        {
          id: 'education',
          layout: 'entries',
          label: 'Education',
          entries: degrees.map((id) => ({ id, heading: id, dates: '2025', bullets: [] })),
        },
      ],
      createMeasurements({
        sectionTitleHeights: { education: 18 },
        entryHeights: Object.fromEntries(degrees.map((id) => [`education::${id}`, 18])),
      }),
      // A blank line, the title, and two degrees fill the page.
      72
    );

    expect(pages.map((page) => page[0].entries.map((entry) => entry.heading))).toEqual([
      ['edu-1', 'edu-2'],
      ['edu-3'],
    ]);
  });

  it('reserves room for the header on the first page only', () => {
    const jobs = ['job-1', 'job-2', 'job-3', 'job-4'];
    const pages = paginateSections(
      [
        createExperienceSection(
          jobs.map((id) => ({ id, heading: id, bullets: createBullets('A') }))
        ),
      ],
      createMeasurements({
        headerHeight: 70,
        sectionTitleHeights: { experience: 10 },
        entryHeights: Object.fromEntries(jobs.map((id) => [`experience::${id}`, 40])),
      }),
      150
    );

    // Page 1: header 70 + blank line 18 + title 10 + one job = 138. Page 2 has no header, so
    // the title and three jobs fit: 18 + 10 + 120 = 148.
    expect(pages).toHaveLength(2);
    expect(pages[0][0].entries).toHaveLength(1);
    expect(pages[1][0].entries).toHaveLength(3);
  });

  it('keeps a first page holding only the header when the opening block moves on', () => {
    const pages = paginateSections(
      [createExperienceSection([{ id: 'job-1', heading: 'Analyst', bullets: createBullets('A') }])],
      createMeasurements({
        headerHeight: 87.1,
        sectionTitleHeights: { experience: 18 },
        entryHeadingHeights: { 'experience::job-1': 22 },
        bulletHeights: { A: 630 },
      }),
      688.05
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual([]);
    expect(pages[1][0].entries[0].bullets.map((bullet) => bullet.text)).toEqual(['A']);
  });

  it('splits long text-only entries into continuation entries', () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const pages = paginateSections(
      [
        {
          id: 'summary',
          layout: 'lines',
          label: 'Summary',
          entries: [{ id: 'summary-1', text, bullets: [] }],
        },
      ],
      createMeasurements({
        sectionTitleHeights: { summary: 10 },
        entryHeights: { 'summary::summary-1': 140 },
      }),
      70
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0][0].entries[0].id).toBe('summary-1-cont-0');
    expect(pages[0][0].entries[0].text?.length).toBeLessThan(text.length);
  });

  it('never splits a bullet: a heading and its first bullet move on together', () => {
    const text = Array.from({ length: 40 }, (_, index) => `detail${index}`).join(' ');
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', heading: 'Engineer 1', bullets: createBullets('A') },
          { id: 'job-2', heading: 'Engineer 2', bullets: [{ id: 'b1', text }] },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: { 'experience::job-1': 40, 'experience::job-2': 102 },
        entryHeadingHeights: { 'experience::job-2': 18 },
        bulletHeights: { b1: 80 },
      }),
      110
    );

    // Page 1 has room for job 2's heading (22) but not its bullet (80).
    expect(pages.map((page) => page[0].entries.map((entry) => entry.heading))).toEqual([
      ['Engineer 1'],
      ['Engineer 2'],
    ]);
    expect(pages[1][0].entries[0].bullets).toEqual([{ id: 'b1', text }]);
  });

  it('measures a continued entry by its own bullets, not the whole entry', () => {
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', heading: 'Engineer', bullets: createBullets('A', 'B', 'C', 'D') },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: { 'experience::job-1': 130 },
        entryHeadingHeights: { 'experience::job-1': 18 },
        bulletHeights: { A: 18, B: 18, C: 54, D: 18 },
      }),
      110
    );

    // C and D (72) fit page 2; the whole entry (130) would not.
    expect(pages.map((page) => page[0].entries[0].bullets.map((bullet) => bullet.text))).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });

  it('carries a section onto the next page without its title or the entry heading', () => {
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', heading: 'Engineer', bullets: createBullets('A', 'B', 'C') },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 18 },
        entryHeadingHeights: { 'experience::job-1': 18 },
        bulletHeights: { A: 18, B: 18, C: 18 },
      }),
      // Blank line, title, heading and gap, two bullets.
      94
    );

    const [first, second] = pages.map((page) => page[0]);
    expect([first.isContinued, second.isContinued]).toEqual([undefined, true]);
    expect(first.entries[0].heading).toBe('Engineer');
    expect(second.entries[0].heading).toBeUndefined();
    expect(second.entries[0].bullets.map((bullet) => bullet.text)).toEqual(['C']);
  });

  it('splits a paragraph at a measured line, two lines at least on each side', () => {
    // Six drawn lines of "lineN words", each starting where the measurement says.
    const lineTexts = Array.from({ length: 6 }, (_, index) => `line${index} words `);
    const text = lineTexts.join('').trimEnd();
    const lineStarts = lineTexts.map((_, index) => lineTexts.slice(0, index).join('').length);
    const paginate = (pageHeight: number, headerHeight = 0) =>
      paginateSections(
        [
          {
            id: 'summary',
            layout: 'lines',
            label: 'Summary',
            entries: [{ id: 'summary-1', text, bullets: [] }],
          },
        ],
        createMeasurements({
          headerHeight,
          sectionTitleHeights: { summary: 18 },
          entryHeights: { 'summary::summary-1': 108 },
          lineStarts: { 'summary::summary-1': lineStarts },
        }),
        pageHeight
      ).map((page) => page.flatMap((section) => section.entries.map((entry) => entry.text)));

    // Blank line and title (36), then room for three lines.
    expect(paginate(90)).toEqual([
      ['line0 words line1 words line2 words'],
      ['line3 words line4 words line5 words'],
    ]);
    // Room for five: one would be left alone, so only four stay.
    expect(paginate(126)[1]).toEqual(['line4 words line5 words']);
    // Under a header, room for one: it can't stay alone, so the paragraph moves on, title and
    // all, to a page where it fits whole. The header keeps the first page.
    expect(paginate(126, 72)).toEqual([[], [text]]);
  });

  it('splits a bullet no page can hold by line, the rest carried on without a marker', () => {
    const lineTexts = Array.from({ length: 8 }, (_, index) => `g${index} words `);
    const giant = lineTexts.join('').trimEnd();
    const lineStarts = lineTexts.map((_, index) => lineTexts.slice(0, index).join('').length);
    const paginate = (...short: string[]) =>
      paginateSections(
        [
          createExperienceSection([
            { id: 'job-1', bullets: [...createBullets(...short), { id: 'giant', text: giant }] },
          ]),
        ],
        createMeasurements({
          sectionTitleHeights: { experience: 18 },
          bulletHeights: { A: 18, B: 18, giant: 144 },
          lineStarts: { giant: lineStarts },
        }),
        // Five lines to a page; the first loses two to the blank line and title.
        90
      ).map((page) =>
        page[0].entries[0].bullets.map((bullet) => [bullet.text, bullet.isContinued ?? false])
      );

    expect(paginate('A')).toEqual([
      [
        ['A', false],
        ['g0 words g1 words', false],
      ],
      [['g2 words g3 words g4 words g5 words', true]],
      [['g6 words g7 words', true]],
    ]);
    // Room for one line: the bullet can't leave its first line alone, so it moves on.
    expect(paginate('A', 'B')).toEqual([
      [
        ['A', false],
        ['B', false],
      ],
      [['g0 words g1 words g2 words g3 words g4 words', false]],
      [['g5 words g6 words g7 words', true]],
    ]);
  });

  it('opens a section at the top of a later page without the blank line above it', () => {
    const jobs = ['job-1', 'job-2'];
    const pages = paginateSections(
      [
        createExperienceSection(jobs.slice(0, 1).map((id) => ({ id, heading: id, bullets: [] }))),
        {
          id: 'projects',
          layout: 'entries',
          label: 'Projects',
          entries: [{ id: 'job-2', heading: 'job-2', bullets: [] }],
        },
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 18, projects: 18 },
        entryHeights: { 'experience::job-1': 36, 'projects::job-2': 54 },
      }),
      // Page 1 holds Experience (72). Projects then needs 90 with its blank line, 72 without.
      80
    );

    expect(pages.map((page) => page.map((section) => section.id))).toEqual([
      ['experience'],
      ['projects'],
    ]);
  });

  it('lays out every page a long resume runs to, up to the limit it is given', () => {
    const entries = Array.from({ length: 30 }, (_, index) => ({
      id: `job-${index}`,
      heading: `Engineer ${index}`,
      bullets: createBullets(`Detail ${index}`),
    }));
    const measurements = createMeasurements({
      sectionTitleHeights: { experience: 10 },
      entryHeights: Object.fromEntries(entries.map((entry) => [`experience::${entry.id}`, 50])),
    });
    const paginate = (maxPages?: number) =>
      paginateSections([createExperienceSection(entries)], measurements, 70, maxPages);

    // One entry to a page here, and none of them is dropped for being far down the resume.
    expect(paginate(30)).toHaveLength(30);
    // Split entries carry a continuation id, so the last page is the last entry's.
    expect(paginate(30).at(-1)?.[0].entries[0].id).toMatch(/^job-29/);
    // The preview's own limit, when nothing else is asked for.
    expect(paginate()).toHaveLength(MAX_PREVIEW_PAGES);
    expect(paginate(4)).toHaveLength(4);
  });
});
