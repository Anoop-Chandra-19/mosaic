import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type { BuiltInSectionKind, SectionKind, SectionLayout } from '@shared/types/resume';

/**
 * A section Mosaic knows by its heading: a built-in kind, or one of JSON Resume's other
 * sections, which import as a custom section of this name and shape.
 */
export interface KnownSection {
  kind: SectionKind;
  label: string;
  layout: SectionLayout;
}

/**
 * Header phrases (normalized: lowercase, no surrounding punctuation) that map a resume
 * section heading to a built-in section kind. Longer/more specific phrases are matched
 * before shorter ones so "work experience" wins over "experience".
 */
const HEADER_ALIASES: Record<BuiltInSectionKind, string[]> = {
  summary: [
    'professional summary',
    'career summary',
    'summary of qualifications',
    'summary',
    'professional profile',
    'profile',
    'career objective',
    'objective',
    'about me',
    'about',
  ],
  education: [
    'education',
    'academic background',
    'academics',
    'education & training',
    // The Headless format's own heading, as the example resume has it.
    'education & certificates',
    'education & certifications',
    'education and certifications',
  ],
  experience: [
    'professional experience',
    'work experience',
    'employment history',
    'work history',
    'professional background',
    'relevant experience',
    'experience',
    'employment',
  ],
  internships: ['internship experience', 'internships', 'internship'],
  projects: [
    'personal projects',
    'academic projects',
    'notable projects',
    'selected projects',
    'projects',
  ],
  skills: [
    'technical skills',
    'core skills',
    'technical proficiencies',
    'areas of expertise',
    'skills & abilities',
    'technologies',
    'competencies',
    'skills',
  ],
  certifications: [
    'licenses and certifications',
    'licenses & certifications',
    'professional certifications',
    'certifications',
    'certification',
    'certificates',
    'licenses',
  ],
};

/** JSON Resume's sections that have no built-in kind, by their key in a JSON Resume file. */
export type JsonResumeCustomSection =
  | 'volunteer'
  | 'awards'
  | 'publications'
  | 'languages'
  | 'interests';

/**
 * The rest of JSON Resume's sections, as custom sections: their name and shape, and the
 * headings that mean them. Its `references` have no place in a resume Mosaic prints.
 */
export const JSON_RESUME_CUSTOM_SECTIONS: Record<
  JsonResumeCustomSection,
  { label: string; layout: SectionLayout; aliases: string[] }
> = {
  volunteer: {
    label: 'Volunteering',
    layout: 'entries',
    aliases: ['volunteer experience', 'volunteer work', 'volunteering', 'volunteer'],
  },
  awards: {
    label: 'Awards',
    layout: 'entries',
    aliases: [
      'honors and awards',
      'awards and honors',
      'honors & awards',
      'awards & honors',
      'honours & awards',
      'awards & honours',
      'awards',
      'honors',
      'honours',
    ],
  },
  publications: {
    label: 'Publications',
    layout: 'entries',
    aliases: ['selected publications', 'publications'],
  },
  languages: { label: 'Languages', layout: 'lines', aliases: ['languages'] },
  interests: {
    label: 'Interests',
    layout: 'lines',
    aliases: ['hobbies and interests', 'hobbies & interests', 'interests', 'hobbies'],
  },
};

// Every heading phrase with the section it names, longest first for greedy matching.
const ALIAS_ENTRIES: { phrase: string; section: KnownSection }[] = [
  ...Object.entries(HEADER_ALIASES).flatMap(([kind, phrases]) => {
    const { label, layout } = SECTION_PRESETS[kind as BuiltInSectionKind];
    return phrases.map((phrase) => ({
      phrase,
      section: { kind: kind as BuiltInSectionKind, label, layout },
    }));
  }),
  ...Object.values(JSON_RESUME_CUSTOM_SECTIONS).flatMap(({ label, layout, aliases }) =>
    aliases.map((phrase) => ({ phrase, section: { kind: 'custom' as const, label, layout } }))
  ),
].sort((a, b) => b.phrase.length - a.phrase.length);

function normalizeHeading(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z&]+$/g, '')
    .replace(/\s+/g, ' ');
}

/** The most characters a heading, or a date set on the right of a line, runs to. */
export const SHORT_LINE_LENGTH = 40;

/** Short enough to be a heading: a few words on a line of their own. */
export function isHeadingLength(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== '' && trimmed.length <= SHORT_LINE_LENGTH && trimmed.split(/\s+/).length <= 5;
}

/**
 * If `line` looks like a section heading, return the section it names. A heading is a
 * short, standalone line whose normalized text exactly matches a known alias — this avoids
 * treating ordinary sentences that happen to contain "experience" as headings.
 */
export function matchSectionHeader(line: string): KnownSection | null {
  const trimmed = line.trim();
  if (!isHeadingLength(trimmed)) return null;

  const normalized = normalizeHeading(trimmed);
  if (!normalized) return null;

  const match = ALIAS_ENTRIES.find((entry) => entry.phrase === normalized);
  return match ? match.section : null;
}
