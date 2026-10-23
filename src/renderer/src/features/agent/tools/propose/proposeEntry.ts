import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { EntryFact } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findEntryInSection, findSectionInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/** A new entry, with only the facts the model gave: the user confirms each one. */
export function proposeEntry(run: AgentToolRun, args: AgentToolArgs['propose_entry']): ToolAnswer {
  const section = findSectionInReceipt(run, args.sectionId);
  if (isProblem(section)) return refuse(section.problem);
  if (section.layout === 'lines') {
    return refuse(`${args.sectionId} holds lines, not entries. Pick a section with entries.`);
  }

  let previousEntry;
  if (args.afterEntryId) {
    previousEntry = findEntryInSection(run, section, args.afterEntryId);
    if (isProblem(previousEntry)) return refuse(previousEntry.problem);
  }

  const frame: Partial<Record<EntryFact, string>> = {};
  for (const fact of ENTRY_FACTS) {
    const given = args[fact]?.trim();
    if (given) frame[fact] = given;
  }

  const change = {
    kind: 'entry' as const,
    sectionId: section.id,
    afterEntryId: previousEntry?.id,
    frame,
    bullets: args.bullets.map((bullet) => bullet.trim()).filter(Boolean),
  };
  return stageSuggestions(run, [{ change, source: 'entry', reason: args.reason }]);
}
