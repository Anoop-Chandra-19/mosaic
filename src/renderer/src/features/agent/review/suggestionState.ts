import type { Proposal, ProposalFlagKind } from '@shared/types/agentProposal';

/** Each check's name, as the card and the list show it. */
export const FLAG_LABELS: Record<ProposalFlagKind, string> = {
  unfilledGap: 'Number to fill',
  claimsMore: 'Claims more',
  newNumbers: 'New number',
  calculatedNumbers: 'Calculated number',
  removedDetail: 'Dropped detail',
  newNames: 'New name',
  doubledWords: 'Doubled word',
};

/** Where a suggestion stands in review. */
export type SuggestionState = 'waiting' | 'kept' | 'held' | 'dropped' | 'stale';

export const needsNumber = (proposal: Proposal) =>
  proposal.flags.some((flag) => flag.kind === 'unfilledGap');

export function readSuggestionState(proposal: Proposal): SuggestionState {
  if (proposal.isStale) return 'stale';
  if (proposal.status === 'rejected') return 'dropped';
  if (proposal.status !== 'accepted') return 'waiting';
  return needsNumber(proposal) ? 'held' : 'kept';
}

/** The words a card or row shows for where it stands. */
export function labelSuggestionState(proposal: Proposal): string {
  const state = readSuggestionState(proposal);
  if (state !== 'kept') return STATE_LABELS[state];
  if (proposal.review.rebasedBefore) return 'kept · replaces your edit';
  return proposal.review.userText !== undefined ? 'kept · edited' : 'kept';
}

const STATE_LABELS: Record<SuggestionState, string> = {
  waiting: 'waiting',
  kept: 'kept',
  held: 'kept · needs its number',
  dropped: 'dropped',
  stale: 'out of date',
};

/** The status word's colour, and the list row's dot. */
export const STATE_TONES: Record<SuggestionState, { text: string; dot: string }> = {
  waiting: { text: 'text-amber', dot: 'bg-amber' },
  kept: { text: 'text-add', dot: 'bg-add' },
  held: { text: 'text-warn', dot: 'bg-warn' },
  dropped: { text: 'text-ink-muted', dot: 'bg-ink-faint' },
  stale: { text: 'text-ink-muted italic', dot: 'shadow-[inset_0_0_0_1.5px_var(--ink-faint)]' },
};

/** Waiting on the user: neither applied nor dropped, current or out of date. */
export function countSuggestions(proposals: readonly Proposal[]) {
  const open = proposals.filter((p) => p.status !== 'applied' && p.status !== 'rejected');
  const stale = open.filter((p) => p.isStale).length;
  return { waiting: open.length - stale, stale };
}
