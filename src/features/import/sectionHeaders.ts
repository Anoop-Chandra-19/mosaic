import type { BuiltInSectionKind } from '@/types/resume';

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

// Flattened alias → kind list, longest phrase first for greedy matching.
const ALIAS_ENTRIES: { phrase: string; kind: BuiltInSectionKind }[] = Object.entries(HEADER_ALIASES)
  .flatMap(([kind, phrases]) =>
    phrases.map((phrase) => ({ phrase, kind: kind as BuiltInSectionKind }))
  )
  .sort((a, b) => b.phrase.length - a.phrase.length);

function normalizeHeading(line: string): string {
  return line
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z&]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * If `line` looks like a section heading, return its kind. A heading is a short,
 * standalone line whose normalized text exactly matches a known alias — this avoids
 * treating ordinary sentences that happen to contain "experience" as headings.
 */
export function matchSectionHeader(line: string): BuiltInSectionKind | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40 || trimmed.split(/\s+/).length > 5) return null;

  const normalized = normalizeHeading(trimmed);
  if (!normalized) return null;

  const match = ALIAS_ENTRIES.find((entry) => entry.phrase === normalized);
  return match ? match.kind : null;
}
