import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../parseResumeText';
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

function sectionOf(sections: ResumeSection[], type: string) {
  const section = sections.find((s) => s.type === type);
  if (!section) throw new Error(`missing section: ${type}`);
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

  it('maps headings to the correct section types and canonical labels', () => {
    const { resume } = parseResumeText(SAMPLE);
    const types = resume.sections.map((s) => s.type);
    expect(types).toEqual(['summary', 'experience', 'skills', 'certifications']);
    expect(sectionOf(resume.sections, 'experience').label).toBe('Work Experience');
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
