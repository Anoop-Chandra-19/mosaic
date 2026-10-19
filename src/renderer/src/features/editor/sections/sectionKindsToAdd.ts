import { BUILT_IN_KINDS } from '@shared/resume/sectionPresets';
import type { BuiltInSectionKind, ResumeSection } from '@shared/types/resume';

/** One summary is what JSON Resume holds, so it is never offered twice. */
const SINGLE_KINDS: ReadonlySet<BuiltInSectionKind> = new Set(['summary']);

/**
 * What Add section offers: the kinds the resume doesn't have yet, in menu order, and the
 * ones it has, to add another like them, in the resume's order. `sections` in their order.
 */
export function sectionKindsToAdd(sections: ResumeSection[]): {
  missing: BuiltInSectionKind[];
  again: BuiltInSectionKind[];
} {
  const used = [
    ...new Set(sections.flatMap((section) => (section.kind === 'custom' ? [] : [section.kind]))),
  ];
  return {
    missing: BUILT_IN_KINDS.filter((kind) => !used.includes(kind)),
    again: used.filter((kind) => !SINGLE_KINDS.has(kind)),
  };
}

/** The last section of `kind`, which another like it goes below. */
export function findLastSectionOfKind(
  sections: ResumeSection[],
  kind: BuiltInSectionKind
): string | undefined {
  return sections.findLast((section) => section.kind === kind)?.id;
}
