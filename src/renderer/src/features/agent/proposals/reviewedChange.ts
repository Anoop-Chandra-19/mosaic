import type { EntryFact, Proposal, ProposalChange } from '@shared/types/agentProposal';
import { GAP_MARK } from './checks/unfilledGap';

const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/** The text a rewrite writes: the user's wording, the version without a number, or the gap filled. */
function reviewedText(proposal: Proposal, after: string): string {
  const { review, change } = proposal;
  if (review.userText !== undefined) return review.userText;
  if (change.kind === 'rewrite' && change.gap && review.isWithoutNumber) {
    return change.gap.withoutNumber;
  }
  return review.filledNumber ? after.replace(GAP_MARK, review.filledNumber) : after;
}

/**
 * The change as the user reviewed it: what checks, staleness and apply all read, so they
 * never disagree. The assistant's own `change` is left as it was.
 */
export function resolveChange(proposal: Proposal): ProposalChange {
  const { change, review } = proposal;
  switch (change.kind) {
    case 'rewrite': {
      const after = reviewedText(proposal, change.after);
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after, gap: after.includes(GAP_MARK) ? change.gap : undefined };
    }
    case 'merge': {
      const before = Array.isArray(review.rebasedBefore) ? review.rebasedBefore : change.before;
      return { ...change, before, after: reviewedText(proposal, change.after) };
    }
    case 'entry':
      return { ...change, frame: { ...change.frame, ...review.factEdits } };
    default:
      return change;
  }
}

/** What the user asked, plus every word they wrote in review: their own numbers are theirs. */
export function reviewedRequestText({ requestText, review }: Proposal): string {
  return [requestText, review.userText, review.filledNumber].filter(Boolean).join('\n');
}

/** A new entry's facts that have text and that the user hasn't confirmed yet. */
export function findUnconfirmedFacts(proposal: Proposal): EntryFact[] {
  const change = resolveChange(proposal);
  if (change.kind !== 'entry') return [];
  const confirmed = proposal.review.confirmedFacts ?? [];
  return ENTRY_FACTS.filter((fact) => change.frame[fact]?.trim() && !confirmed.includes(fact));
}

/** Can be kept: current, and with every fact confirmed. A gap still to fill is held back on apply. */
export function canKeepProposal(proposal: Proposal): boolean {
  return !proposal.isStale && findUnconfirmedFacts(proposal).length === 0;
}
