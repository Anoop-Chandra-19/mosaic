import { describe, expect, it } from 'vitest';
import { createJsonResumeExport } from '../jsonResume';
import type { NormalizedResumeExport } from '../normalizeResumeExport';

function createExportData(): NormalizedResumeExport {
  return {
    contact: {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      location: 'Detroit, MI',
      citizenshipStatus: '',
      linkedin: 'linkedin.com/in/alex',
      github: 'github.com/alex',
      website: 'alex.dev',
    },
    sections: [
      {
        id: 'summary',
        kind: 'summary',
        layout: 'lines',
        label: 'Summary',
        entries: [
          { id: 's1', title: '', subtitle: '', text: 'Focused builder.', bullets: [] },
          { id: 's2', title: '', subtitle: '', text: 'Open-source fan.', bullets: [] },
        ],
      },
      {
        id: 'education',
        kind: 'education',
        layout: 'entries',
        label: 'Education',
        entries: [
          {
            id: 'e1',
            title: 'B.S. Computer Science',
            subtitle: 'University of Michigan',
            text: '',
            bullets: ['GPA: 3.8/4.0'],
            startDate: '2019-09',
            endDate: '2023-05',
          },
        ],
      },
      {
        id: 'experience',
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        entries: [
          {
            id: 'j1',
            title: 'Engineer',
            subtitle: 'Mosaic',
            text: '',
            bullets: ['Built export flow'],
            startDate: '2023-06',
          },
        ],
      },
      {
        id: 'internships',
        kind: 'internships',
        layout: 'entries',
        label: 'Internships',
        entries: [
          {
            id: 'i1',
            title: 'Intern',
            subtitle: 'Startup Co',
            text: '',
            bullets: [],
          },
        ],
      },
      {
        id: 'projects',
        kind: 'projects',
        layout: 'entries',
        label: 'Projects',
        entries: [
          {
            id: 'p1',
            title: 'Mosaic',
            subtitle: 'Modular resume builder',
            text: '',
            bullets: ['React 19', 'Local-first'],
          },
        ],
      },
      {
        id: 'skills',
        kind: 'skills',
        layout: 'lines',
        label: 'Skills',
        entries: [{ id: 'sk1', title: '', subtitle: '', text: 'TypeScript, React', bullets: [] }],
      },
      {
        id: 'certifications',
        kind: 'certifications',
        layout: 'entries',
        label: 'Certifications',
        entries: [
          {
            id: 'c1',
            title: 'AWS Solutions Architect',
            subtitle: 'Amazon',
            text: '',
            bullets: [],
            startDate: '2024-01',
            endDate: '2025-01',
          },
        ],
      },
    ],
  };
}

function parseExport(data: NormalizedResumeExport) {
  return JSON.parse(createJsonResumeExport(data));
}

describe('createJsonResumeExport', () => {
  it('maps every section kind to the JSON Resume schema', () => {
    const resume = parseExport(createExportData());

    expect(resume.$schema).toBe(
      'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json'
    );
    expect(resume.basics).toMatchObject({
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      url: 'alex.dev',
      summary: 'Focused builder.\n\nOpen-source fan.',
      location: { address: 'Detroit, MI' },
    });
    expect(resume.basics.profiles).toEqual([
      { network: 'LinkedIn', url: 'linkedin.com/in/alex' },
      { network: 'GitHub', url: 'github.com/alex' },
    ]);

    // Experience and internships merge into work, preserving section order.
    expect(resume.work).toEqual([
      {
        name: 'Mosaic',
        position: 'Engineer',
        startDate: '2023-06',
        highlights: ['Built export flow'],
      },
      { name: 'Startup Co', position: 'Intern' },
    ]);

    expect(resume.education).toEqual([
      {
        institution: 'University of Michigan',
        area: 'B.S. Computer Science',
        startDate: '2019-09',
        endDate: '2023-05',
        courses: ['GPA: 3.8/4.0'],
      },
    ]);
    expect(resume.projects).toEqual([
      {
        name: 'Mosaic',
        description: 'Modular resume builder',
        highlights: ['React 19', 'Local-first'],
      },
    ]);
    expect(resume.skills).toEqual([{ name: 'TypeScript, React' }]);
    expect(resume.certificates).toEqual([
      { name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2025-01' },
    ]);
  });

  it('puts custom sections under projects, keeping the section’s name', () => {
    const data = createExportData();
    data.sections.push({
      id: 'volunteering',
      kind: 'custom',
      layout: 'entries',
      label: 'Volunteering',
      entries: [
        { id: 'v1', title: 'Food bank', subtitle: '2022', text: '', bullets: ['Ran logistics'] },
      ],
    });

    data.sections.push({
      id: 'languages',
      kind: 'custom',
      layout: 'lines',
      label: 'Languages',
      entries: [{ id: 'l1', title: '', subtitle: '', text: 'English, Spanish', bullets: [] }],
    });

    const { projects } = parseExport(data);
    expect(projects).toContainEqual({
      name: 'Food bank',
      description: '2022',
      type: 'Volunteering',
      highlights: ['Ran logistics'],
    });
    expect(projects).toContainEqual({ name: 'English, Spanish', type: 'Languages' });
  });

  it('falls back to startDate for certificates without an endDate', () => {
    const data = createExportData();
    const cert = data.sections.find((s) => s.kind === 'certifications')!.entries[0];
    delete cert.endDate;

    const resume = parseExport(data);
    expect(resume.certificates[0].date).toBe('2024-01');
  });

  it('omits empty arrays and empty contact fields', () => {
    const resume = parseExport({
      contact: {
        name: 'Alex',
        email: '',
        phone: '',
        location: '',
        citizenshipStatus: '',
        linkedin: '',
        github: '',
        website: '',
      },
      sections: [
        {
          id: 'summary',
          kind: 'summary',
          layout: 'lines',
          label: 'Summary',
          entries: [{ id: 's1', title: '', subtitle: '', text: 'Hi.', bullets: [] }],
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
