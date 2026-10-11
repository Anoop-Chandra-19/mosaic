import type { Proposal } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume, sortForApply } from '../../proposals/applyProposalsToResume';
import { findEntry } from '../../proposals/proposalAnchor';
import { resolveChange } from '../../proposals/reviewedChange';

/** How a mark reads on the page: changed text, added text, or text leaving the page. */
export type SuggestionLook = 'edit' | 'add' | 'hide';

export interface SuggestionMark {
  proposal: Proposal;
  look: SuggestionLook;
}

/** A bullet a reorder moves, by its place before and after, counted from 1. */
export interface SuggestionMove {
  proposal: Proposal;
  from: number;
  to: number;
}

/** The page the review shows: the draft with every live suggestion laid in, and its marks. */
export interface SuggestionPage {
  doc: ResumeData;
  byBullet: Map<string, SuggestionMark>;
  /** A new entry's heading and dates. */
  byEntry: Map<string, SuggestionMark>;
  moves: Map<string, SuggestionMove>;
}

const isShown = (proposal: Proposal) => !proposal.isStale && proposal.status !== 'rejected';

/** The bullets of the draft a suggestion is about, before anything is laid in. */
function readAnchorBullets(proposal: Proposal): string[] {
  const { change } = proposal;
  switch (change.kind) {
    case 'rewrite':
    case 'split':
    case 'select':
      return [change.bulletId];
    case 'merge':
      return [change.firstId];
    default:
      return [];
  }
}

/** The bullets a reorder moves, by id, for the "moved 2→1" chips. */
function readMoves(proposal: Proposal): [string, SuggestionMove][] {
  const { change } = proposal;
  if (change.kind !== 'reorder' || !change.entryId) return [];
  return change.after
    .map((id, index): [string, SuggestionMove] => [
      id,
      { proposal, from: change.before.indexOf(id) + 1, to: index + 1 },
    ])
    .filter(([, { from, to }]) => from !== to);
}

/**
 * Lays each shown suggestion into the draft in the order Apply would, one at a time, so
 * the bullets a split or a new entry makes are known to be theirs. One that no longer fits
 * by its turn (a second rewrite of the same bullet) is left off the page. A hide stays on
 * the page, struck, since the review is about what it takes away.
 */
export function buildSuggestionPage(
  draft: ResumeData,
  proposals: readonly Proposal[]
): SuggestionPage {
  const page: SuggestionPage = {
    doc: draft,
    byBullet: new Map(),
    byEntry: new Map(),
    moves: new Map(),
  };
  const open = proposals.filter((proposal) => proposal.status !== 'applied');

  for (const proposal of sortForApply(open.filter(isShown))) {
    const change = resolveChange(proposal);
    const created: string[] = [];
    const createId = () => {
      const id = crypto.randomUUID();
      created.push(id);
      return id;
    };
    const laidIn =
      change.kind === 'select'
        ? { doc: page.doc, appliedIds: [proposal.id] }
        : applyProposalsToResume(page.doc, [{ ...proposal, change }], createId);
    if (!laidIn.appliedIds.length) continue;
    page.doc = laidIn.doc;

    const look = change.kind === 'select' ? 'hide' : change.kind === 'entry' ? 'add' : 'edit';
    if (change.kind === 'entry') {
      // The entry's id comes first, then its bullets'.
      const [entryId, ...bulletIds] = created;
      page.byEntry.set(entryId, { proposal, look });
      for (const id of bulletIds) page.byBullet.set(id, { proposal, look });
    } else {
      for (const id of [...readAnchorBullets(proposal), ...created]) {
        page.byBullet.set(id, { proposal, look });
      }
    }
    for (const [bulletId, move] of readMoves(proposal)) page.moves.set(bulletId, move);
  }

  // Dropped and out-of-date ones mark the draft's own bullet, unless a shown one already does.
  for (const proposal of open.filter((each) => !isShown(each))) {
    for (const id of readAnchorBullets(proposal)) {
      const isOnPage = findBullet(page.doc, proposal, id);
      if (isOnPage && !page.byBullet.has(id)) page.byBullet.set(id, { proposal, look: 'edit' });
    }
  }
  return page;
}

function findBullet(doc: ResumeData, proposal: Proposal, bulletId: string): boolean {
  const { change } = proposal;
  if (!('entryId' in change) || !change.entryId) return false;
  return !!findEntry(doc, change.sectionId, change.entryId)?.bullets.some((b) => b.id === bulletId);
}
