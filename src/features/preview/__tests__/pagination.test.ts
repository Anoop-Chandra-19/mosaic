import { describe, expect, it } from 'vitest';
import { normalizeSections, paginateSections, type PaginationMeasurements } from '../pagination';
import type { PreviewRenderableSection } from '../PreviewSection';
import type { ResumeSection } from '@/types/resume';

function createMeasurements(
  overrides: Partial<PaginationMeasurements> = {}
): PaginationMeasurements {
  return {
    headerHeight: 0,
    continuationHeaderHeight: 0,
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
    type: 'experience',
    label: 'Experience',
    entries,
  };
}

describe('normalizeSections', () => {
  it('sorts sections and excludes unselected or empty entries', () => {
    const sections: ResumeSection[] = [
      {
        id: 'experience',
        type: 'experience',
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
        type: 'summary',
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
        type: 'summary',
        label: 'Summary',
        entries: [
          { id: 'summary-1', text: 'Focused builder.', bullets: [], _sourceKey: 'summary-1' },
        ],
      },
      {
        id: 'experience',
        type: 'experience',
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

  it('splits long text-only entries into continuation entries', () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const pages = paginateSections(
      [
        {
          id: 'summary',
          type: 'summary',
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
