import { createContext } from 'react';
import type { Proposal } from '@/types/agentProposal';
import { readActiveVersion } from './proposals/proposalVersions';
import { findUnconfirmedFacts, listNewEntries } from './proposals/reviewedChange';

/**
 * The selected suggestion, and the open entry on each new section's card. The page's marks
 * read it, so selecting a suggestion doesn't lay the page out again. It sits at the root of
 * suggestions because the review sets it and the cards read it.
 */
export interface SuggestionSelectionValue {
  selectedId: string | null;
  /** Select a suggestion. With `entryId`, also open that entry on its new section's card. */
  select: (id: string | null, entryId?: string) => void;
  /**
   * The entry the user opened on each new section's card, by suggestion id. Null when the
   * user closed every entry. When a card has no value here, it opens the first entry with
   * facts to confirm.
   */
  openEntryIds: Readonly<Record<string, string | null>>;
  openEntry: (proposalId: string, entryId: string | null) => void;
}

export const SuggestionSelection = createContext<SuggestionSelectionValue>({
  selectedId: null,
  select: () => {},
  openEntryIds: {},
  openEntry: () => {},
});

const listEntryIdsNotLeftOut = (proposal: Proposal) =>
  listNewEntries(readActiveVersion(proposal))
    .filter((entry) => !entry.isLeftOut)
    .map((entry) => entry.ids.entryId);

const findEntryIdsWithFactsLeft = (proposal: Proposal) =>
  findUnconfirmedFacts(readActiveVersion(proposal)).map((place) => place.entryId);

/**
 * Return the id of the entry that is open on a new section's card: the one the user
 * opened, or else the first entry with facts to confirm. Returns null when no entry is open.
 */
export function readOpenEntryId(
  proposal: Proposal,
  openEntryIds: Readonly<Record<string, string | null>>
): string | null {
  const openedId = openEntryIds[proposal.id];
  if (openedId === undefined) return findEntryIdsWithFactsLeft(proposal)[0] ?? null;
  // An entry the user opened and then left out is no longer shown open.
  return openedId !== null && listEntryIdsNotLeftOut(proposal).includes(openedId) ? openedId : null;
}

/**
 * Return the id of the entry to open after the user finishes one. It is the first entry
 * after the finished one that still has facts to confirm, starting again from the top of
 * the list if needed. Returns null when no other entry has facts to confirm. The finished
 * entry is never returned, so this can be called before its last confirmation is saved.
 */
export function findNextEntryToOpen(proposal: Proposal, finishedEntryId: string): string | null {
  const entryIds = listEntryIdsNotLeftOut(proposal);
  const position = entryIds.indexOf(finishedEntryId);
  const entryIdsInOrder = [
    ...entryIds.slice(position + 1),
    ...entryIds.slice(0, Math.max(position, 0)),
  ];
  const idsWithFactsLeft = new Set(findEntryIdsWithFactsLeft(proposal));
  return (
    entryIdsInOrder.find(
      (entryId) => entryId !== finishedEntryId && idsWithFactsLeft.has(entryId)
    ) ?? null
  );
}
