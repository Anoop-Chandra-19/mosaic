import { findMoves } from '@/lib/resume/changes/findMoves';
import type { Proposal, ProposalChange } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { layInProposal } from '../../proposals/apply/layInProposal';
import { planApply, type ApplyPlan } from '../../proposals/apply/planApply';
import { readShowPlaceId, readTextPlaceId } from '../../proposals/proposalAnchor';
import {
  findUnconfirmedFacts,
  findWrittenFacts,
  resolveChange,
} from '../../proposals/reviewedChange';
import { needsNumber } from '../../suggestionState';

/*
 * Preview: the page as it would print, with no marks, two ways. All suggested takes every
 * suggestion not dropped as if kept, to judge the whole idea first; What you kept is exactly
 * what Apply would leave. What isn't on the page is said on its row instead (`notes`), and
 * what is can be outlined there (`targets`).
 */

export type PreviewLook = 'all' | 'kept';

/** Why a suggestion is or isn't on the preview's page, said on its row. */
export interface PreviewNote {
  isOnPage: boolean;
  text: string;
}

/** A part of the clean page a suggestion made, by the preview's own ids on it. */
export type PreviewPart = 'bullet' | 'item' | 'section' | 'heading';

export interface PreviewTarget {
  part: PreviewPart;
  id: string;
}

export interface SuggestionPreview {
  doc: ResumeData;
  /** How many are on the page: none kept means the page is the draft as it is. */
  landedCount: number;
  notes: Map<string, PreviewNote>;
  targets: Map<string, PreviewTarget[]>;
}

/** Kept with a number still to fill: All suggested can only leave it off; Apply holds it back. */
const HELD_NOTES: Record<PreviewLook, string> = {
  all: 'needs a number',
  kept: 'held back for its number',
};

export function buildSuggestionPreview(
  draft: ResumeData,
  proposals: readonly Proposal[],
  look: PreviewLook
): SuggestionPreview {
  const notes = new Map<string, PreviewNote>();
  const taken = look === 'all' ? proposals.map((each) => takeAsKept(each, notes)) : proposals;
  const plan = planApply(draft, taken);
  noteWhatIsLeftOut(plan, proposals, look, notes);
  return { ...layInLanded(draft, plan.landed), landedCount: plan.landed.length, notes };
}

/**
 * A suggestion as All suggested shows it: kept, a number to fill swapped for the version
 * that needs none, facts still to confirm shown as written. Dropped and out-of-date ones
 * stay as they are.
 */
function takeAsKept(proposal: Proposal, notes: Map<string, PreviewNote>): Proposal {
  if (proposal.isStale || proposal.status === 'rejected') return proposal;
  const kept: Proposal = { ...proposal, status: 'accepted' };
  const unconfirmed = findUnconfirmedFacts(proposal).length;
  if (unconfirmed) {
    const written = findWrittenFacts(proposal).length;
    notes.set(proposal.id, {
      isOnPage: true,
      text: `shown with ${unconfirmed} of ${written} facts unconfirmed`,
    });
  }
  const { change } = proposal;
  if (!needsNumber(proposal) || change.kind !== 'rewrite' || !change.gap) return kept;
  notes.set(proposal.id, { isOnPage: true, text: 'shown without its number' });
  return {
    ...kept,
    review: { ...proposal.review, isWithoutNumber: true, filledNumber: undefined },
    flags: proposal.flags.filter((flag) => flag.kind !== 'unfilledGap'),
  };
}

/** Each one Apply would leave off, and why, numbered as the list numbers them. */
function noteWhatIsLeftOut(
  plan: ApplyPlan,
  proposals: readonly Proposal[],
  look: PreviewLook,
  notes: Map<string, PreviewNote>
) {
  const leaveOff = (proposal: Proposal, text: string) =>
    notes.set(proposal.id, { isOnPage: false, text });
  for (const proposal of plan.held) leaveOff(proposal, HELD_NOTES[look]);
  for (const proposal of plan.stale) leaveOff(proposal, 'out of date');
  for (const { proposal, changedBy } of plan.skipped) {
    const number = proposals.findIndex((each) => each.id === changedBy?.id) + 1;
    leaveOff(
      proposal,
      number ? `can’t go with suggestion ${number}, which is shown` : 'can’t go with an earlier one'
    );
  }
  for (const proposal of plan.waiting) {
    const facts = findUnconfirmedFacts(proposal).length;
    leaveOff(
      proposal,
      facts ? `waiting, ${facts} ${facts === 1 ? 'fact' : 'facts'} to confirm` : 'waiting'
    );
  }
}

/** The landed ones laid in one at a time, in the order Apply lands them, so each knows its parts. */
function layInLanded(draft: ResumeData, landed: readonly Proposal[]) {
  const madeIds = new Map<string, string[]>();
  let doc = draft;
  for (const proposal of landed) {
    const laidIn = layInProposal(doc, proposal);
    if (!laidIn) continue;
    doc = laidIn.doc;
    madeIds.set(proposal.id, laidIn.createdIds);
  }
  const targets = new Map<string, PreviewTarget[]>();
  for (const proposal of landed) {
    const change = resolveChange(proposal);
    const ids = [...readAboutIds(change), ...(madeIds.get(proposal.id) ?? [])];
    targets.set(proposal.id, [
      ...readHeadingIds(change).map((id) => ({ part: 'heading' as const, id })),
      ...ids.flatMap((id) => locateTarget(doc, id)),
    ]);
  }
  return { doc, targets };
}

/** What of the draft a suggestion is about, by id: a reorder of bullets outlines the entry. */
function readAboutIds(change: ProposalChange): string[] {
  switch (change.kind) {
    case 'rewrite':
      return [readTextPlaceId(change.place)];
    case 'select':
      return change.selected ? [readShowPlaceId(change.place)] : [];
    case 'split':
      return [change.bulletId];
    case 'merge':
      return [change.firstId];
    case 'reorder':
      if (change.place.unit === 'bullets') return [change.place.entryId];
      return change.place.unit === 'items' ? [change.place.sectionId] : [];
    default:
      return [];
  }
}

/** Sections whose heading alone is what changed: renamed, or moved in the sections' order. */
function readHeadingIds(change: ProposalChange): string[] {
  if (change.kind === 'rename') return [change.sectionId];
  if (change.kind === 'reorder' && change.place.unit === 'sections') {
    return findMoves(change.before, change.after).map(({ id }) => id);
  }
  return [];
}

/** Which part of the page an id is: a section, an entry or line, or a bullet; none when gone. */
function locateTarget(doc: ResumeData, id: string): PreviewTarget[] {
  for (const section of doc.sections) {
    if (section.id === id) return [{ part: 'section', id }];
    for (const item of section.items) {
      if (item.id === id) return [{ part: 'item', id }];
      if (item.bullets.some((bullet) => bullet.id === id)) return [{ part: 'bullet', id }];
    }
  }
  return [];
}
