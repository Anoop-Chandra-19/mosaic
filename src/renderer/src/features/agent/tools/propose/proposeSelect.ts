import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findBulletInReceipt, isProblem, placeOfBullet } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** A bullet left off the page or put back. It stays in the resume either way. */
export function proposeSelect(
  run: AgentToolRun,
  args: AgentToolArgs['propose_select']
): ToolAnswer {
  const found = findBulletInReceipt(run, args.bulletId);
  if (isProblem(found)) return refuse(found.problem);

  const change = {
    kind: 'select' as const,
    place: placeOfBullet(found),
    before: found.bullet.text,
    selected: args.show,
  };
  return stageSuggestions(run, [{ change, source: 'select', reason: args.reason }]);
}
