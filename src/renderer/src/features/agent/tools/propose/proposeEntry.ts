import type { EntryFact } from '@/types/agentProposal';
import type { ResumeSection } from '@shared/types/resume';
import type { ToolCallContext } from '../tool-run/agentToolRun';
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
 * Resolve the preceding entry's ID. "start" or an empty section means no predecessor;
 * omitting `after` places the new entry after the section's last entry.
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

/** Refuse an entry in a lines section and list sections that accept entries. */
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

/** Propose a new entry using only model-supplied facts, each requiring user confirmation. */
export const proposeEntry: ProposeTool<'propose_entry'> = (context, args) => {
  const section = findSectionInReceipt(context, args.sectionId);
  if (isProblem(section)) return section;
  // An empty custom section the assistant made holds whatever goes in first.
  const takesEither = section.kind === 'custom' && context.emptySectionIds.has(section.id);
  if (section.layout === 'lines' && !takesEither) {
    return describeLinesSection(context, args.sectionId);
  }
  const previousEntry = findPreviousEntry(context, section, args.after);
  if (isProblem(previousEntry)) return previousEntry;
  // A bullet given here can't come with a version without a number, but propose_add can.
  // So a bullet that needs a number is refused here and goes through propose_add.
  const bullets = (args.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean);
  if (bullets.some((bullet) => bullet.includes('{{?}}'))) {
    return { problem: TOOL_FACTS.gapInEntryBullet };
  }

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
    bullets,
  };
  return oneReading({ change, source: 'entry', reason: args.reason });
};
