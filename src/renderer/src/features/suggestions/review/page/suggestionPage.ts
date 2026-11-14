import { findMoves } from '@/lib/resume/changes/findMoves';
import { readShowPlaceId, readTextPlaceId } from '@/lib/resume/proposalAnchor';
import type { Proposal, ProposalChange, ShowPlace } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { layInProposal } from '../../proposals/apply/layInProposal';
import { resolveChange } from '../../proposals/reviewedChange';

/** How a mark is drawn on the page: changed words, added text, or text being hidden. */
export type SuggestionLook = 'edit' | 'add' | 'hide';

export interface SuggestionMark {
  proposal: Proposal;
  look: SuggestionLook;
  /** The text before and after, set when the suggestion changes a line's words. */
  words?: { before: string; after: string };
  /**
   * Set when the mark is one line of a whole entry or section that a suggestion hides
   * ('leaving'), shows again ('back') or adds ('new'). A hidden block has every line
   * struck through and one bar down its side. Not set for a single bullet's or line's mark.
   */
  block?: 'leaving' | 'back' | 'new';
}

/** A whole entry or section that one suggestion hides, shows or adds. It gets one outline when selected. */
export interface SuggestionBlock {
  proposal: Proposal;
  isLeaving: boolean;
}

/** An item that a reorder moves, with its position before and after. Positions start at 1. */
export interface SuggestionMove {
  proposal: Proposal;
  from: number;
  to: number;
}

/**
 * The page the review shows: the draft with every shown suggestion applied. `marks`,
 * `moves` and `blocks` are keyed by the id of the bullet, line, entry or section they mark.
 */
export interface SuggestionPage {
  doc: ResumeData;
  marks: Map<string, SuggestionMark>;
  moves: Map<string, SuggestionMove>;
  blocks: Map<string, SuggestionBlock>;
}

const isShown = (proposal: Proposal) => !proposal.isStale && proposal.status !== 'rejected';

/**
 * Return the text of the section, entry, line or bullet with this id. Returns undefined
 * when the document has none.
 */
function readTextById(doc: ResumeData, id: string): string | undefined {
  for (const section of doc.sections) {
    if (section.id === id) return section.label;
    for (const item of section.items) {
      if (item.id === id) return item.text ?? '';
      const bullet = item.bullets.find((each) => each.id === id);
      if (bullet) return bullet.text;
    }
  }
  return undefined;
}

/** Return the ids of the existing bullets, lines or sections that a change marks. */
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
    case 'rename':
      return [change.sectionId];
    default:
      return [];
  }
}

/** Return the text a change replaces. Returns undefined when the change replaces no words. */
function readWordsBefore(change: ProposalChange): string | undefined {
  switch (change.kind) {
    case 'rewrite':
    case 'split':
    case 'rename':
      return change.before;
    case 'merge':
      return change.before.join(' ');
    default:
      return undefined;
  }
}

/**
 * Return the items a reorder moves, each with its id. Items that only shift because
 * another item moved are left out.
 */
function readMoves(proposal: Proposal, change: ProposalChange): [string, SuggestionMove][] {
  if (change.kind !== 'reorder') return [];
  return findMoves(change.before, change.after).map(({ id, position, positionBefore }) => [
    id,
    { proposal, from: positionBefore, to: position },
  ]);
}

/**
 * Check whether a change hides something. The review keeps hidden text on the page,
 * struck through, so the user can see what the suggestion removes.
 */
const isLeaving = (change: ProposalChange) => change.kind === 'select' && !change.selected;

/** Return how a change is drawn. New text and things shown again are drawn as added. */
function readLook(change: ProposalChange): SuggestionLook {
  if (change.kind === 'select') return change.selected ? 'add' : 'hide';
  return change.kind === 'add' || change.kind === 'entry' || change.kind === 'section'
    ? 'add'
    : 'edit';
}

/**
 * Apply one suggestion to the page and add its marks. Returns false when the suggestion
 * no longer fits the page.
 */
