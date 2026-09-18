import { describe, expect, it } from 'vitest';
import { normalizeSections, paginateSections, type PaginationMeasurements } from '../pagination';
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
    ...overrides,
  };
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
            subtitle: ' Mosaic ',
            bullets: [
              { id: 'b1', text: ' Built export flow ', selected: true },
              { id: 'b2', text: ' Hidden bullet ', selected: false },
            ],
          },
          {
            id: 'job-2',
            selected: false,
            title: 'Hidden',
            subtitle: '',
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
            title: 'Engineer',
            subtitle: 'Mosaic',
            bullets: ['Built export flow'],
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
          { id: 'job-1', title: 'Engineer 1', subtitle: '', bullets: ['A'] },
          { id: 'job-2', title: 'Engineer 2', subtitle: '', bullets: ['B'] },
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
          { id: 'job-1', title: 'Engineer 1', subtitle: '', bullets: ['A'] },
          { id: 'job-2', title: 'Engineer 2', subtitle: '', bullets: ['B'] },
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
          entries: degrees.map((id) => ({ id, title: id, subtitle: '2025', bullets: [] })),
        },
      ],
      createMeasurements({
        sectionTitleHeights: { education: 18 },
        entryHeights: Object.fromEntries(degrees.map((id) => [`education::${id}`, 18])),
      }),
      // A blank line, the title, and two degrees fill the page.
      72
    );

    expect(pages.map((page) => page[0].entries.map((entry) => entry.title))).toEqual([
      ['edu-1', 'edu-2'],
      ['edu-3'],
    ]);
  });

  it('reserves room for the header on the first page only', () => {
    const jobs = ['job-1', 'job-2', 'job-3', 'job-4'];
    const pages = paginateSections(
      [
        createExperienceSection(
          jobs.map((id) => ({ id, title: id, subtitle: '', bullets: ['A'] }))
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

  it('splits a long bullet when no complete bullet fits the available height', () => {
    const bullet = Array.from({ length: 40 }, (_, index) => `detail${index}`).join(' ');
    const pages = paginateSections(
      [
        createExperienceSection([
          { id: 'job-1', title: 'Engineer', subtitle: '', bullets: [bullet] },
        ]),
      ],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: { 'experience::job-1': 120 },
        bulletHeights: { 'experience::job-1': [80] },
      }),
      60
    );

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.length).toBeLessThanOrEqual(3);
    expect(pages[0][0].entries[0].id).toBe('job-1-cont-0');
    expect(pages[0][0].entries[0].bullets[0].length).toBeLessThan(bullet.length);
    expect(pages[1][0].entries[0].bullets.join(' ')).toContain('detail');
  });

  it('caps returned pages at the existing three-page limit', () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({
      id: `job-${index}`,
      title: `Engineer ${index}`,
      subtitle: '',
      bullets: [`Detail ${index}`],
    }));

    const pages = paginateSections(
      [createExperienceSection(entries)],
      createMeasurements({
        sectionTitleHeights: { experience: 10 },
        entryHeights: Object.fromEntries(entries.map((entry) => [`experience::${entry.id}`, 50])),
      }),
      70
    );

    expect(pages).toHaveLength(3);
  });
});
