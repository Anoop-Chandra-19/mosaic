import { readSplitHalves } from '@/lib/resume/splitHalves';
import type { Proposal, ProposalChange, ProposalVersion } from '@/types/agentProposal';
import { labelSuggestionKind } from '../../proposals/describeSuggestion';
import {
  readKeptVersion,
  readNewestVersion,
  readVersionNumber,
} from '../../proposals/proposalVersions';
import { resolveChange } from '../../proposals/reviewedChange';

/*
 * The words a card's versions are shown with: what each version writes, in one line for
 * its row in the list, and the line before the actions that says what a keep or a drop
 * will do to the versions.
 */

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const SUMMARIES: Record<ProposalChange['kind'], (change: ProposalChange) => string> = {
  rewrite: (change) => (change.kind === 'rewrite' ? change.after : ''),
  merge: (change) => (change.kind === 'merge' ? change.after : ''),
  rename: (change) => (change.kind === 'rename' ? change.after : ''),
  add: (change) => (change.kind === 'add' ? change.text : ''),
  split: (change) => (change.kind === 'split' ? readSplitHalves(change).join(' / ') : ''),
  entry: (change) => {
    if (change.kind !== 'entry') return '';
    const { title, organization } = change.frame;
    const name = [title, organization].filter(Boolean).join(', ') || 'A new entry';
    return `${name}, with ${plural(change.bullets.length, 'bullet', 'bullets')}`;
  },
  section: (change) => {
    if (change.kind !== 'section') return '';
    const { label } = change.section;
    if (change.contents?.layout === 'entries') {
      return `${label}, with ${plural(change.contents.entries.length, 'entry', 'entries')}`;
    }
    const lineCount = change.contents?.lines.length ?? 0;
    return `${label}, with ${plural(lineCount, 'line', 'lines')}`;
  },
  reorder: labelSuggestionKind,
  select: labelSuggestionKind,
};

/**
 * Return one line for a version's row in the list: the text it writes, with the user's
 * edits in it, or for a new entry or section, what it holds.
 */
export function summarizeVersion(version: ProposalVersion): string {
  const change = resolveChange(version);
  return SUMMARIES[change.kind](change);
}

/**
 * Return the line that says what keeping or dropping does to a card's versions, while the
 * card shows `shown`. Returns null when the card has one version and nothing to explain, or
 * when it is out of date.
 */
export function describeVersionConsequence(
  proposal: Proposal,
  shown: ProposalVersion
): string | null {
  const kept = readKeptVersion(proposal);
  if (proposal.isStale || !kept || proposal.versions.length < 2) return null;
  const numberOf = (version: ProposalVersion) => readVersionNumber(proposal, version.id);
  if (proposal.status === 'rejected') {
    return `Undo drop brings back version ${numberOf(kept)} as kept.`;
  }
  if (proposal.status !== 'accepted') return null;
  if (kept.id !== shown.id) {
    return `Keeping version ${numberOf(shown)} makes it what Apply uses, in place of version ${numberOf(kept)}. Version ${numberOf(kept)} stays listed.`;
  }
  const newest = readNewestVersion(proposal);
  if (newest.id !== kept.id) {
    return `Version ${numberOf(newest)} is waiting. Version ${numberOf(kept)} stays what Apply uses until you keep another.`;
  }
  return `Dropping drops the card. Undo drop brings back version ${numberOf(kept)} as kept.`;
}
