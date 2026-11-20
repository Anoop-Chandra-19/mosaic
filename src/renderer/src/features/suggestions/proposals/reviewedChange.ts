import type {
  EntryDraft,
  EntryFact,
  NewContentIds,
  NewEntryIds,
  Proposal,
  ProposalChange,
} from '@/types/agentProposal';
import { isEmptyNewSection } from '@/lib/resume/proposalAnchor';
import { GAP_MARK } from './checks/unfilledGap';

export const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/** The text a suggestion writes: the user's wording, the version without a number, or the gap filled. */
function reviewedText(proposal: Proposal, after: string): string {
  const { review, change } = proposal;
  if (review.userText !== undefined) return review.userText;
  const hasGap = change.kind === 'rewrite' || change.kind === 'add';
  if (hasGap && change.gap && review.isWithoutNumber) return change.gap.withoutNumber;
  return review.filledNumber ? after.replace(GAP_MARK, review.filledNumber) : after;
}

/**
 * A new entry that a suggestion adds, either on its own or as part of a new section. Its
 * facts include the user's corrections.
 */
export interface NewEntry {
  ids: NewEntryIds;
  draft: EntryDraft;
  /** True when the user left it out of its new section. A new entry on its own is never left out. */
  isLeftOut: boolean;
}

/** Pair each new entry in the change, as the assistant wrote it, with its ids. */
function pairEntries(
  change: ProposalChange,
  newContentIds: NewContentIds | null
): { ids: NewEntryIds; draft: EntryDraft }[] {
  if (change.kind === 'entry' && newContentIds?.kind === 'entry') {
    return [{ ids: newContentIds.entry, draft: change }];
  }
  if (
    change.kind === 'section' &&
    change.contents?.layout === 'entries' &&
    newContentIds?.kind === 'section' &&
    newContentIds.contents?.layout === 'entries'
  ) {
    const entryIds = newContentIds.contents.entries;
    return change.contents.entries.map((draft, index) => ({ ids: entryIds[index], draft }));
  }
  return [];
}

/**
 * List the new entries a suggestion adds, in order, with the user's corrections to their
 * facts. Entries the user left out are listed too, with `isLeftOut` set.
 */
export function listNewEntries({ change, newContentIds, review }: Proposal): NewEntry[] {
  const leftOutIds = review.leftOutEntryIds ?? [];
  return pairEntries(change, newContentIds).map(({ ids, draft }) => ({
    ids,
    draft: { ...draft, frame: { ...draft.frame, ...review.factEdits?.[ids.entryId] } },
    isLeftOut: leftOutIds.includes(ids.entryId),
  }));
}

const listEntriesNotLeftOut = (proposal: Proposal) =>
  listNewEntries(proposal).filter((entry) => !entry.isLeftOut);

/**
 * The change as the user reviewed it: what checks, staleness and apply all read, so they
 * never disagree. The assistant's own `change` is left as it was. The entries the user left
 * out of a new section are not in it. Apply pairs it with `resolveNewContentIds`, which
 * leaves out the same entries' ids.
 */
export function resolveChange(proposal: Proposal): ProposalChange {
  const { change, review } = proposal;
  switch (change.kind) {
    case 'rewrite': {
      const after = reviewedText(proposal, change.after);
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after, gap: after.includes(GAP_MARK) ? change.gap : undefined };
    }
    case 'merge': {
      const before = Array.isArray(review.rebasedBefore) ? review.rebasedBefore : change.before;
      return { ...change, before, after: reviewedText(proposal, change.after) };
    }
    case 'add': {
      const afterId = review.placedAfterId !== undefined ? review.placedAfterId : change.afterId;
      const text = reviewedText(proposal, change.text);
      return { ...change, afterId, text, gap: text.includes(GAP_MARK) ? change.gap : undefined };
    }
    case 'rename': {
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after: review.userText ?? change.after };
    }
    case 'entry': {
      const [entry] = listNewEntries(proposal);
      return entry ? { ...change, ...entry.draft } : change;
    }
    case 'section': {
      const section = { ...change.section, label: review.sectionLabel ?? change.section.label };
      const contents =
        change.contents?.layout === 'entries'
          ? {
              ...change.contents,
              entries: listEntriesNotLeftOut(proposal).map(({ draft }) => draft),
            }
          : change.contents;
      return { ...change, section, contents };
    }
    default:
      return change;
  }
}

/**
 * Return the ids of what the reviewed change adds. The ids of entries the user left out of
 * a new section are not included.
 */
export function resolveNewContentIds(proposal: Proposal): NewContentIds | null {
  const ids = proposal.newContentIds;
  if (ids?.kind !== 'section' || ids.contents?.layout !== 'entries') return ids;
  const entries = listEntriesNotLeftOut(proposal).map((entry) => entry.ids);
  return { ...ids, contents: { ...ids.contents, entries } };
}

/** Return the suggestion with its change as the user reviewed it, and the matching ids. */
export const resolveProposal = (proposal: Proposal): Proposal => ({
  ...proposal,
  change: resolveChange(proposal),
  newContentIds: resolveNewContentIds(proposal),
});

/** What the user asked, plus every word they wrote in review: their own numbers are theirs. */
export function reviewedRequestText({ requestText, review }: Proposal): string {
  return [requestText, review.userText, review.filledNumber].filter(Boolean).join('\n');
}

/** One fact of one new entry. */
export interface EntryFactPlace {
  entryId: string;
  fact: EntryFact;
}

/** Return the facts of a new entry that have text. The user confirms each of these. */
export const listWrittenFacts = ({ frame }: EntryDraft): EntryFact[] =>
  ENTRY_FACTS.filter((fact) => frame[fact]?.trim());

/** Check whether the user confirmed this fact of this entry. */
export const isFactConfirmed = (proposal: Proposal, { entryId, fact }: EntryFactPlace) =>
  proposal.review.confirmedFacts?.[entryId]?.includes(fact) ?? false;

/** Return the facts that have text, in every new entry the user hasn't left out. */
export function findWrittenFacts(proposal: Proposal): EntryFactPlace[] {
  return listEntriesNotLeftOut(proposal).flatMap(({ ids, draft }) =>
    listWrittenFacts(draft).map((fact) => ({ entryId: ids.entryId, fact }))
  );
}

/** Return the facts that have text and aren't confirmed yet, in every new entry the user hasn't left out. */
export function findUnconfirmedFacts(proposal: Proposal): EntryFactPlace[] {
  return findWrittenFacts(proposal).filter((place) => !isFactConfirmed(proposal, place));
}

/**
 * Can be kept: current, with every fact confirmed, and not a new section that is still
 * empty. A gap still to fill is held back on apply.
 */
export function canKeepProposal(proposal: Proposal): boolean {
  if (proposal.isStale || isEmptyNewSection(proposal.change)) return false;
  return findUnconfirmedFacts(proposal).length === 0;
}
