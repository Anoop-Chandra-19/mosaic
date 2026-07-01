import type { SectionType } from '@/types/resume';

/**
 * Canonical label used for each section type when a resume is imported. Mirrors the
 * labels seeded in DEFAULT_RESUME so imported sections read consistently with new ones.
 */
export const SECTION_LABELS: Record<SectionType, string> = {
  summary: 'Professional Summary',
  education: 'Education',
  experience: 'Work Experience',
  internships: 'Internships',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
};

/**
 * Header phrases (normalized: lowercase, no surrounding punctuation) that map a resume
 * section heading to a Mosaic SectionType. Longer/more specific phrases are matched
 * before shorter ones so "work experience" wins over "experience".
 */
const HEADER_ALIASES: Record<SectionType, string[]> = {
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
  education: ['education', 'academic background', 'academics', 'education & training'],
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

// Flattened alias → type list, longest phrase first for greedy matching.
const ALIAS_ENTRIES: { phrase: string; type: SectionType }[] = Object.entries(HEADER_ALIASES)
  .flatMap(([type, phrases]) => phrases.map((phrase) => ({ phrase, type: type as SectionType })))
  .sort((a, b) => b.phrase.length - a.phrase.length);

function normalizeHeading(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z&]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * If `line` looks like a section heading, return its SectionType. A heading is a short,
 * standalone line whose normalized text exactly matches a known alias — this avoids
 * treating ordinary sentences that happen to contain "experience" as headings.
 */
export function matchSectionHeader(line: string): SectionType | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40 || trimmed.split(/\s+/).length > 5) return null;

  const normalized = normalizeHeading(trimmed);
  if (!normalized) return null;

  const match = ALIAS_ENTRIES.find((entry) => entry.phrase === normalized);
  return match ? match.type : null;
}
