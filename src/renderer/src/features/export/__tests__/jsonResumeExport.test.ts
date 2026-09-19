import { describe, expect, it } from 'vitest';
import { createJsonResumeExport } from '../jsonResumeExport';
import type { ExportEntry, NormalizedResumeExport } from '../normalizeResumeExport';
import type { EntryTextPart } from '../jsonResumeEntry';
import type { HeaderItemKind } from '@shared/types/resume';
import { createExportEntry } from './exportEntries';

let nextId = 0;
const entry = (
  parts: Pick<ExportEntry, 'title'> & Partial<Pick<ExportEntry, EntryTextPart>>,
  bullets: string[] = []
): ExportEntry => createExportEntry(`e${nextId++}`, { ...parts, bullets });
const item = (kind: HeaderItemKind, text: string, href = '') => ({
  id: `h${nextId++}`,
  kind,
  text,
  href,
});
const line = (text: string): ExportEntry => createExportEntry(`l${nextId++}`, { text });

function createExportData(): NormalizedResumeExport {
  return {
    contact: {
      name: 'Alex Johnson',
      linkStyle: 'plain',
      linkColor: 'ink',
      lines: [
        {
          id: 'reach',
          separator: ' | ',
          align: 'center',
          items: [
            item('phone', '555-0100', 'tel:5550100'),
            item('email', 'alex@example.com', 'mailto:alex@example.com'),
            item('linkedin', 'LinkedIn', 'https://linkedin.com/in/alex'),
            item('github', 'github.com/alex', 'https://github.com/alex'),
            item('site', 'alex.dev', 'https://alex.dev'),
          ],
        },
        {
          id: 'where',
          separator: ' · ',
          align: 'left',
          items: [item('auth', 'US Citizen'), item('location', 'Detroit, MI')],
        },
      ],
    },
    sections: [
      {
        id: 'summary',
        kind: 'summary',
        layout: 'lines',
        label: 'Summary',
        entries: [line('Focused builder.'), line('Open-source fan.')],
      },
      {
        id: 'education',
        kind: 'education',
        layout: 'entries',
        label: 'Education',
        entries: [
          entry(
            {
              title: 'B.S. in Computer Science',
              organization: 'University of Michigan',
              dates: '2019 to 2023',
            },
            ['GPA: 3.8/4.0']
          ),
        ],
      },
      {
        id: 'experience',
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        entries: [
          entry(
            {
              title: 'Engineer',
              organization: 'Mosaic',
              location: 'Detroit, MI',
              dates: 'Jun 2023 to Current',
            },
            ['Built export flow']
          ),
        ],
      },
      {
        id: 'internships',
        kind: 'internships',
        layout: 'entries',
        label: 'Internships',
        entries: [entry({ title: 'Intern', organization: 'Startup Co', dates: '2022' })],
      },
      {
        id: 'projects',
        kind: 'projects',
        layout: 'entries',
        label: 'Projects',
        entries: [
          entry({ title: 'Mosaic', organization: 'Open source', dates: 'Modular resume builder' }, [
            'React 19',
            'Local-first',
          ]),
        ],
      },
      {
        id: 'skills',
        kind: 'skills',
        layout: 'lines',
        label: 'Skills',
        entries: [line('TypeScript, React')],
      },
      {
        id: 'certifications',
        kind: 'certifications',
        layout: 'entries',
        label: 'Certifications',
        entries: [
          entry({ title: 'AWS Solutions Architect', organization: 'Amazon', dates: 'Jan 2025' }),
          entry({ title: 'CKA', organization: 'CNCF' }),
        ],
      },
    ],
  };
}

function parseExport(data: NormalizedResumeExport) {
  return JSON.parse(createJsonResumeExport(data));
}

