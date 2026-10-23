import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findBulletInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** Two bullets of one entry as one. Whether they still sit together is staging's check. */
export function proposeMerge(run: AgentToolRun, args: AgentToolArgs['propose_merge']): ToolAnswer {
  const first = findBulletInReceipt(run, args.firstBulletId);
  if (isProblem(first)) return refuse(first.problem);
  const second = findBulletInReceipt(run, args.secondBulletId);
  if (isProblem(second)) return refuse(second.problem);
  if (first.entry.id !== second.entry.id) {
    return refuse('Only bullets next to each other in one entry can be merged.');
  }

  const change = {
    kind: 'merge' as const,
    sectionId: first.sectionId,
    entryId: first.entry.id,
    firstId: first.bullet.id,
    secondId: second.bullet.id,
    before: [first.bullet.text, second.bullet.text] as [string, string],
    after: args.text.trim(),
  };
  return stageSuggestions(run, [{ change, source: 'merge', reason: args.reason }]);
}
