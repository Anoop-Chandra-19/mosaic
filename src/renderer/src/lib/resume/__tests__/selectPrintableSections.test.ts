import { describe, expect, it } from 'vitest';
import type { ResumeSection } from '@shared/types/resume';
import { selectPrintableSections } from '../selectPrintableSections';

const sections: ResumeSection[] = [
  {
    id: 'experience',
    kind: 'experience',
    layout: 'entries',
    label: ' Experience ',
    order: 1,
    items: [
      {
        id: 'job-1',
        selected: true,
        title: ' Engineer ',
        dates: '2024',
        bullets: [
          { id: 'b1', selected: true, text: ' Built the export ' },
          { id: 'b2', selected: false, text: 'Not picked' },
          { id: 'b3', selected: true, text: '   ' },
        ],
      },
      { id: 'job-2', selected: true, title: ' ', dates: '', bullets: [] },
    ],
  },
  {
    id: 'skills',
    kind: 'skills',
    layout: 'lines',
    label: 'Skills',
    order: 0,
    hidden: true,
    items: [{ id: 'skill-1', selected: true, text: 'TypeScript', bullets: [] }],
  },
];

describe('selectPrintableSections', () => {
  it('keeps what prints: shown, picked, and not blank, trimmed and in order', () => {
    expect(selectPrintableSections(sections)).toEqual([
      {
        id: 'experience',
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        entries: [
          {
            id: 'job-1',
            title: 'Engineer',
            organization: '',
            location: '',
            dates: '2024',
            heading: 'Engineer',
            text: '',
            bullets: [{ id: 'b1', text: 'Built the export' }],
          },
        ],
      },
    ]);
  });

  it('takes hidden content too when asked, but still nothing blank', () => {
    const printed = selectPrintableSections(sections, { includeHidden: true });
    expect(printed.map((section) => section.id)).toEqual(['skills', 'experience']);
    expect(printed[1].entries.map((entry) => entry.bullets.map((bullet) => bullet.id))).toEqual([
      ['b1', 'b2'],
    ]);
  });
});
