import type { AgentToolArgs } from '@shared/agent-tools/agentTools';
import type { ProposalChange } from '@shared/types/agentProposal';
import { refuse, type AgentToolRun, type ToolAnswer } from '../agentToolRun';
import { findTextInReceipt, isProblem } from './findInReceipt';
import { stageSuggestions } from './stageSuggestions';

/**
 * A bullet's or line's new text, with a `{{?}}` gap only when the version without a number
 * comes too.
 */
export function proposeRewrite(
  run: AgentToolRun,
  args: AgentToolArgs['propose_rewrite']
): ToolAnswer {
  const found = findTextInReceipt(run, args.id);
  if (isProblem(found)) return refuse(found.problem);

  const hasGap = args.text.includes('{{?}}');
  if (hasGap && !args.withoutNumber) {
    return refuse(
      'With {{?}} in text, give withoutNumber too: the same text written to need no number.'
    );
  }

  const change: Extract<ProposalChange, { kind: 'rewrite' }> = {
    kind: 'rewrite',
    place: found.place,
    before: found.before,
    after: args.text.trim(),
  };
  if (hasGap && args.withoutNumber) change.gap = { withoutNumber: args.withoutNumber.trim() };
  return stageSuggestions(run, [{ change, source: 'rewrite', reason: args.reason }]);
}
