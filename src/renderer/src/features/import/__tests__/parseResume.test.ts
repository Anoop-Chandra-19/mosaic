import { describe, expect, it } from 'vitest';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import { createPlaintextExport } from '@/features/export/plaintextExport';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData, ResumeSection } from '@shared/types/resume';
import { textToLines, type ImportLine } from '../importLines';
import { parseResumeLines, parseResumeText } from '../parseResume';
import { everything, shown, buildExpectedShown, createStyledHeaderResume } from './resumeFixtures';

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

/** Each header line's items as kind and text. */
const headerOf = (resume: ResumeData) =>
  resume.contact.header.lines.map((line) => line.items.map((item) => [item.kind, item.text]));

function sectionOf(sections: ResumeSection[], kind: string) {
  const section = sections.find((s) => s.kind === kind);
  if (!section) throw new Error(`missing section: ${kind}`);
  return section;
}

describe('parseResumeText', () => {
  it('reads the name, then each contact line as a header line of items', () => {
    const { resume } = parseResumeText(SAMPLE);
    expect(resume.contact.name).toBe('Jane Developer');
    // The address is an email, not a website ("jane.dev@…" holds "jane.dev").
    expect(headerOf(resume)).toEqual([
      [['location', 'San Francisco, CA']],
      [
        ['email', 'jane.dev@example.com'],
        ['phone', '(555) 987-6543'],
      ],
      [
        ['linkedin', 'linkedin.com/in/janedev'],
        ['github', 'github.com/janedev'],
      ],
    ]);
    expect(resume.contact.header.lines.map((line) => line.separator)).toEqual([
      ' | ',
      ' | ',
      '    ',
    ]);
  });

  it('takes a genuine personal website, and the separator the line uses', () => {
    const { resume } = parseResumeText(
      'Sam Lee\nsam@mail.com · sam-builds.dev\n\nSkills\nLanguages: Rust'
    );
    expect(headerOf(resume)).toEqual([
      [
        ['email', 'sam@mail.com'],
        ['site', 'sam-builds.dev'],
      ],
    ]);
    expect(resume.contact.header.lines[0].separator).toBe(' · ');
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

  it('keeps every contact-block line and field, as written, leaving none out', () => {
    const { resume, leftOut } = parseResumeText(
      [
        'Ada Lovelace',
        'Staff engineer who ships',
        'ada@example.com | Open to relocation',
        'Speaks French — LinkedIn https://linkedin.com/in/ada — Phone: 555-0100',
        '',
        'Skills',
        'Go',
      ].join('\n')
    );
    expect(resume.contact.name).toBe('Ada Lovelace');
    expect(headerOf(resume)).toEqual([
      [['custom', 'Staff engineer who ships']],
      [
        ['email', 'ada@example.com'],
        ['custom', 'Open to relocation'],
      ],
      [
        ['custom', 'Speaks French'],
        // Words, then the address they stand for: the words print, the address is the link.
        ['linkedin', 'LinkedIn'],
        ['phone', 'Phone: 555-0100'],
      ],
    ]);
    expect(resume.contact.header.lines[2].items[1].url).toBe('https://linkedin.com/in/ada');
    expect(resume.contact.header.lines[2].separator).toBe(' — ');
    expect(leftOut).toEqual([]);
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

describe('contact block', () => {
  const lineOf = (line: string) =>
    headerOf(parseResumeText(`Ada\n${line}\n\nSkills\nGo`).resume)[0];

  it('takes a work status and a location by their words', () => {
    expect(lineOf('F-1 STEM OPT, work authorized through July 2028 | Detroit, MI')).toEqual([
      ['auth', 'F-1 STEM OPT, work authorized through July 2028'],
      ['location', 'Detroit, MI'],
    ]);
  });

  it('knows the other of two fields once one of them is known', () => {
    expect(lineOf('US Citizen | Remote')).toEqual([
      ['auth', 'US Citizen'],
      ['location', 'Remote'],
    ]);
    expect(lineOf('Canadian PR | Toronto, ON')).toEqual([
      ['auth', 'Canadian PR'],
      ['location', 'Toronto, ON'],
    ]);
  });

  it('keeps links as written, and a profile written as its name', () => {
    expect(lineOf('555-0100 | https://linkedin.com/in/ada | GitHub | https://ada.dev')).toEqual([
      ['phone', '555-0100'],
      ['linkedin', 'https://linkedin.com/in/ada'],
      ['github', 'GitHub'],
      ['site', 'https://ada.dev'],
    ]);
  });

  it('takes “U.S.” for a word, not a web address', () => {
    expect(lineOf('U.S. Citizen | Boston, MA')).toEqual([
      ['auth', 'U.S. Citizen'],
      ['location', 'Boston, MA'],
    ]);
  });

  it('finds an address and a number anywhere when there is no contact block', () => {
    expect(headerOf(parseResumeText('Skills\nGo, ada@example.com').resume)).toEqual([
      [['email', 'ada@example.com']],
    ]);
  });
});

describe('plain text round trip', () => {
  const textOf = (data: ResumeData) => createPlaintextExport(normalizeResumeForExport(data));

  it('reads the example resume’s plain text back exactly', () => {
    const data = createDefaultResume();
    expect(shown(parseResumeText(textOf(data)).resume)).toEqual(shown(data));
  });

  it('reads Mosaic’s own plain text back, but for what plain text can’t say', () => {
    const data = everything();
    const expected = shown(data);
    const sectionNamed = (label: string) => expected.sections.find((s) => s.label === label)!;
    // A subtitle with no title reads as a title…
    sectionNamed('Work History').entries[1] = {
      title: '1840',
      subtitle: '',
      text: '',
      bullets: [],
    };
    // …and a section of titles alone, under a name Mosaic doesn't know, reads as a list.
    Object.assign(sectionNamed('Highlights'), {
      layout: 'lines',
      entries: [{ title: '', subtitle: '', text: 'First programmer', bullets: [] }],
    });

    expect(shown(parseResumeText(textOf(data)).resume)).toEqual(expected);
  });

  it('reads a header’s links back from their brackets, but not alignment or underlining', () => {
    const data = createStyledHeaderResume();
    expect(shown(parseResumeText(textOf(data)).resume)).toEqual(
      buildExpectedShown(data, (expected) => {
        expected.linkStyle = 'plain';
        expected.header[0].align = 'center';
        // Text can't say an address isn't linked, so one on its own links to itself.
        expected.header[0].links.push(['ada@example.com', 'mailto:ada@example.com']);
      })
    );
  });

  it('writes a link after its words, unless the words already are the address', () => {
    expect(textOf(createStyledHeaderResume()).split('\n').slice(1, 4)).toEqual([
      '555-0100 · Notes [draft] *1* (https://ada.dev/notes_(2025)) · ada@example.com',
      'F-1 OPT — authorized through 2028 — London, UK',
      'github.com/ada    Portfolio (https://ada.dev)',
    ]);
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

  it('takes a short line in capitals after a gap as a heading, in title case', () => {
    const headings = (text: string) =>
      textToLines(text).flatMap((line) => (line.role === 'heading' ? [line.text] : []));
    expect(
      headings(
        'ADA\n\nWORK HISTORY\nAnalyst\n\nVOLUNTEERING AND OUTREACH\nTutor\n\nAI RESEARCH\nNotes'
      )
    ).toEqual(['Work History', 'Volunteering and Outreach', 'Ai Research']);
    // Only where the headings Mosaic knows are in capitals too, and only after a gap.
    expect(headings('ADA\n\nWork History\nAnalyst\n\nVOLUNTEERING\nTutor')).toEqual([
      'Work History',
    ]);
    expect(headings('ADA\n\nWORK HISTORY\nACME CORP\nAnalyst')).toEqual(['Work History']);
  });
});
