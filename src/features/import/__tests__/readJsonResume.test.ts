import { describe, expect, it } from 'vitest';
import { createJsonResumeExport } from '@/features/export/jsonResume';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import type { ResumeData, ResumeEntry, ResumeSection } from '@/types/resume';
import { isJsonResume, readJsonResume } from '../readJsonResume';

let nextId = 0;
const id = () => `id-${nextId++}`;

function entry(
  fields: Omit<Partial<ResumeEntry>, 'bullets'> & { bullets?: string[] }
): ResumeEntry {
  return {
    ...fields,
    id: id(),
    selected: true,
    bullets: (fields.bullets ?? []).map((text) => ({ id: id(), text, selected: true })),
  };
}

function section(
  kind: ResumeSection['kind'],
  layout: ResumeSection['layout'],
  label: string,
  items: ResumeEntry[]
): ResumeSection {
  return { id: id(), kind, layout, label, order: 0, items };
}

const lines = (...texts: string[]) => texts.map((text) => entry({ text }));

/** Every kind in both shapes, including ones JSON Resume has no place for as they are. */
function everything(): ResumeData {
  const sections = [
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
  ].map((s, order) => ({ ...s, order }));
  return {
    schemaVersion: 1,
    contact: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '555-0100',
      location: 'London, UK',
      citizenshipStatus: 'British subject',
      linkedin: 'https://linkedin.com/in/ada',
      github: 'github.com/ada',
      website: 'ada.dev',
      showLinkedin: true,
      showGithub: true,
      showWebsite: true,
    },
    sections,
  };
}

/** What the page shows — what a round trip has to keep. */
function shown(resume: ResumeData) {
  const { contact, sections } = normalizeResumeForExport(resume);
  return {
    contact,
    sections: sections.map(({ kind, layout, label, entries }) => ({
      kind,
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

const exported = (resume: ResumeData) =>
  JSON.parse(createJsonResumeExport(normalizeResumeForExport(resume)));

describe('readJsonResume', () => {
  it('reads Mosaic’s own export back exactly', () => {
    for (const resume of [everything(), createDefaultResume()]) {
      const parsed = readJsonResume(exported(resume));
      expect(shown(parsed.resume)).toEqual(shown(resume));
      expect(parsed.warnings).toEqual([]);
      expect(parsed.leftOut).toEqual([]);
    }
  });

  it('reads a file another tool changed by its standard fields, and says so', () => {
    const file = exported(everything());
    file.work.push({ position: 'Added elsewhere' });

    const parsed = readJsonResume(file);
    expect(parsed.warnings).toContain(
      'This file was changed after Mosaic exported it, so its sections are read by their JSON Resume names.'
    );
    const experience = parsed.resume.sections.find((s) => s.kind === 'experience');
    expect(experience?.label).toBe('Experience');
    expect(experience?.items.at(-1)?.title).toBe('Added elsewhere');
  });

  it('maps another tool’s file into sections, entries written the Headless way', () => {
    const parsed = readJsonResume({
      basics: {
        name: 'Grace Hopper',
        label: 'Computer scientist',
        email: 'grace@example.com',
        phone: '555-0199',
        url: 'https://grace.dev',
        summary: 'First paragraph.\n\nSecond paragraph.',
        location: { city: 'Arlington', region: 'VA', countryCode: 'US' },
        profiles: [
          { network: 'Twitter', username: 'grace' },
          { network: 'LinkedIn', url: 'https://www.linkedin.com/in/grace' },
          { network: 'GitHub', username: 'grace' },
        ],
      },
      work: [
        {
          name: 'US Navy',
          position: 'Rear Admiral',
          location: 'Washington, DC',
          startDate: '1967-08-01',
          summary: 'Standardized languages.',
          highlights: ['COBOL validation'],
        },
        {
          name: 'Remington Rand',
          position: 'Senior Mathematician',
          startDate: '1949',
          endDate: '1967-06',
        },
      ],
      volunteer: [{ organization: 'ACM', position: 'Lecturer', highlights: ['Talks'] }],
      education: [
        {
          institution: 'Yale University',
          area: 'Mathematics',
          studyType: 'Ph.D.',
          endDate: '1934',
          score: '4.0',
          courses: ['Algebra'],
        },
      ],
      awards: [{ title: 'National Medal of Technology', date: '1991', summary: 'For languages.' }],
      certificates: [{ name: 'Navigator', issuer: 'US Navy', date: '1944-12' }],
      publications: [{ name: 'The Education of a Computer', publisher: 'ACM' }],
      skills: [{ name: 'Languages', level: 'Master', keywords: ['COBOL', 'FLOW-MATIC'] }],
      languages: [{ language: 'English', fluency: 'Native speaker' }],
      interests: [{ name: 'Clocks' }],
      references: [{ name: 'Howard Aiken', reference: 'A fine programmer.' }],
      projects: [
        { name: 'A-0 System', startDate: '1951', endDate: '1952', description: 'A compiler.' },
        { name: 'Nanosecond wire', type: 'talk' },
      ],
    });

    expect(parsed.resume.contact).toMatchObject({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '555-0199',
      website: 'grace.dev',
      location: 'Arlington, VA',
      linkedin: 'www.linkedin.com/in/grace',
      github: 'github.com/grace',
    });
    const read = parsed.resume.sections.map(({ kind, layout, label, items }) => [
      kind,
      layout,
      label,
      items.map(
        ({ title, subtitle, text, bullets }) =>
          text ?? [title, subtitle, bullets.map((bullet) => bullet.text)]
      ),
    ]);
    expect(read).toEqual([
      ['summary', 'lines', 'Summary', ['First paragraph.', 'Second paragraph.']],
      [
        'experience',
        'entries',
        'Experience',
        [
          [
            'Rear Admiral at US Navy, Washington, DC',
            'Aug 1967 to Current',
            ['Standardized languages.', 'COBOL validation'],
          ],
          ['Senior Mathematician at Remington Rand', '1949 to Jun 1967', []],
        ],
      ],
      ['custom', 'entries', 'Volunteering', [['Lecturer at ACM', undefined, ['Talks']]]],
      [
        'education',
        'entries',
        'Education',
        [['Ph.D. in Mathematics from Yale University', '1934', ['Algebra', 'GPA: 4.0']]],
      ],
      [
        'custom',
        'entries',
        'Awards',
        [['National Medal of Technology', '1991', ['For languages.']]],
      ],
      ['certifications', 'entries', 'Certifications', [['Navigator, US Navy', 'Dec 1944', []]]],
      ['custom', 'entries', 'Publications', [['The Education of a Computer, ACM', undefined, []]]],
      ['skills', 'lines', 'Skills', ['Languages: COBOL, FLOW-MATIC']],
      ['custom', 'lines', 'Languages', ['English — Native speaker']],
      ['custom', 'lines', 'Interests', ['Clocks']],
      ['projects', 'entries', 'Projects', [['A-0 System', '1951 to 1952', ['A compiler.']]]],
      ['custom', 'lines', 'Talk', ['Nanosecond wire']],
    ]);
    expect(parsed.leftOut).toEqual(['Computer scientist', 'Howard Aiken: A fine programmer.']);
    expect(parsed.warnings).toEqual([]);
  });
});

describe('isJsonResume', () => {
  it('knows a JSON Resume by its basics or its section arrays', () => {
    expect(isJsonResume({ basics: {} })).toBe(true);
    expect(isJsonResume({ work: [] })).toBe(true);
    expect(isJsonResume({ bundleVersion: 2, templates: [] })).toBe(false);
    expect(isJsonResume([])).toBe(false);
  });
});
