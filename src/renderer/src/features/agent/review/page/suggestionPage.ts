import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { applyProposalsToResume, sortForApply } from '../../proposals/applyProposalsToResume';
import { readShowPlaceId, readTextPlaceId } from '../../proposals/proposalAnchor';
import { resolveChange } from '../../proposals/reviewedChange';

/** How a mark reads on the page: changed text, added text, or text leaving the page. */
export type SuggestionLook = 'edit' | 'add' | 'hide';

export interface SuggestionMark {
  proposal: Proposal;
  look: SuggestionLook;
  /**
   * A whole entry or section: leaving the page (faded, with one bracket down its side) or
   * put back (which says so beside its heading). Absent for a bullet's or line's mark.
   */
  block?: 'leaving' | 'back';
}

/** An item a reorder moves, by its place before and after, counted from 1. */
export interface SuggestionMove {
  proposal: Proposal;
  from: number;
  to: number;
}

/**
 * The page the review shows: the draft with every live suggestion laid in, and its marks,
 * by the id of what they mark: a bullet's or line's text, an entry's heading, a section's.
 */
export interface SuggestionPage {
  doc: ResumeData;
  marks: Map<string, SuggestionMark>;
  moves: Map<string, SuggestionMove>;
}

const isShown = (proposal: Proposal) => !proposal.isStale && proposal.status !== 'rejected';

/** What of the draft a suggestion is about, by id, before anything is laid in. */
function readMarkedIds(change: ProposalChange): string[] {
  switch (change.kind) {
    case 'rewrite':
      return [readTextPlaceId(change.place)];
    case 'select':
      return [readShowPlaceId(change.place)];
    case 'split':
      return [change.bulletId];
    case 'merge':
      return [change.firstId];
    default:
      return [];
  }
}

/** The items a reorder moves, by id, for the "moved 2→1" chips. */
function readMoves(proposal: Proposal, change: ProposalChange): [string, SuggestionMove][] {
  if (change.kind !== 'reorder') return [];
  return change.after
    .map((id, index): [string, SuggestionMove] => [
      id,
      { proposal, from: change.before.indexOf(id) + 1, to: index + 1 },
    ])
    .filter(([, { from, to }]) => from !== to);
}

/** A hide stays on the page, struck, since the review is about what it takes away. */
const isLeaving = (change: ProposalChange) => change.kind === 'select' && !change.selected;

/** The look of what a suggestion lays in: new text and things put back read as added. */
function readLook(change: ProposalChange): SuggestionLook {
  if (change.kind === 'select') return change.selected ? 'add' : 'hide';
  return change.kind === 'add' || change.kind === 'entry' ? 'add' : 'edit';
}

/** Whether a suggestion takes a whole entry or section off the page, or puts it back. */
function readBlock(change: ProposalChange): SuggestionMark['block'] {
  if (change.kind !== 'select') return undefined;
  const { unit } = change.place;
  if (unit !== 'entry' && unit !== 'section') return undefined;
  return change.selected ? 'back' : 'leaving';
}

/** Lays one suggestion into the page; false when it no longer fits by its turn. */
function layIn(page: SuggestionPage, proposal: Proposal): boolean {
  const change = resolveChange(proposal);
  const created: string[] = [];
  const createId = () => {
    const id = crypto.randomUUID();
    created.push(id);
    return id;
  };
  const laidIn = isLeaving(change)
    ? { doc: page.doc, appliedIds: [proposal.id] }
    : applyProposalsToResume(page.doc, [{ ...proposal, change }], createId);
  if (!laidIn.appliedIds.length) return false;
  page.doc = laidIn.doc;

  const mark = { proposal, look: readLook(change), block: readBlock(change) };
  for (const id of [...readMarkedIds(change), ...created]) page.marks.set(id, mark);
  for (const [id, move] of readMoves(proposal, change)) page.moves.set(id, move);
  return true;
}

/**
 * Lays each shown suggestion into the draft in the order Apply would, one at a time, so
 * what a split, an addition or a new entry makes is known to be theirs. One that no
 * longer fits by its turn (a second rewrite of the same bullet) is left off the page.
 */
export function buildSuggestionPage(
  draft: ResumeData,
  proposals: readonly Proposal[]
): SuggestionPage {
  const page: SuggestionPage = { doc: draft, marks: new Map(), moves: new Map() };
  const open = proposals.filter((proposal) => proposal.status !== 'applied');
  for (const proposal of sortForApply(open.filter(isShown))) layIn(page, proposal);

  // Dropped and out-of-date ones mark the draft's own text, unless a shown one already does.
  for (const proposal of open.filter((each) => !isShown(each))) {
    for (const id of readMarkedIds(proposal.change)) {
      if (isOnPage(page.doc, id) && !page.marks.has(id)) {
        page.marks.set(id, { proposal, look: 'edit' });
      }
    }
  }
  return page;
}

/** Whether a section, entry, line or bullet with this id is in the document. */
function isOnPage(doc: ResumeData, id: string): boolean {
  return doc.sections.some(
    (section) =>
      section.id === id ||
      section.items.some((item) => item.id === id || item.bullets.some((b) => b.id === id))
  );
}
