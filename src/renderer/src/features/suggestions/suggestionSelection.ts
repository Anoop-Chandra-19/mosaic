import { createContext } from 'react';
import type { Proposal, ProposalVersion } from '@/types/agentProposal';
import { readActiveVersion } from './proposals/proposalVersions';
import { findUnconfirmedFacts, listNewEntries } from './proposals/reviewedChange';

/**
 * The selected suggestion, the version each card shows, and the open entry on each new
 * section's card. The page's marks read it, so selecting a suggestion doesn't lay the page
 * out again. It sits at the root of suggestions because the review sets it and the cards
 * read it.
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
  /**
   * The version the user chose to show on each card, by suggestion id. A card with no value
   * here shows its newest version.
   */
  shownVersionIds: Readonly<Record<string, string>>;
  showVersion: (proposalId: string, versionId: string) => void;
}

export const SuggestionSelection = createContext<SuggestionSelectionValue>({
  selectedId: null,
  select: () => {},
  openEntryIds: {},
  openEntry: () => {},
  shownVersionIds: {},
  showVersion: () => {},
});

const listEntryIdsNotLeftOut = (version: ProposalVersion) =>
  listNewEntries(version)
    .filter((entry) => !entry.isLeftOut)
    .map((entry) => entry.ids.entryId);

const findEntryIdsWithFactsLeft = (version: ProposalVersion) =>
  findUnconfirmedFacts(version).map((place) => place.entryId);

/**
 * Return the id of the entry that is open on a new section's card: the one the user
 * opened, or else the first entry with facts to confirm. Returns null when no entry is open.
 * `version` is the version the card shows; the page shows the active one.
 */
export function readOpenEntryId(
  proposal: Proposal,
  openEntryIds: Readonly<Record<string, string | null>>,
  version: ProposalVersion = readActiveVersion(proposal)
): string | null {
  const openedId = openEntryIds[proposal.id];
  if (openedId === undefined) return findEntryIdsWithFactsLeft(version)[0] ?? null;
  // An entry the user opened and then left out is no longer shown open.
  return openedId !== null && listEntryIdsNotLeftOut(version).includes(openedId) ? openedId : null;
}

/**
 * Return the id of the entry to open after the user finishes one in `version`. It is the
 * first entry after the finished one that still has facts to confirm, starting again from
 * the top of the list if needed. Returns null when no other entry has facts to confirm. The
 * finished entry is never returned, so this can be called before its last confirmation is
 * saved.
 */
export function findNextEntryToOpen(
  version: ProposalVersion,
  finishedEntryId: string
): string | null {
  const entryIds = listEntryIdsNotLeftOut(version);
  const position = entryIds.indexOf(finishedEntryId);
  const entryIdsInOrder = [
    ...entryIds.slice(position + 1),
    ...entryIds.slice(0, Math.max(position, 0)),
  ];
  const idsWithFactsLeft = new Set(findEntryIdsWithFactsLeft(version));
  return (
    entryIdsInOrder.find(
      (entryId) => entryId !== finishedEntryId && idsWithFactsLeft.has(entryId)
    ) ?? null
  );
}
