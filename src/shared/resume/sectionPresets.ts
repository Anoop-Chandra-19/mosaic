import type { BuiltInSectionKind, SectionLayout } from '../types/resume';

/**
 * The built-in sections: a kind with a starting name and a shape. Any of them can be added
 * any number of times, renamed, and they print only by their layout.
 */
export const SECTION_PRESETS: Record<BuiltInSectionKind, { label: string; layout: SectionLayout }> =
  {
    summary: { label: 'Summary', layout: 'lines' },
    education: { label: 'Education', layout: 'entries' },
    experience: { label: 'Experience', layout: 'entries' },
    internships: { label: 'Internships', layout: 'entries' },
    projects: { label: 'Projects', layout: 'entries' },
    skills: { label: 'Skills', layout: 'lines' },
    certifications: { label: 'Certifications', layout: 'entries' },
  };

/** Every built-in kind, in the order menus list them. */
export const BUILT_IN_KINDS = Object.keys(SECTION_PRESETS) as BuiltInSectionKind[];

/** A custom section's name until the user gives it one — its name opens for editing. */
export const NEW_CUSTOM_SECTION_LABEL: Record<SectionLayout, string> = {
  entries: 'New section',
  lines: 'New list',
};
