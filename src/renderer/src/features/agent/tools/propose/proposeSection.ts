import { hasSameWords } from '@/lib/resume/hasSameWords';
import { findLastSectionOfKind, isSingleKind } from '@/lib/resume/sectionKindsToAdd';
import type { ProposalChange } from '@/types/agentProposal';
import { BUILT_IN_KINDS, SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type {
  BuiltInSectionKind,
  ResumeSection,
  SectionKind,
  SectionLayout,
} from '@shared/types/resume';
import type { ToolCallContext } from '../tool-run/agentToolRun';
import {
  findSectionInReceipt,
  handlesOf,
  isProblem,
  openReceipt,
  type Problem,
} from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import type { ProposeTool } from './toolReadings';

/** The kind, layout and heading of the section to make, with a note when the kind was adjusted. */
interface NewSection {
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  adjustments: string[];
}

/** Compare two headings by their words, ignoring case and spacing. */
const isSameHeading = (one: string, other: string) =>
  hasSameWords(one.toLowerCase(), other.toLowerCase());

const fromPreset = (kind: BuiltInSectionKind, label: string | undefined): NewSection => ({
  kind,
  layout: SECTION_PRESETS[kind].layout,
  label: label || SECTION_PRESETS[kind].label,
  adjustments: [],
});

/**
 * Read which section the call asks for. A custom section named as a preset is taken as
 * that preset, because the preset knows whether it holds lines or entries. An empty custom
 * section has the lines layout until its first contents decide.
 */
function readNewSection(kind: SectionKind, label: string | undefined): NewSection | Problem {
  if (kind !== 'custom') return fromPreset(kind, label);
  if (!label) return { problem: TOOL_FACTS.customSectionNeedsLabel };
  const preset = BUILT_IN_KINDS.find((each) => isSameHeading(SECTION_PRESETS[each].label, label));
  if (!preset) return { kind, layout: 'lines', label, adjustments: [] };
  const taken = fromPreset(preset, label);
  return { ...taken, adjustments: [`Took custom "${label}" as the ${preset} preset.`] };
}

/**
 * Return the problem when the resume can't take this section: a second Summary, or a
 * heading the resume already has. The answer names the section that is there, and the
 * tool that adds to it.
 */
function findExistingSectionProblem(
  context: ToolCallContext,
  sections: ResumeSection[],
  { kind, label }: NewSection
): Problem | null {
  const handleOf = (section: ResumeSection) => handlesOf(context.run, [section.id])[0];
  const summary =
    kind !== 'custom' && isSingleKind(kind) && sections.find((each) => each.kind === kind);
  if (summary) return { problem: TOOL_FACTS.oneSummary(handleOf(summary)) };
  const sameHeading = sections.find((each) => isSameHeading(each.label, label));
  if (!sameHeading) return null;
  return {
    problem: TOOL_FACTS.sectionExists(sameHeading.label, handleOf(sameHeading), sameHeading.layout),
  };
}

/**
 * Return the id of the section the new one goes after. A null id puts it first. Left
 * out, a preset goes below the last section of its kind, as the Add section menu puts it,
 * and anything else goes last.
 */
function findPreviousSection(
  context: ToolCallContext,
  sections: ResumeSection[],
  kind: SectionKind,
  after: string | undefined
): { id: string | null } | Problem {
  if (after === 'start') return { id: null };
  if (after) {
    const section = findSectionInReceipt(context, after);
    return isProblem(section) ? section : { id: section.id };
  }
  const lastOfKind = kind === 'custom' ? undefined : findLastSectionOfKind(sections, kind);
  return { id: lastOfKind ?? sections.at(-1)?.id ?? null };
}

/** Note the other sections of the same preset, which the user may have meant. */
function noteSameKind(context: ToolCallContext, sections: ResumeSection[], kind: SectionKind) {
  if (kind === 'custom') return [];
  const sameKind = sections.filter((each) => each.kind === kind);
  const handles = handlesOf(
    context.run,
    sameKind.map((each) => each.id)
  );
  return sameKind.map(
    (each, index) => `${handles[index]}, ${each.label}, is ${describePreset(kind)} section too.`
  );
}

const describePreset = (kind: BuiltInSectionKind) =>
  `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}`;

/**
 * Propose a new section with nothing in it. The model fills it with `propose_entry` or
 * `propose_add`, and what it puts in goes into this suggestion.
 */
export const proposeSection: ProposeTool<'propose_section'> = (context, args) => {
  const receipt = openReceipt(context);
  if (isProblem(receipt)) return receipt;
  const sections = [...receipt.doc.sections].sort((a, b) => a.order - b.order);
  const section = readNewSection(args.kind, args.label?.trim());
  if (isProblem(section)) return section;
  const existing = findExistingSectionProblem(context, sections, section);
  if (existing) return existing;
  const previous = findPreviousSection(context, sections, section.kind, args.after);
  if (isProblem(previous)) return previous;

  const { adjustments, ...made } = section;
  const change: ProposalChange = {
    kind: 'section',
    afterSectionId: previous.id,
    section: made,
    contents: null,
  };
  return [
    {
      changes: [{ change, source: 'section', reason: args.reason }],
      adjustments: [...adjustments, ...noteSameKind(context, sections, section.kind)],
      summary: '',
    },
  ];
};
