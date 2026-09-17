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
export const linked = (kind: HeaderItemKind, text: string) =>
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
            linked('phone', '555-0100'),
            linked('email', 'ada@example.com'),
            linked('linkedin', 'https://linkedin.com/in/ada'),
            linked('github', 'github.com/ada'),
            linked('site', 'ada.dev'),
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
    header: contact.lines.map((line) => ({ align: line.align, text: formatHeaderLineText(line) })),
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
