import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { locatePhrase } from '../locatePhrase';
import { findBulletInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** Two bullets from one, split where the model's words start: models count characters badly. */
export function proposeSplit(run: AgentToolRun, args: AgentToolArgs['propose_split']): ToolAnswer {
  const found = findBulletInReceipt(run, args.bulletId);
  if (isProblem(found)) return refuse(found.problem);

  const secondStart = locatePhrase(found.bullet.text, args.secondStartsWith);
  if (secondStart === 'none') {
    return refuse(`"${args.secondStartsWith}" is not in ${args.bulletId}. Copy it exactly.`);
  }
  if (secondStart === 'many') {
    return refuse(`"${args.secondStartsWith}" appears more than once. Give more words.`);
  }

  const change = {
    kind: 'split' as const,
    sectionId: found.sectionId,
    entryId: found.entry.id,
    bulletId: found.bullet.id,
    before: found.bullet.text,
    at: secondStart.start,
  };
  return stageSuggestions(run, [{ change, source: 'split', reason: args.reason }]);
}
