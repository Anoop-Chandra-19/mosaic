import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findShowableInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/**
 * A bullet, line, entry or section left off the page or put back. It stays in the resume
 * either way.
 */
export function proposeSelect(
  run: AgentToolRun,
  args: AgentToolArgs['propose_select']
): ToolAnswer {
  const found = findShowableInReceipt(run, args.id);
  if (isProblem(found)) return refuse(found.problem);

  const change = {
    kind: 'select' as const,
    place: found.place,
    before: found.before,
    selected: args.show,
  };
  return stageSuggestions(run, [{ change, source: 'select', reason: args.reason }]);
}
