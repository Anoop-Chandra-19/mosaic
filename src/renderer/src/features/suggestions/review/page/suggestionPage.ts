import { findMoves } from '@/lib/resume/changes/findMoves';
import { readShowPlaceId, readTextPlaceId } from '@/lib/resume/proposalAnchor';
import type { Proposal, ProposalChange, ShowPlace } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { sortForApply } from '../../proposals/apply/applyProposalsToResume';
import { layInProposal } from '../../proposals/apply/layInProposal';
import { resolveChange } from '../../proposals/reviewedChange';

/** How a mark reads on the page: changed words, added text, or text leaving the page. */
export type SuggestionLook = 'edit' | 'add' | 'hide';

export interface SuggestionMark {
  proposal: Proposal;
  look: SuggestionLook;
  /** What a line's words are marked against, when the suggestion changes them. */
  words?: { before: string; after: string };
  /**
   * Part of a whole entry or section: leaving the page (every line struck, one bar down its
   * side), put back, or new. Absent for a bullet's or line's own mark.
   */
  block?: 'leaving' | 'back' | 'new';
}

/** A whole entry or section one suggestion is about, outlined as one when it is selected. */
export interface SuggestionBlock {
  proposal: Proposal;
  isLeaving: boolean;
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
  blocks: Map<string, SuggestionBlock>;
}

const isShown = (proposal: Proposal) => !proposal.isStale && proposal.status !== 'rejected';

/** The text a section, entry, line or bullet with this id holds; undefined when it isn't there. */
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
    case 'rename':
      return [change.sectionId];
    default:
      return [];
  }
}

/** The words a change had before it, where it changes a line's words. */
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

/** The items a reorder moves, by id: not the ones it only shifts. */
function readMoves(proposal: Proposal, change: ProposalChange): [string, SuggestionMove][] {
  if (change.kind !== 'reorder') return [];
  return findMoves(change.before, change.after).map(({ id, position, positionBefore }) => [
    id,
    { proposal, from: positionBefore, to: position },
  ]);
}

/** A hide stays on the page, struck, since the review is about what it takes away. */
const isLeaving = (change: ProposalChange) => change.kind === 'select' && !change.selected;

/** The look of what a suggestion lays in: new text and things put back read as added. */
function readLook(change: ProposalChange): SuggestionLook {
  if (change.kind === 'select') return change.selected ? 'add' : 'hide';
  return change.kind === 'add' || change.kind === 'entry' || change.kind === 'section'
    ? 'add'
    : 'edit';
}

/** Lays one suggestion into the page; false when it no longer fits by its turn. */
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
  // What it makes is new, a split's second half included. An entry or section is made first.
  const isNewBlock = change.kind === 'entry' || change.kind === 'section';
  const block = isNewBlock ? 'new' : undefined;
  for (const id of laidIn.createdIds) page.marks.set(id, { proposal, look: 'add', block });
  if (isNewBlock) page.blocks.set(laidIn.createdIds[0], { proposal, isLeaving: false });
  for (const [id, move] of readMoves(proposal, change)) page.moves.set(id, move);
  return true;
}

/** The id of a whole entry or section a suggestion takes off or puts back. */
function readBlockPlace(
  change: ProposalChange
): (ShowPlace & { unit: 'entry' | 'section' }) | null {
  if (change.kind !== 'select') return null;
  const { place } = change;
  return place.unit === 'entry' || place.unit === 'section' ? place : null;
}

/** Everything a whole entry or section prints: its heading, and all that is under it. */
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
 * The order whole entries and sections are marked in, as a later one marks over an earlier:
 * nothing under one leaving will print, and an entry leaving keeps its own lines in a section
 * that is leaving too.
 */
function rankBlock(change: ProposalChange, unit: 'entry' | 'section'): number {
  if (!isLeaving(change)) return 0;
  return unit === 'section' ? 1 : 2;
}

/**
 * A whole entry or section is marked line by line, over any suggestion inside it: it goes or
 * comes back whole.
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
 * Lays each shown suggestion into the draft in the order Apply would, one at a time, so
 * what a split, an addition, a new entry or a new section makes is known to be theirs. One that no
 * longer fits by its turn (a second rewrite of the same bullet) is left off the page.
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
  const laidIn = sortForApply(open.filter(isShown)).filter((proposal) => layIn(page, proposal));
  markBlocks(page, laidIn);

  // Dropped and out-of-date ones mark the draft's own text, unless a shown one already does.
  for (const proposal of open.filter((each) => !isShown(each))) {
    for (const id of readMarkedIds(proposal.change)) {
      if (readTextById(page.doc, id) !== undefined && !page.marks.has(id)) {
        page.marks.set(id, { proposal, look: 'edit' });
      }
    }
  }
  return page;
}
