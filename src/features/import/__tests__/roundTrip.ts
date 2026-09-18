import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import {
  formatHeaderLineText,
  createHeaderItem,
  createHeaderLine,
} from '@/lib/resume/resumeHeader';
import type { HeaderItemKind, ResumeData, ResumeEntry, ResumeSection } from '@/types/resume';

/** Resumes for round-trip tests: export one, import the file, compare what the page shows. */

let nextId = 0;
const id = () => `id-${nextId++}`;

export function entry(
  fields: Omit<Partial<ResumeEntry>, 'bullets'> & { bullets?: string[] }
): ResumeEntry {
  return {
    ...fields,
    id: id(),
    selected: true,
    bullets: (fields.bullets ?? []).map((text) => ({ id: id(), text, selected: true })),
  };
}

export function section(
  kind: ResumeSection['kind'],
  layout: ResumeSection['layout'],
  label: string,
  items: ResumeEntry[]
): ResumeSection {
  return { id: id(), kind, layout, label, order: 0, items };
}

export const lines = (...texts: string[]) => texts.map((text) => entry({ text }));

/** A header item that links to what it shows. */
export const createLinkedHeaderItem = (kind: HeaderItemKind, text: string) =>
  createHeaderItem(kind, { text, url: text });

export function resume(sections: ResumeSection[]): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: 'Ada Lovelace',
      header: {
        linkStyle: 'plain',
        lines: [
          createHeaderLine([
            createLinkedHeaderItem('phone', '555-0100'),
            createLinkedHeaderItem('email', 'ada@example.com'),
            createLinkedHeaderItem('linkedin', 'https://linkedin.com/in/ada'),
            createLinkedHeaderItem('github', 'github.com/ada'),
            createLinkedHeaderItem('site', 'ada.dev'),
          ]),
          createHeaderLine([
            createHeaderItem('auth', { text: 'British subject' }),
            createHeaderItem('location', { text: 'London, UK' }),
          ]),
        ],
      },
    },
    sections: sections.map((s, order) => ({ ...s, order })),
  };
}

/** Every kind in both shapes, including ones some formats have no place for as they are. */
export function everything(): ResumeData {
  return resume([
    section('summary', 'lines', 'Profile', lines('Builds engines.', 'Writes programs.')),
    section('experience', 'entries', 'Work History', [
      entry({ title: 'Analyst at Babbage & Co', subtitle: '1842 to 1843', bullets: ['Wrote it'] }),
      entry({ subtitle: '1840' }),
      entry({ title: 'Hidden job', selected: false }),
    ]),
    section('experience', 'lines', 'Consulting', lines('Advised the Royal Society')),
    section('internships', 'entries', 'Internships', [entry({ title: 'Intern at Mint' })]),
    section('education', 'entries', 'Education', [
      entry({ title: 'Tutored in mathematics', subtitle: '1829', bullets: ['By De Morgan'] }),
    ]),
    section('projects', 'entries', 'Projects', [
      entry({ title: 'Note G', subtitle: '1843', bullets: ['Bernoulli numbers', 'Loops'] }),
    ]),
    section('skills', 'lines', 'Skills', lines('Mathematics: analysis, algebra')),
    section('skills', 'entries', 'Toolbox', [
      entry({ title: 'Punched cards', subtitle: 'expert', bullets: ['Jacquard'] }),
    ]),
    section('certifications', 'entries', 'Certifications', [
      entry({ title: 'Fellow', subtitle: 'Royal Society' }),
    ]),
    section('certifications', 'entries', 'Licenses', [
      entry({ title: 'Engine operator', bullets: ['Renewed yearly'] }),
    ]),
    section('summary', 'entries', 'Highlights', [entry({ title: 'First programmer' })]),
    section('custom', 'entries', 'Volunteering', [
      entry({ title: 'Tutor', subtitle: '1850', bullets: ['Taught girls maths'] }),
    ]),
    section('custom', 'lines', 'Languages', lines('English', 'French')),
  ]);
}

/**
 * What the page shows — what a round trip has to keep. A kind shows only as an icon, and
 * where one item ends and the next begins doesn't show at all: the line reads the same.
 */
export function shown(data: ResumeData) {
  const { contact, sections } = normalizeResumeForExport(data);
  return {
    name: contact.name,
    linkStyle: contact.linkStyle,
    header: contact.lines.map((line) => ({
      align: line.align,
      text: formatHeaderLineText(line),
      // Each link's words and where it goes.
      links: line.items.filter((item) => item.href).map(({ text, href }) => [text, href]),
    })),
    sections: sections.map(({ layout, label, entries }) => ({
      layout,
      label,
      entries: entries.map(({ title, subtitle, text, bullets }) => ({
        title,
        subtitle,
        text,
        bullets,
      })),
    })),
  };
}

export const kinds = (data: ResumeData) => data.sections.map((s) => s.kind);

/**
 * A header using what a header can: a left-aligned line with its own separator, a link
 * whose words and address hold characters Markdown and plain text write specially, an
 * address left unlinked, a status holding its line's separator, spaces between items, and
 * underlined links.
 */
export function createStyledHeaderResume(): ResumeData {
  const data = resume([section('skills', 'lines', 'Skills', lines('Mathematics'))]);
  data.contact.header = {
    linkStyle: 'underline',
    lines: [
      createHeaderLine(
        [
          createLinkedHeaderItem('phone', '555-0100'),
          createHeaderItem('custom', { text: 'Notes [draft] *1*', url: 'ada.dev/notes_(2025)' }),
          createHeaderItem('email', { text: 'ada@example.com' }),
        ],
        { separator: ' · ', align: 'left' }
      ),
      createHeaderLine(
        [
          createHeaderItem('auth', { text: 'F-1 OPT — authorized through 2028' }),
          createHeaderItem('location', { text: 'London, UK' }),
        ],
        { separator: ' — ' }
      ),
      createHeaderLine(
        [
          createLinkedHeaderItem('github', 'github.com/ada'),
          createHeaderItem('site', { text: 'Portfolio', url: 'https://ada.dev' }),
        ],
        { separator: '    ' }
      ),
    ],
  };
  return data;
}

/** What the page shows, with the changes a format can't help making. */
export function buildExpectedShown(
  data: ResumeData,
  change: (expected: ReturnType<typeof shown>) => void
): ReturnType<typeof shown> {
  const expected = shown(data);
  change(expected);
  return expected;
}
