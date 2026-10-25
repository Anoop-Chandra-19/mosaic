import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { EntryFact } from '@shared/types/agentProposal';
import type { ResumeSection } from '@shared/types/resume';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findEntryInSection, findSectionInReceipt, isProblem, type Problem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

type EntryArgs = AgentToolArgs['propose_entry'];

const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/**
 * The entry the new one goes after, as the change names it: none to go first ("start",
 * or an empty section), the last one when `after` is left out.
 */
function findPreviousEntry(
  run: AgentToolRun,
  section: ResumeSection,
  after: string | undefined
): { id: string | undefined } | Problem {
  if (after === 'start') return { id: undefined };
  if (!after) return { id: section.items.at(-1)?.id };
  const entry = findEntryInSection(run, section, after);
  return isProblem(entry) ? entry : { id: entry.id };
}

/** A new entry, with only the facts the model gave: the user confirms each one. */
export function proposeEntry(run: AgentToolRun, args: EntryArgs): ToolAnswer {
  const section = findSectionInReceipt(run, args.sectionId);
  if (isProblem(section)) return refuse(section.problem);
  if (section.layout === 'lines') {
    return refuse(`${args.sectionId} holds lines, not entries. Pick a section with entries.`);
  }
  const previousEntry = findPreviousEntry(run, section, args.after);
  if (isProblem(previousEntry)) return refuse(previousEntry.problem);

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
  return stageSuggestions(run, [{ change, source: 'entry', reason: args.reason }]);
}
