import { isEmptyNewSection } from '@/lib/resume/proposalAnchor';
import type {
  Proposal,
  ProposalChangeKind,
  ProposalFlagKind,
  ProposalVersion,
} from '@/types/agentProposal';
import {
  readActiveVersion,
  readNewestVersion,
  readVersionNumber,
} from './proposals/proposalVersions';

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

/** Check whether the suggestion still has a number for the user to fill. */
export const needsNumber = (proposal: Proposal) =>
  readActiveVersion(proposal).flags.some((flag) => flag.kind === 'unfilledGap');

/** Split the flags on the given bullets of a new entry into numbers to fill and other things to check. */
export function readBulletFlags(version: ProposalVersion, bulletIds: readonly string[]) {
  const flags = version.flags.filter((flag) => flag.textId && bulletIds.includes(flag.textId));
  return {
    numbersToFill: flags.filter((flag) => flag.kind === 'unfilledGap'),
    toCheck: flags.filter((flag) => flag.kind !== 'unfilledGap'),
  };
}

/** The flags about the whole change, not about one bullet of a new entry. */
export const readWholeChangeFlags = (version: ProposalVersion) =>
  version.flags.filter((flag) => !flag.textId);

export function readSuggestionState(proposal: Proposal): SuggestionState {
  if (proposal.isStale) return 'stale';
  if (proposal.status === 'rejected') return 'dropped';
  if (proposal.status !== 'accepted') return 'waiting';
  return needsNumber(proposal) ? 'held' : 'kept';
}

/** What writes words the user can put in their own: rewritten, merged, added text, a heading. */
const EDITABLE_KINDS: ReadonlySet<ProposalChangeKind> = new Set<ProposalChangeKind>([
  'rewrite',
  'merge',
  'add',
  'rename',
]);

export const canEditSuggestion = (proposal: Proposal) =>
  !proposal.isStale && EDITABLE_KINDS.has(readActiveVersion(proposal).change.kind);

/**
 * The words a card or row shows for where it stands. A kept suggestion with a newer
 * version names both: "kept, version 1 · version 3 waiting".
 */
export function labelSuggestionState(proposal: Proposal): string {
  const state = readSuggestionState(proposal);
  if (state !== 'kept' && state !== 'held') return STATE_LABELS[state];
  const kept = readActiveVersion(proposal);
  const newest = readNewestVersion(proposal);
  if (newest.id !== kept.id) {
    const number = (version: ProposalVersion) => readVersionNumber(proposal, version.id);
    return `kept, version ${number(kept)} · version ${number(newest)} waiting`;
  }
  if (state === 'held') return STATE_LABELS.held;
  if (kept.review.rebasedBefore) return 'kept · replaces your edit';
  return kept.review.userText !== undefined ? 'kept · edited' : 'kept';
}

/**
 * The label on an entry or bullet that was added to a version later. In a suggestion's
 * first version it reads "just added". In a later version it reads "new in version 3",
 * because the entry or bullet is in that version but not in the one the user kept.
 */
export function labelLateAddition(proposal: Proposal, version: ProposalVersion): string {
  const number = readVersionNumber(proposal, version.id);
  return number > 1 ? `new in version ${number}` : 'just added';
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

/**
 * Waiting on the user: neither applied nor dropped, current or out of date. A new section
 * the assistant hasn't filled yet is not counted, because it isn't shown.
 */
export function countSuggestions(proposals: readonly Proposal[]) {
  const open = proposals.filter(
    (proposal) =>
      proposal.status !== 'applied' &&
      proposal.status !== 'rejected' &&
      !isEmptyNewSection(readActiveVersion(proposal).change)
  );
  const stale = open.filter((proposal) => proposal.isStale).length;
  return { waiting: open.length - stale, stale };
}
