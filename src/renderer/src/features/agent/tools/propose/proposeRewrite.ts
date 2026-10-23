import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { ProposalChange } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findBulletInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/** A bullet's new text, with a `{{?}}` gap only when the version without a number comes too. */
export function proposeRewrite(
  run: AgentToolRun,
  args: AgentToolArgs['propose_rewrite']
): ToolAnswer {
  const found = findBulletInReceipt(run, args.bulletId);
  if (isProblem(found)) return refuse(found.problem);

  const hasGap = args.text.includes('{{?}}');
  if (hasGap && !args.withoutNumber) {
    return refuse(
      'With {{?}} in text, give withoutNumber too: the same bullet written to need no number.'
    );
  }

  const change: Extract<ProposalChange, { kind: 'rewrite' }> = {
    kind: 'rewrite',
    sectionId: found.sectionId,
    entryId: found.entry.id,
    bulletId: found.bullet.id,
    before: found.bullet.text,
    after: args.text.trim(),
  };
  if (hasGap && args.withoutNumber) change.gap = { withoutNumber: args.withoutNumber.trim() };
  return stageSuggestions(run, [{ change, source: 'rewrite', reason: args.reason }]);
}