function layIn(page: SuggestionPage, proposal: Proposal): boolean {
  const change = resolveChange(proposal);
  const laidIn = isLeaving(change)
    ? { doc: page.doc, createdIds: [] }
    : layInProposal(page.doc, proposal);
  if (!laidIn) return false;
  page.doc = laidIn.doc;

  const before = readWordsBefore(change);
  for (const id of readMarkedIds(change)) {
    const after = readTextById(page.doc, id);
    const words = before !== undefined && after !== undefined ? { before, after } : undefined;
    page.marks.set(id, { proposal, look: readLook(change), words });
  }
  // Everything the suggestion created is marked as added, including a split's second
  // half. For a new entry or section, the first created id is the entry or section itself.
  const isNewBlock = change.kind === 'entry' || change.kind === 'section';
  const block = isNewBlock ? 'new' : undefined;
  for (const id of laidIn.createdIds) page.marks.set(id, { proposal, look: 'add', block });
  if (isNewBlock) page.blocks.set(laidIn.createdIds[0], { proposal, isLeaving: false });
  for (const [id, move] of readMoves(proposal, change)) page.moves.set(id, move);
  return true;
}

/** Return the entry or section a change hides or shows. Returns null for any other change. */
function readBlockPlace(
  change: ProposalChange
): (ShowPlace & { unit: 'entry' | 'section' }) | null {
  if (change.kind !== 'select') return null;
  const { place } = change;
  return place.unit === 'entry' || place.unit === 'section' ? place : null;
}

/** Return the ids of everything an entry or section shows: its heading and all that it holds. */
function listBlockIds(doc: ResumeData, id: string): string[] {
  for (const section of doc.sections) {
    const entryIds = (entry: ResumeData['sections'][number]['items'][number]) => [
      entry.id,
      ...entry.bullets.map((bullet) => bullet.id),
    ];
    if (section.id === id) return [id, ...section.items.flatMap(entryIds)];
    const entry = section.items.find((item) => item.id === id);
    if (entry) return entryIds(entry);
  }
  return [];
}

/**
 * Return the order in which a block is marked. A block marked later replaces the marks of
 * one marked earlier. Hidden blocks are marked after shown ones, because nothing inside a
 * hidden block is shown. A hidden entry is marked after a hidden section, so the entry
 * keeps its own marks inside that section.
 */
function rankBlock(change: ProposalChange, unit: 'entry' | 'section'): number {
  if (!isLeaving(change)) return 0;
  return unit === 'section' ? 1 : 2;
}

/**
 * Mark every line of each entry or section that a suggestion hides or shows. These marks
 * replace the marks of any suggestion inside the block, because the whole block is
 * hidden or shown together.
 */
function markBlocks(page: SuggestionPage, proposals: readonly Proposal[]): void {
  const blocks = proposals.flatMap((proposal) => {
    const change = resolveChange(proposal);
    const place = readBlockPlace(change);
    return place ? [{ proposal, change, place, rank: rankBlock(change, place.unit) }] : [];
  });
  for (const { proposal, change, place } of blocks.sort((a, b) => a.rank - b.rank)) {
    const blockId = readShowPlaceId(place);
    const isOnItsWay = isLeaving(change);
    page.blocks.set(blockId, { proposal, isLeaving: isOnItsWay });
    for (const id of listBlockIds(page.doc, blockId)) {
      const block = isOnItsWay ? 'leaving' : 'back';
      page.marks.set(id, { proposal, look: readLook(change), block });
    }
  }
}

/**
 * Build the review page. Each shown suggestion is applied to the draft one at a time, in
 * the order they were made. Applying them one at a time records which suggestion made
 * each new bullet, line, entry or section. A suggestion that no longer fits is left off
 * the page.
 */
export function buildSuggestionPage(
  draft: ResumeData,
  proposals: readonly Proposal[]
): SuggestionPage {
  const page: SuggestionPage = {
    doc: draft,
    marks: new Map(),
    moves: new Map(),
    blocks: new Map(),
  };
  const open = proposals.filter((proposal) => proposal.status !== 'applied');
  const laidIn = open.filter(isShown).filter((proposal) => layIn(page, proposal));
  markBlocks(page, laidIn);

  // A dropped or out-of-date suggestion marks the draft's own text, so the user can find
  // its card. A shown suggestion's mark on the same text is kept.
  for (const proposal of open.filter((each) => !isShown(each))) {
    for (const id of readMarkedIds(proposal.change)) {
      if (readTextById(page.doc, id) !== undefined && !page.marks.has(id)) {
        page.marks.set(id, { proposal, look: 'edit' });
      }
    }
  }
  return page;
}
