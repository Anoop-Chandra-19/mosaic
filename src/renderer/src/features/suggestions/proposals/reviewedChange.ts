import type { EntryDraft, EntryFact, Proposal, ProposalChange } from '@/types/agentProposal';
import { GAP_MARK } from './checks/unfilledGap';

const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/** The text a suggestion writes: the user's wording, the version without a number, or the gap filled. */
function reviewedText(proposal: Proposal, after: string): string {
  const { review, change } = proposal;
  if (review.userText !== undefined) return review.userText;
  if (change.kind === 'rewrite' && change.gap && review.isWithoutNumber) {
    return change.gap.withoutNumber;
  }
  return review.filledNumber ? after.replace(GAP_MARK, review.filledNumber) : after;
}

const withFactEdits = (entry: EntryDraft, proposal: Proposal): EntryDraft => ({
  ...entry,
  frame: { ...entry.frame, ...proposal.review.factEdits },
});

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
    case 'add': {
      const afterId = review.placedAfterId !== undefined ? review.placedAfterId : change.afterId;
      return { ...change, afterId, text: reviewedText(proposal, change.text) };
    }
    case 'rename': {
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after: review.userText ?? change.after };
    }
    case 'entry':
      return { ...change, ...withFactEdits(change, proposal) };
    case 'section': {
      const section = { ...change.section, label: review.sectionLabel ?? change.section.label };
      const contents =
        change.contents.layout === 'entries'
          ? { ...change.contents, entry: withFactEdits(change.contents.entry, proposal) }
          : change.contents;
      return { ...change, section, contents };
    }
    default:
      return change;
  }
}

/** The new entry a suggestion brings, alone or as a new section's first: its facts to confirm. */
export function readEntryDraft(change: ProposalChange): EntryDraft | null {
  if (change.kind === 'entry') return change;
  if (change.kind === 'section' && change.contents.layout === 'entries') {
    return change.contents.entry;
  }
  return null;
}

/** What the user asked, plus every word they wrote in review: their own numbers are theirs. */
export function reviewedRequestText({ requestText, review }: Proposal): string {
  return [requestText, review.userText, review.filledNumber].filter(Boolean).join('\n');
}

/** A new entry's facts that have text, which the user confirms one by one. */
export function findWrittenFacts(proposal: Proposal): EntryFact[] {
  const entry = readEntryDraft(resolveChange(proposal));
  return entry ? ENTRY_FACTS.filter((fact) => entry.frame[fact]?.trim()) : [];
}

/** A new entry's facts that have text and that the user hasn't confirmed yet. */
export function findUnconfirmedFacts(proposal: Proposal): EntryFact[] {
  const confirmed = proposal.review.confirmedFacts ?? [];
  return findWrittenFacts(proposal).filter((fact) => !confirmed.includes(fact));
}

/** Can be kept: current, and with every fact confirmed. A gap still to fill is held back on apply. */
export function canKeepProposal(proposal: Proposal): boolean {
  return !proposal.isStale && findUnconfirmedFacts(proposal).length === 0;
}