describe('createJsonResumeExport', () => {
  it('puts each part of an entry in the field that means it', () => {
    const resume = parseExport(createExportData());

    expect(resume.$schema).toBe(
      'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json'
    );
    expect(resume.basics).toMatchObject({
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      url: 'https://alex.dev',
      summary: 'Focused builder.\n\nOpen-source fan.',
      location: { address: 'Detroit, MI' },
    });
    expect(resume.basics.profiles).toEqual([
      { network: 'LinkedIn', url: 'https://linkedin.com/in/alex' },
      { network: 'GitHub', url: 'https://github.com/alex' },
    ]);

    // Experience and internships merge into work, preserving section order.
    expect(resume.work).toEqual([
      {
        position: 'Engineer',
        name: 'Mosaic',
        location: 'Detroit, MI',
        startDate: '2023-06',
        highlights: ['Built export flow'],
      },
      { position: 'Intern', name: 'Startup Co', endDate: '2022' },
    ]);
    expect(resume.education).toEqual([
      {
        studyType: 'B.S.',
        area: 'Computer Science',
        institution: 'University of Michigan',
        startDate: '2019',
        endDate: '2023',
        courses: ['GPA: 3.8/4.0'],
      },
    ]);
    // A project's organization is its entity; words on its right that aren't dates describe it.
    expect(resume.projects).toEqual([
      {
        name: 'Mosaic',
        entity: 'Open source',
        description: 'Modular resume builder',
        highlights: ['React 19', 'Local-first'],
      },
    ]);
    expect(resume.skills).toEqual([{ name: 'TypeScript, React' }]);
    // A certificate's date is when it was earned, and its organization gave it.
    expect(resume.certificates).toEqual([
      { name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2025-01' },
      { name: 'CKA', issuer: 'CNCF' },
    ]);
    // Everything above reads back from its fields as it was written.
    expect(resume.meta.mosaic.sections.some((section: { exact?: unknown }) => section.exact)).toBe(
      false
    );
  });

  it('reads the dates people write, and keeps the words where the fields can’t', () => {
    const data = createExportData();
    data.sections[2].entries = [
      entry({ title: 'Engineer', organization: 'Acme', dates: 'January 2021 to Present' }),
      entry({ title: 'Analyst', organization: 'Globex', dates: '03/2019 – 12/2020' }),
      entry({ title: 'Consultant', dates: 'Month Year to Current' }),
    ];

    const { work, meta } = parseExport(data);
    expect(work.slice(0, 3)).toEqual([
      { position: 'Engineer', name: 'Acme', startDate: '2021-01' },
      { position: 'Analyst', name: 'Globex', startDate: '2019-03', endDate: '2020-12' },
      // Not dates, and a job has no field for anything else.
      { position: 'Consultant' },
    ]);
    expect(meta.mosaic.sections[2].exact).toEqual({
      0: { dates: 'January 2021 to Present' },
      1: { dates: '03/2019 – 12/2020' },
      2: { dates: 'Month Year to Current' },
    });
  });

  it('splits a degree into its type and field, and keeps a school’s location in meta', () => {
    const data = createExportData();
    data.sections[1].entries = [
      entry({ title: 'M.S. in Physics', organization: 'MIT', location: 'Cambridge, MA' }),
      entry({ title: 'Physics' }),
    ];

    const { education, meta } = parseExport(data);
    expect(education).toEqual([
      { studyType: 'M.S.', area: 'Physics', institution: 'MIT' },
      { area: 'Physics' },
    ]);
    // Education has no location field.
    expect(meta.mosaic.sections[1].exact).toEqual({ 0: { location: 'Cambridge, MA' } });
  });

  it('puts custom sections under projects, keeping the section’s name', () => {
    const data = createExportData();
    data.sections.push({
      id: 'volunteering',
      kind: 'custom',
      layout: 'entries',
      label: 'Volunteering',
      entries: [entry({ title: 'Food bank', dates: '2022' }, ['Ran logistics'])],
    });

    data.sections.push({
      id: 'languages',
      kind: 'custom',
      layout: 'lines',
      label: 'Languages',
      entries: [line('English, Spanish')],
    });

    const { projects } = parseExport(data);
    expect(projects).toContainEqual({
      name: 'Food bank',
      endDate: '2022',
      type: 'Volunteering',
      highlights: ['Ran logistics'],
    });
    expect(projects).toContainEqual({ name: 'English, Spanish', type: 'Languages' });
  });

  it('records the header whole in meta.mosaic, since basics can say only part of it', () => {
    const { meta } = parseExport(createExportData());
    expect(meta.mosaic.header).toEqual({
      linkStyle: 'plain',
      lines: [
        {
          separator: ' | ',
          align: 'center',
          items: [
            { kind: 'phone', text: '555-0100', url: 'tel:5550100' },
            { kind: 'email', text: 'alex@example.com', url: 'mailto:alex@example.com' },
            { kind: 'linkedin', text: 'LinkedIn', url: 'https://linkedin.com/in/alex' },
            { kind: 'github', text: 'github.com/alex', url: 'https://github.com/alex' },
            { kind: 'site', text: 'alex.dev', url: 'https://alex.dev' },
          ],
        },
        {
          separator: ' · ',
          align: 'left',
          items: [
            { kind: 'auth', text: 'US Citizen', url: '' },
            { kind: 'location', text: 'Detroit, MI', url: '' },
          ],
        },
      ],
    });
  });

  it('records each section in meta.mosaic, so Mosaic can read the file back exactly', () => {
    const { meta } = parseExport(createExportData());
    expect(
      meta.mosaic.sections.map((s: { label: string; from: string; count: number }) => [
        s.label,
        s.from,
        s.count,
      ])
    ).toEqual([
      ['Summary', 'summary', 2],
      ['Education', 'education', 1],
      ['Experience', 'work', 1],
      ['Internships', 'work', 1],
      ['Projects', 'projects', 1],
      ['Skills', 'skills', 1],
      ['Certifications', 'certificates', 2],
    ]);
  });

  it('puts a section its kind’s array can’t hold under projects, by its name', () => {
    const data = createExportData();
    data.sections[6].entries[0].bullets = ['Renewed yearly'];
    data.sections.push({
      id: 'toolbox',
      kind: 'skills',
      layout: 'entries',
      label: 'Toolbox',
      entries: [entry({ title: 'Go', dates: 'expert' }, ['Concurrency'])],
    });

    const resume = parseExport(data);
    expect(resume).not.toHaveProperty('certificates');
    expect(resume.projects).toContainEqual({
      name: 'AWS Solutions Architect',
      entity: 'Amazon',
      endDate: '2025-01',
      type: 'Certifications',
      highlights: ['Renewed yearly'],
    });
    // Skills in entries keep what's on their right and their bullets as level and keywords.
    expect(resume.skills).toContainEqual({
      name: 'Go',
      level: 'expert',
      keywords: ['Concurrency'],
    });
  });

  it('omits empty arrays and empty contact fields', () => {
    const resume = parseExport({
      contact: { name: 'Alex', linkStyle: 'plain', linkColor: 'ink', lines: [] },
      sections: [
        {
          id: 'summary',
          kind: 'summary',
          layout: 'lines',
          label: 'Summary',
          entries: [line('Hi.')],
        },
      ],
    });

    expect(resume.basics).toEqual({ name: 'Alex', summary: 'Hi.' });
    expect(resume).not.toHaveProperty('work');
    expect(resume).not.toHaveProperty('education');
    expect(resume).not.toHaveProperty('projects');
    expect(resume).not.toHaveProperty('skills');
    expect(resume).not.toHaveProperty('certificates');
  });

  it('pretty-prints the output', () => {
    expect(createJsonResumeExport(createExportData())).toContain('\n  ');
  });
});
