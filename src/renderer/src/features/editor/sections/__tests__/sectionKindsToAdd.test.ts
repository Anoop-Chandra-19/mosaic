import { describe, expect, it } from 'vitest';
import type { ResumeSection, SectionKind } from '@shared/types/resume';
import { findLastSectionOfKind, sectionKindsToAdd } from '../sectionKindsToAdd';

const sections = (...kinds: SectionKind[]): ResumeSection[] =>
  kinds.map((kind, order) => ({
    id: `${kind}-${order}`,
    kind,
    layout: 'entries',
    label: kind,
    order,
    items: [],
  }));

describe('sectionKindsToAdd', () => {
  it('offers the kinds not on the resume, then another of those on it, in the resume’s order', () => {
    const { missing, again } = sectionKindsToAdd(
      sections('summary', 'projects', 'experience', 'custom', 'projects')
    );
    expect(missing).toEqual([
      'education',
      'internships',
      'skills',
      'certifications',
      'volunteering',
      'awards',
      'publications',
      'languages',
      'interests',
    ]);
    // One summary is all JSON Resume holds; a custom section has no kind to repeat.
    expect(again).toEqual(['projects', 'experience']);
  });

  it('puts another below the last of its kind', () => {
    expect(findLastSectionOfKind(sections('projects', 'skills', 'projects'), 'projects')).toBe(
      'projects-2'
    );
  });
});
