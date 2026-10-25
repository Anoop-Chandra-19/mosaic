import type { EntryFact } from '@shared/types/agentProposal';
import type { ResumeSection } from '@shared/types/resume';
import type { ToolCallContext } from '../agentToolRun';
import {
  findEntryInSection,
  findSectionInReceipt,
  handlesOf,
  isProblem,
  openReceipt,
  type Problem,
} from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import { oneReading, type ProposeTool } from './toolReadings';

const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/**
 * The entry the new one goes after, as the change names it: none to go first ("start",
 * or an empty section), the last one when `after` is left out.
 */
function findPreviousEntry(
  context: ToolCallContext,
  section: ResumeSection,
  after: string | undefined
): { id: string | undefined } | Problem {
  if (after === 'start') return { id: undefined };
  if (!after) return { id: section.items.at(-1)?.id };
  const entry = findEntryInSection(context, section, after);
  return isProblem(entry) ? entry : { id: entry.id };
}

/** The facts for an entry aimed at a section of lines: which sections hold entries. */
function describeLinesSection(context: ToolCallContext, sectionHandle: string): Problem {
  const receipt = openReceipt(context);
  const sections = isProblem(receipt) ? [] : receipt.doc.sections;
  const withEntries = sections.filter((section) => section.layout === 'entries');
  const handles = handlesOf(
    context.run,
    withEntries.map((section) => section.id)
  );
  return { problem: TOOL_FACTS.sectionHoldsLines(sectionHandle, handles) };
}

/** A new entry, with only the facts the model gave: the user confirms each one. */
export const proposeEntry: ProposeTool<'propose_entry'> = (context, args) => {
  const section = findSectionInReceipt(context, args.sectionId);
  if (isProblem(section)) return section;
  if (section.layout === 'lines') return describeLinesSection(context, args.sectionId);
  const previousEntry = findPreviousEntry(context, section, args.after);
  if (isProblem(previousEntry)) return previousEntry;

  const frame: Partial<Record<EntryFact, string>> = {};
  for (const fact of ENTRY_FACTS) {
    const given = args[fact]?.trim();
    if (given) frame[fact] = given;
  }
  const change = {
    kind: 'entry' as const,
    sectionId: section.id,
    afterEntryId: previousEntry.id,
    frame,
    bullets: (args.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean),
  };
  return oneReading({ change, source: 'entry', reason: args.reason });
};
