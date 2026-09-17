import { describe, expect, it } from 'vitest';
import { createJsonResumeExport } from '@/features/export/jsonResume';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import { createHeaderItem } from '@/lib/resume/resumeHeader';
import type { ResumeData } from '@/types/resume';
import { isJsonResume, readJsonResume } from '../readJsonResume';
import { entry, everything, kinds, resume, section, shown } from './roundTrip';

const exported = (resume: ResumeData) =>
  JSON.parse(createJsonResumeExport(normalizeResumeForExport(resume)));

/** Each header line's items as kind, text, and link. */
const headerItems = (resume: ResumeData) =>
  resume.contact.header.lines.map((line) =>
    line.items.map(({ kind, text, url }) => [kind, text, url])
  );

describe('readJsonResume', () => {
  it('reads Mosaic’s own export back exactly', () => {
    for (const resume of [everything(), createDefaultResume()]) {
      const parsed = readJsonResume(exported(resume));
      expect(shown(parsed.resume)).toEqual(shown(resume));
      // meta.mosaic keeps each section's kind as well.
      expect(kinds(parsed.resume)).toEqual(kinds(resume));
      expect(parsed.warnings).toEqual([]);
      expect(parsed.leftOut).toEqual([]);
    }
  });

  it('gives back the header whole: kinds, links, separators, alignment, link style', () => {
    const data = everything();
    const { header } = data.contact;
    header.linkStyle = 'underline';
    Object.assign(header.lines[1], { separator: ' · ', align: 'left' });
    header.lines[0].items.push(
      createHeaderItem('custom', { text: 'Portfolio', url: 'ada.dev/work' })
    );

    const read = readJsonResume(exported(data)).resume.contact.header;
    expect(read.linkStyle).toBe('underline');
    expect(read.lines.map(({ separator, align }) => [separator, align])).toEqual([
      [' | ', 'center'],
      [' · ', 'left'],
    ]);
    expect(headerItems(readJsonResume(exported(data)).resume)).toEqual([
      [
        ['phone', '555-0100', 'tel:5550100'],
        ['email', 'ada@example.com', 'mailto:ada@example.com'],
        ['linkedin', 'https://linkedin.com/in/ada', 'https://linkedin.com/in/ada'],
        ['github', 'github.com/ada', 'https://github.com/ada'],
        ['site', 'ada.dev', 'https://ada.dev'],
        ['custom', 'Portfolio', 'https://ada.dev/work'],
      ],
      [
        ['auth', 'British subject', ''],
        ['location', 'London, UK', ''],
      ],
    ]);
  });

  it('builds the header from basics when another tool changed them, and says so', () => {
    const file = exported(everything());
    file.basics.email = 'ada@elsewhere.org';

    const parsed = readJsonResume(file);
    expect(parsed.warnings).toEqual([
      'The contact details in this file were changed after Mosaic exported it, so the header is built from them.',
    ]);
    expect(headerItems(parsed.resume)[0][1]).toEqual([
      'email',
      'ada@elsewhere.org',
      'ada@elsewhere.org',
    ]);
  });

  it('gives back dates as they were written, until another tool changes them', () => {
    const data = resume([
      section('experience', 'entries', 'Work History', [
        entry({ title: 'Engineer at Acme, Detroit', subtitle: 'January 2021 to Present' }),
        entry({ title: 'Analyst at Globex', subtitle: 'Month Year to Current' }),
      ]),
    ]);
    const file = exported(data);
    expect(shown(readJsonResume(file).resume)).toEqual(shown(data));

    // Moved in another tool: the file's dates win over the words Mosaic kept.
    file.work[0].startDate = '2020-03';
    const titles = readJsonResume(file).resume.sections[0].items.map((item) => [
      item.title,
      item.subtitle,
    ]);
    expect(titles).toEqual([
      ['Engineer at Acme, Detroit', 'Mar 2020 to Current'],
      ['Analyst at Globex', 'Month Year to Current'],
    ]);
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

    expect(parsed.resume.contact.name).toBe('Grace Hopper');
    expect(headerItems(parsed.resume)).toEqual([
      [
        ['phone', '555-0199', '555-0199'],
        ['email', 'grace@example.com', 'grace@example.com'],
        ['linkedin', 'https://www.linkedin.com/in/grace', 'https://www.linkedin.com/in/grace'],
        ['github', 'github.com/grace', 'github.com/grace'],
        ['site', 'https://grace.dev', 'https://grace.dev'],
      ],
      [['location', 'Arlington, VA', '']],
    ]);
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
