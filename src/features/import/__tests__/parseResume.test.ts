import { describe, expect, it } from 'vitest';
import { textToLines, type ImportLine } from '../importLines';
import { parseResumeLines, parseResumeText } from '../parseResume';
import type { ResumeSection } from '@/types/resume';

const SAMPLE = `Jane Developer
San Francisco, CA
jane.dev@example.com | (555) 987-6543
linkedin.com/in/janedev  github.com/janedev

Professional Summary
Full-stack engineer with 5 years building web apps. Loves TypeScript and clean UX.

Work Experience
Senior Engineer
Acme Corp — Jan 2021 – Present
- Led migration to a microservices architecture
- Mentored three junior engineers

Software Engineer
StartupXYZ — 2019 – 2021
• Built a React dashboard used by 10k users

Skills
Languages: TypeScript, Python, Go
Frameworks: React, Next.js

Certifications
AWS Certified Solutions Architect
Google Cloud Professional
`;

function sectionOf(sections: ResumeSection[], kind: string) {
  const section = sections.find((s) => s.kind === kind);
  if (!section) throw new Error(`missing section: ${kind}`);
  return section;
}

describe('parseResumeText', () => {
  it('extracts contact details from the preamble', () => {
    const { resume } = parseResumeText(SAMPLE);
    expect(resume.contact.name).toBe('Jane Developer');
    expect(resume.contact.email).toBe('jane.dev@example.com');
    expect(resume.contact.phone).toBe('(555) 987-6543');
    expect(resume.contact.location).toBe('San Francisco, CA');
    expect(resume.contact.linkedin).toBe('linkedin.com/in/janedev');
    expect(resume.contact.github).toBe('github.com/janedev');
    // The email must not leak into website (jane.dev@... should NOT yield "jane.dev").
    expect(resume.contact.website).toBe('');
  });

  it('captures a genuine personal website without the email fragment', () => {
    const { resume } = parseResumeText(
      'Sam Lee\nsam@mail.com · sam-builds.dev\n\nSkills\nLanguages: Rust'
    );
    expect(resume.contact.website).toBe('sam-builds.dev');
  });

  it('maps headings to kinds and shapes, keeping each heading as written', () => {
    const { resume } = parseResumeText(SAMPLE);
    expect(resume.sections.map((s) => [s.kind, s.layout, s.label])).toEqual([
      ['summary', 'lines', 'Professional Summary'],
      ['experience', 'entries', 'Work Experience'],
      ['skills', 'lines', 'Skills'],
      ['certifications', 'entries', 'Certifications'],
    ]);
    expect(resume.sections.map((s) => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('puts the summary in a single text entry with no bullets', () => {
    const { resume } = parseResumeText(SAMPLE);
    const summary = sectionOf(resume.sections, 'summary');
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0].text).toContain('Full-stack engineer');
    expect(summary.items[0].bullets).toHaveLength(0);
  });

  it('groups experience blocks into title/subtitle entries with bullets', () => {
    const { resume } = parseResumeText(SAMPLE);
    const experience = sectionOf(resume.sections, 'experience');
    expect(experience.items).toHaveLength(2);

    const [first, second] = experience.items;
    expect(first.title).toBe('Senior Engineer');
    expect(first.subtitle).toBe('Acme Corp — Jan 2021 – Present');
    expect(first.bullets.map((b) => b.text)).toEqual([
      'Led migration to a microservices architecture',
      'Mentored three junior engineers',
    ]);
    expect(second.title).toBe('Software Engineer');
    expect(second.bullets).toHaveLength(1);
  });

  it('maps each skills line to its own text entry', () => {
    const { resume } = parseResumeText(SAMPLE);
    const skills = sectionOf(resume.sections, 'skills');
    expect(skills.items.map((i) => i.text)).toEqual([
      'Languages: TypeScript, Python, Go',
      'Frameworks: React, Next.js',
    ]);
  });

  it('splits a bullet-less list block into one entry per line', () => {
    const { resume } = parseResumeText(SAMPLE);
    const certs = sectionOf(resume.sections, 'certifications');
    expect(certs.items.map((i) => i.title)).toEqual([
      'AWS Certified Solutions Architect',
      'Google Cloud Professional',
    ]);
  });

  it('marks all imported entries and bullets as selected', () => {
    const { resume } = parseResumeText(SAMPLE);
    for (const section of resume.sections) {
      for (const item of section.items) {
        expect(item.selected).toBe(true);
        expect(item.bullets.every((b) => b.selected)).toBe(true);
      }
    }
  });

  it('leaves nothing out of a resume it can place in full', () => {
    expect(parseResumeText(SAMPLE).leftOut).toEqual([]);
  });

  it('lists a contact-block line that is no contact field as left out', () => {
    const { resume, leftOut } = parseResumeText(
      'Jane Developer\nStaff engineer who ships\njane@example.com\n\nSkills\nGo'
    );
    expect(resume.contact.name).toBe('Jane Developer');
    expect(leftOut).toEqual(['Staff engineer who ships']);
  });

  it('warns and returns empty sections for unrecognized input without throwing', () => {
    const { resume, warnings } = parseResumeText('just some random text with no structure');
    expect(resume.sections).toHaveLength(0);
    expect(warnings.some((w) => w.includes('No recognizable resume sections'))).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const { resume, warnings } = parseResumeText('');
    expect(resume.sections).toHaveLength(0);
    expect(resume.contact.name).toBe('');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('parseResumeLines', () => {
  // Lines as a styled source (a DOCX, a PDF) marks them: one logical line each.
  const lines: ImportLine[] = [
    { text: 'Ada Lovelace' },
    { text: 'ada@example.com | (555) 010-0100' },
    { text: 'Work History', role: 'heading' },
    { text: 'Analyst at Babbage & Co', role: 'entry', aside: '1842 to 1843' },
    { text: 'Wrote the first program', role: 'bullet' },
    { text: '', role: 'entry', aside: '1840' },
    { text: 'Summary', role: 'heading' },
    { text: 'First line of the summary.' },
    { text: 'A second summary item.' },
    { text: 'Leadership', role: 'heading' },
    { text: 'Chair, Analytical Society', role: 'entry' },
    { text: 'Toolbox', role: 'heading' },
    { text: 'Punched cards, Difference engines' },
  ];

  it('starts an entry at each marked line, taking the aside as its subtitle', () => {
    const { resume } = parseResumeLines(lines);
    const work = sectionOf(resume.sections, 'experience');
    expect(work.label).toBe('Work History');
    expect(
      work.items.map(({ title, subtitle, bullets }) => [title, subtitle, bullets.length])
    ).toEqual([
      ['Analyst at Babbage & Co', '1842 to 1843', 1],
      [undefined, '1840', 0],
    ]);
  });

  it('keeps logical lines apart, even in a summary', () => {
    const { resume } = parseResumeLines(lines);
    expect(sectionOf(resume.sections, 'summary').items.map((item) => item.text)).toEqual([
      'First line of the summary.',
      'A second summary item.',
    ]);
  });

  it('takes a marked section’s shape from its marks, not from its heading', () => {
    const { resume } = parseResumeLines([
      { text: 'Skills', role: 'heading' },
      { text: 'Languages', role: 'entry' },
      { text: 'TypeScript and Go', role: 'bullet' },
    ]);
    expect(resume.sections.map((s) => [s.kind, s.layout])).toEqual([['skills', 'entries']]);
  });

  it('makes a heading it does not know a custom section, shaped like its body', () => {
    const { resume } = parseResumeLines(lines);
    const custom = resume.sections.filter((s) => s.kind === 'custom');
    expect(custom.map((s) => [s.label, s.layout, s.items.length])).toEqual([
      ['Leadership', 'entries', 1],
      ['Toolbox', 'lines', 1],
    ]);
  });

  it('lists a heading with nothing under it as left out', () => {
    const { resume, leftOut } = parseResumeLines([
      { text: 'Awards', role: 'heading' },
      { text: 'Skills', role: 'heading' },
      { text: 'Go' },
    ]);
    expect(resume.sections.map((s) => s.label)).toEqual(['Skills']);
    expect(leftOut).toEqual(['Awards']);
  });
});

describe('textToLines', () => {
  it('turns blank lines into gaps, markers into bullets, and known names into headings', () => {
    expect(textToLines('Jane\n\nSkills\n- Go\n\n  Rust  ')).toEqual([
      { text: 'Jane' },
      { text: 'Skills', role: 'heading', gapBefore: true },
      { text: 'Go', role: 'bullet' },
      { text: 'Rust', gapBefore: true },
    ]);
  });
});
