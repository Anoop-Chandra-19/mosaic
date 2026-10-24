import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findSectionInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** A section's new heading: the user's words, not a claim, so no checks run on it. */
export function proposeRename(
  run: AgentToolRun,
  args: AgentToolArgs['propose_rename']
): ToolAnswer {
  const section = findSectionInReceipt(run, args.sectionId);
  if (isProblem(section)) return refuse(section.problem);

  const change = {
    kind: 'rename' as const,
    sectionId: section.id,
    before: section.label,
    after: args.label.trim(),
  };
  return stageSuggestions(run, [{ change, source: 'rename', reason: args.reason }]);
}
