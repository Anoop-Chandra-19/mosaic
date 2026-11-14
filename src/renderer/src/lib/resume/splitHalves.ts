import type { ProposalChange } from '@/types/agentProposal';

type SplitChange = Extract<ProposalChange, { kind: 'split' }>;

/** Return the text of the two bullets that cutting `before` at `at` gives. */
export const cutSplitHalves = ({ before, at }: SplitChange): [string, string] => [
  before.slice(0, at).trim(),
  before.slice(at).trim(),
];

/** Return the text of the two bullets a split makes. A reworded bullet reads as reworded. */
export const readSplitHalves = (change: SplitChange): [string, string] =>
  change.halves ?? cutSplitHalves(change);
