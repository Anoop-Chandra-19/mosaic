import type { ProposalChange, ProposalChangeKind } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findAnchorMismatch, findEntry, type AnchorMismatch } from './proposalAnchor';

export type ProposalRefusalCode =
  | AnchorMismatch
  | 'unknown-change'
  | 'empty-text'
  | 'unchanged'
  | 'bad-split'
  | 'not-a-permutation';

/** The refusal and what to do about it: from step 3, the model reads `fix` and tries again. */
export interface ProposalRefusal {
  code: ProposalRefusalCode;
  fix: string;
}

const FIXES: Record<ProposalRefusalCode, string> = {
  'unknown-target': 'No such section, entry or bullet. Read the document again for its ids.',
  'changed-since-read':
    'That text changed since you read it. Read it again and propose against what it says now.',
  'unknown-change':
    'Only bullets can be changed. Titles, organizations, places, dates and contact details are the user’s to edit.',
  'empty-text': 'The new text is empty. To leave a bullet off the page, propose hiding it.',
  unchanged: 'This changes nothing. Leave it out.',
  'bad-split': 'Split inside the text, so both halves keep some of it.',
  'not-a-permutation': 'A new order has the same ids as the old one, each once.',
};

/*
 * The fact fence: these are the only changes there are. A field of an entry or the header
 * has no change kind, so nothing can propose one; a new entry's facts are confirmed by the
 * user field by field before it applies.
 */
const CHANGE_KINDS: ReadonlySet<ProposalChangeKind> = new Set<ProposalChangeKind>([
  'rewrite',
  'split',
  'merge',
  'reorder',
  'select',
  'entry',
]);

const isPermutation = (before: string[], after: string[]) =>
  before.length === after.length &&
  new Set(after).size === after.length &&
  after.every((id) => before.includes(id));

/** What is wrong with the change itself, whatever the draft says. */
function findShapeProblem(doc: ResumeData, change: ProposalChange): ProposalRefusalCode | null {
  switch (change.kind) {
    case 'rewrite':
      if (!change.after.trim()) return 'empty-text';
      return change.after === change.before ? 'unchanged' : null;
    case 'split': {
      const isInside =
        Number.isInteger(change.at) && change.at > 0 && change.at < change.before.length;
      const hasHalves =
        isInside &&
        change.before.slice(0, change.at).trim() &&
        change.before.slice(change.at).trim();
      return hasHalves ? null : 'bad-split';
    }
    case 'merge':
      return change.after.trim() ? null : 'empty-text';
    case 'reorder':
      if (!isPermutation(change.before, change.after)) return 'not-a-permutation';
      return change.after.every((id, index) => id === change.before[index]) ? 'unchanged' : null;
    case 'select': {
      const bullet = findEntry(doc, change.sectionId, change.entryId)?.bullets.find(
        (b) => b.id === change.bulletId
      );
      return bullet?.selected === change.selected ? 'unchanged' : null;
    }
    case 'entry': {
      const hasText =
        Object.values(change.frame).some((value) => value?.trim()) ||
        change.bullets.some((bullet) => bullet.trim());
      return hasText ? null : 'empty-text';
    }
  }
}

/** Why a change can't be staged against this draft, or null when it can. */
export function validateProposal(doc: ResumeData, change: ProposalChange): ProposalRefusal | null {
  const code = !CHANGE_KINDS.has(change.kind)
    ? 'unknown-change'
    : (findAnchorMismatch(doc, change) ?? findShapeProblem(doc, change));
  return code ? { code, fix: FIXES[code] } : null;
}
