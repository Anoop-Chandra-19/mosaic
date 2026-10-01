import type { ResumeData } from '../../../types/resume';
import type { Change } from '../resumeChange';

export const createChange = (fields: Partial<Change>): Change => ({
  id: 'c',
  kind: 'rewrite',
  line: 'bullet',
  sectionId: null,
  entryId: null,
  bulletId: null,
  where: '',
  origin: 'diff',
  ...fields,
});

/** A fictional resume with every kind of row: header items, a summary, entries, a skills list. */
export function createChangeFixture(): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: 'Ada Lovelace',
      header: {
        linkStyle: 'plain',
        lines: [
          {
            id: 'reach',
            separator: ' | ',
            align: 'center',
            items: [
              { id: 'email', kind: 'email', text: 'ada@example.com', url: '', shown: true },
              {
                id: 'linkedin',
                kind: 'linkedin',
                text: 'LinkedIn',
                url: 'linkedin.com/in/ada',
                shown: true,
              },
            ],
          },
        ],
      },
    },
    sections: [
      {
        id: 'summary',
        kind: 'summary',
        layout: 'lines',
        label: 'Summary',
        order: 0,
        items: [
          {
            id: 'sum-1',
            selected: true,
            text: 'Analyst who writes programs for the engine.',
            bullets: [],
          },
          { id: 'sum-2', selected: true, text: 'Works from first principles.', bullets: [] },
        ],
      },
      {
        id: 'work',
        kind: 'experience',
        layout: 'entries',
        label: 'Work History',
        order: 1,
        items: [
          {
            id: 'babbage',
            selected: true,
            title: 'Analyst',
            organization: 'Babbage & Co',
            location: 'London',
            dates: '2024',
            bullets: [
              { id: 'b1', selected: true, text: 'Wrote the first program for the engine.' },
              { id: 'b2', selected: true, text: 'Checked every table by hand.' },
              { id: 'b3', selected: true, text: 'Explained the notes to the society.' },
            ],
          },
          {
            id: 'somerville',
            selected: true,
            title: 'Translator',
            organization: 'Somerville Press',
            dates: '2023',
            bullets: [{ id: 's1', selected: true, text: 'Translated the memoir.' }],
          },
        ],
      },
      {
        id: 'projects',
        kind: 'projects',
        layout: 'entries',
        label: 'Projects',
        order: 2,
        items: [
          {
            id: 'loom',
            selected: true,
            title: 'Loom cards',
            bullets: [{ id: 'l1', selected: true, text: 'Punched the cards for a pattern.' }],
          },
        ],
      },
      {
        id: 'skills',
        kind: 'skills',
        layout: 'lines',
        label: 'Skills',
        order: 3,
        items: [
          { id: 'sk-1', selected: true, text: 'Mathematics', bullets: [] },
          { id: 'sk-2', selected: true, text: 'Translation', bullets: [] },
        ],
      },
    ],
  };
}

export function editFixture(edit: (doc: ResumeData) => void): ResumeData {
  const doc = createChangeFixture();
  edit(doc);
  return doc;
}

export const findSection = (doc: ResumeData, id: string) =>
  doc.sections.find((section) => section.id === id)!;

export const findEntry = (doc: ResumeData, sectionId: string, entryId: string) =>
  findSection(doc, sectionId).items.find((entry) => entry.id === entryId)!;
