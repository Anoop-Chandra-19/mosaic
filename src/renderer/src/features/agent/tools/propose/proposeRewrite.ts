import type { ProposalChange } from '@/types/agentProposal';
import { findTextInReceipt, isProblem } from './findInReceipt';
import { TOOL_FACTS } from './toolFacts';
import { oneReading, type ProposeTool } from './toolReadings';

/**
 * Propose new text for a bullet or line. Text containing `{{?}}` must also include
 * a `withoutNumber` alternative.
 */
export const proposeRewrite: ProposeTool<'propose_rewrite'> = (context, args) => {
  const found = findTextInReceipt(context, args.id);
  if (isProblem(found)) return found;
  const hasGap = args.text.includes('{{?}}');
  if (hasGap && !args.withoutNumber) return { problem: TOOL_FACTS.gapWithoutNumber };

  const change: Extract<ProposalChange, { kind: 'rewrite' }> = {
    kind: 'rewrite',
    place: found.place,
    before: found.before,
    after: args.text.trim(),
  };
  if (hasGap && args.withoutNumber) change.gap = { withoutNumber: args.withoutNumber.trim() };
  return oneReading({ change, source: 'rewrite', reason: args.reason });
};
