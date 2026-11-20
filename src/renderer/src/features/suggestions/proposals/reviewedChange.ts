import type {
  EntryDraft,
  EntryFact,
  NewContentIds,
  NewEntryIds,
  NumberGap,
  Proposal,
  ProposalChange,
  ProposalVersion,
} from '@/types/agentProposal';
import { isEmptyNewSection } from '@/lib/resume/proposalAnchor';
import { GAP_MARK } from './checks/unfilledGap';
import { readActiveVersion } from './proposalVersions';

export const ENTRY_FACTS: EntryFact[] = ['title', 'organization', 'location', 'dates'];

/** The text a version writes: the user's wording, the version without a number, or the gap filled. */
function reviewedText({ review, change }: ProposalVersion, after: string): string {
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
 * List the new entries a version adds, in order, with the user's corrections to their
 * facts. Entries the user left out are listed too, with `isLeftOut` set.
 */
export function listNewEntries({ change, newContentIds, review }: ProposalVersion): NewEntry[] {
  const leftOutIds = review.leftOutEntryIds ?? [];
  return pairEntries(change, newContentIds).map(({ ids, draft }) => ({
    ids,
    draft: { ...draft, frame: { ...draft.frame, ...review.factEdits?.[ids.entryId] } },
    isLeftOut: leftOutIds.includes(ids.entryId),
  }));
}

const listEntriesNotLeftOut = (version: ProposalVersion) =>
  listNewEntries(version).filter((entry) => !entry.isLeftOut);

/** A bullet of a new entry, with what the user did about its number. */
export interface NewBullet {
  id: string;
  /** The assistant's text, or its version without a number when the user took that. */
  text: string;
  /** Set while the shown text still has a `{{?}}` to fill. */
  gap?: NumberGap;
  /** The number the user typed into the gap. */
  filledNumber?: string;
  /** The user took the version without a number. It is only set when there is one. */
  isWithoutNumber: boolean;
}

/** List a new entry's bullets with what the user did about each one's number. */
export function listNewBullets({ review }: ProposalVersion, { ids, draft }: NewEntry): NewBullet[] {
  return draft.bullets.map((assistantText, index) => {
    const id = ids.bulletIds[index];
    const gap = draft.gaps?.[id];
    const isWithoutNumber = !!gap && (review.withoutNumberIds?.includes(id) ?? false);
    const text = isWithoutNumber ? gap.withoutNumber : assistantText;
    return {
      id,
      text,
      gap: text.includes(GAP_MARK) ? gap : undefined,
      filledNumber: isWithoutNumber ? undefined : review.filledNumbers?.[id],
      isWithoutNumber,
    };
  });
}

/**
 * Return the new entry with each bullet as the user reviewed it: with the number they typed
 * in, or the version without a number they chose.
 */
function resolveEntryDraft(version: ProposalVersion, entry: NewEntry): EntryDraft {
  const bullets = listNewBullets(version, entry);
  const written = bullets.map(({ text, filledNumber }) =>
    filledNumber ? text.replace(GAP_MARK, filledNumber) : text
  );
  // A bullet keeps its gap only while its text still has a {{?}} to fill.
  const gaps = Object.fromEntries(
    bullets.flatMap(({ id, gap }, index) =>
      gap && written[index].includes(GAP_MARK) ? [[id, gap]] : []
    )
  );
  return { ...entry.draft, bullets: written, gaps: Object.keys(gaps).length ? gaps : undefined };
}

/**
 * The change as the user reviewed it: what checks, staleness and apply all read, so they
 * never disagree. The assistant's own `change` is left as it was. The entries the user left
 * out of a new section are not in it. Apply pairs it with `resolveNewContentIds`, which
 * leaves out the same entries' ids.
 */
export function resolveChange(version: ProposalVersion): ProposalChange {
  const { change, review } = version;
  switch (change.kind) {
    case 'rewrite': {
      const after = reviewedText(version, change.after);
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after, gap: after.includes(GAP_MARK) ? change.gap : undefined };
    }
    case 'merge': {
      const before = Array.isArray(review.rebasedBefore) ? review.rebasedBefore : change.before;
      return { ...change, before, after: reviewedText(version, change.after) };
    }
    case 'add': {
      const afterId = review.placedAfterId !== undefined ? review.placedAfterId : change.afterId;
      const text = reviewedText(version, change.text);
      return { ...change, afterId, text, gap: text.includes(GAP_MARK) ? change.gap : undefined };
    }
    case 'rename': {
      const before =
        typeof review.rebasedBefore === 'string' ? review.rebasedBefore : change.before;
      return { ...change, before, after: review.userText ?? change.after };
    }
    case 'entry': {
      const [entry] = listNewEntries(version);
      return entry ? { ...change, ...resolveEntryDraft(version, entry) } : change;
    }
    case 'section': {
      const section = { ...change.section, label: review.sectionLabel ?? change.section.label };
      const contents =
        change.contents?.layout === 'entries'
          ? {
              ...change.contents,
              entries: listEntriesNotLeftOut(version).map((entry) =>
                resolveEntryDraft(version, entry)
              ),
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
export function resolveNewContentIds(version: ProposalVersion): NewContentIds | null {
  const ids = version.newContentIds;
  if (ids?.kind !== 'section' || ids.contents?.layout !== 'entries') return ids;
  const entries = listEntriesNotLeftOut(version).map((entry) => entry.ids);
  return { ...ids, contents: { ...ids.contents, entries } };
}

/**
 * A change ready to apply: a suggestion's change with the user's edits in it, and the ids
 * of what it adds.
 */
export interface ReviewedChange {
  proposalId: string;
  change: ProposalChange;
  newContentIds: NewContentIds | null;
}

/** Return the change of a suggestion's active version, with the user's edits in it. */
export function resolveProposal(proposal: Proposal): ReviewedChange {
  const version = readActiveVersion(proposal);
  return {
    proposalId: proposal.id,
    change: resolveChange(version),
    newContentIds: resolveNewContentIds(version),
  };
}

/** What the user asked, plus every word they wrote in review: their own numbers are theirs. */
export function reviewedRequestText({ requestText, review }: ProposalVersion): string {
  const bulletNumbers = Object.values(review.filledNumbers ?? {});
  return [requestText, review.userText, review.filledNumber, ...bulletNumbers]
    .filter(Boolean)
    .join('\n');
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
export const isFactConfirmed = ({ review }: ProposalVersion, { entryId, fact }: EntryFactPlace) =>
  review.confirmedFacts?.[entryId]?.includes(fact) ?? false;

/** Return the facts that have text, in every new entry the user hasn't left out. */
export function findWrittenFacts(version: ProposalVersion): EntryFactPlace[] {
  return listEntriesNotLeftOut(version).flatMap(({ ids, draft }) =>
    listWrittenFacts(draft).map((fact) => ({ entryId: ids.entryId, fact }))
  );
}

/** Return the facts that have text and aren't confirmed yet, in every new entry the user hasn't left out. */
export function findUnconfirmedFacts(version: ProposalVersion): EntryFactPlace[] {
  return findWrittenFacts(version).filter((place) => !isFactConfirmed(version, place));
}

/**
 * Check whether a suggestion can be kept. It can when it is not out of date, every fact in
 * its active version is confirmed, and it isn't a new section that is still empty. A number
 * still to fill doesn't stop the keep; Apply holds the suggestion back until it is filled.
 */
export function canKeepProposal(proposal: Proposal): boolean {
  const version = readActiveVersion(proposal);
  if (proposal.isStale || isEmptyNewSection(version.change)) return false;
  return findUnconfirmedFacts(version).length === 0;
}
