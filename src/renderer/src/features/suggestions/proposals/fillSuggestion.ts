import type {
  EntryDraft,
  NewContentIds,
  NewEntryIds,
  Proposal,
  ProposalChange,
  ProposalVersion,
} from '@/types/agentProposal';
import { createNewContentIds } from './newContentIds';
import { readActiveVersion } from './proposalVersions';

/*
 * Add to a suggested new section or new entry instead of making another suggestion.
 *
 * The assistant suggests a new section empty, then adds entries or lines to it one call at
 * a time. It can also add bullets to a new entry it suggested earlier. Each of these
 * additions is written into the suggestion for the new section or entry, so the user
 * reviews the section or entry and everything in it together.
 *
 * This happens only while that suggestion is waiting and not out of date. Once the user
 * has kept it, an addition becomes a suggestion of its own.
 *
 * For each change, staging calls `findSuggestionToFill`. When it returns a suggestion,
 * staging calls `fillSuggestion` to write the change into that suggestion's version.
 */

type SectionChange = Extract<ProposalChange, { kind: 'section' }>;
type SectionIds = Extract<NewContentIds, { kind: 'section' }>;
type EntryChange = Extract<ProposalChange, { kind: 'entry' }>;
type EntryIds = Extract<NewContentIds, { kind: 'entry' }>;
type AddChange = Extract<ProposalChange, { kind: 'add' }>;
type AddIds = Extract<NewContentIds, { kind: 'add' }>;

/** A version that adds a new section, with the ids staging gave it. */
type SectionVersion = ProposalVersion & { change: SectionChange; newContentIds: SectionIds };

/** A version that adds a new entry alone, with the ids staging gave it. */
type EntryVersion = ProposalVersion & { change: EntryChange; newContentIds: EntryIds };

type FillableVersion = SectionVersion | EntryVersion;

export interface FilledContents {
  /** The version's change, now including the added entry, line or bullet. */
  change: ProposalChange;
  /** The version's ids, now including the ids of the added entry, line or bullet. */
  newContentIds: NewContentIds;
  /** The ids of the entries and bullets that later runs added, labelled "just added". */
  lateIds: string[] | undefined;
  /** The ids of the added entry, line or bullet on its own. */
  filledIds: NewContentIds;
}

const isSectionVersion = (version: ProposalVersion): version is SectionVersion =>
  version.change.kind === 'section' && version.newContentIds?.kind === 'section';

const isEntryVersion = (version: ProposalVersion): version is EntryVersion =>
  version.change.kind === 'entry' && version.newContentIds?.kind === 'entry';

const isWaiting = (proposal: Proposal) => proposal.status === 'pending' && !proposal.isStale;

/** Return the ids of the new entries a version makes, alone or in a new section. */
function listMadeEntryIds({ newContentIds: ids }: ProposalVersion): string[] {
  if (ids?.kind === 'entry') return [ids.entry.entryId];
  if (ids?.kind === 'section' && ids.contents?.layout === 'entries') {
    return ids.contents.entries.map((entry) => entry.entryId);
  }
  return [];
}

/** Check whether a new section can take contents of this layout: it is empty, or already holds that layout. */
function canSectionHold({ change }: SectionVersion, layout: 'entries' | 'lines'): boolean {
  return change.contents === null || change.contents.layout === layout;
}

/** Check whether a change goes into the new section or new entry that this version makes. */
function isFillTarget(version: ProposalVersion, change: ProposalChange): boolean {
  const isSectionFor = (sectionId: string, layout: 'entries' | 'lines') =>
    isSectionVersion(version) &&
    version.newContentIds.sectionId === sectionId &&
    canSectionHold(version, layout);
  if (change.kind === 'entry') return isSectionFor(change.sectionId, 'entries');
  if (change.kind !== 'add') return false;
  if (change.place.unit === 'line') return isSectionFor(change.place.sectionId, 'lines');
  return listMadeEntryIds(version).includes(change.place.entryId);
}

/**
 * Find the waiting suggestion that this change should be added to: the suggestion for the
 * new section or new entry the change adds to. Returns null when there is none, when the
 * user already kept that suggestion, or when the change doesn't fit there (for example, a
 * line added to a section that holds entries).
 */
export function findSuggestionToFill(
  proposals: readonly Proposal[],
  change: ProposalChange
): Proposal | null {
  return (
    proposals
      .filter(isWaiting)
      .find((proposal) => isFillTarget(readActiveVersion(proposal), change)) ?? null
  );
}

/** Return the ids of the new sections that waiting suggestions made and that are still empty. */
export function listEmptySectionIds(proposals: readonly Proposal[]): Set<string> {
  const emptySections = proposals
    .filter((proposal) => proposal.status === 'pending')
    .map(readActiveVersion)
    .filter(
      (version): version is SectionVersion =>
        isSectionVersion(version) && version.change.contents === null
    );
  return new Set(emptySections.map((version) => version.newContentIds.sectionId));
}

const insertAt = <T>(list: readonly T[], index: number, value: T) => [
  ...list.slice(0, index),
  value,
  ...list.slice(index),
];

/** Return the position right after `afterId` in `ids`, or 0 when it is null or not there. */
const readPositionAfter = (ids: readonly string[], afterId: string | null | undefined) =>
  afterId ? ids.indexOf(afterId) + 1 : 0;

type Filled = Pick<FilledContents, 'change' | 'newContentIds'>;

function fillWithLine(
  { change, newContentIds }: SectionVersion,
  line: AddChange,
  lineIds: AddIds
): Filled {
  const lines = change.contents?.layout === 'lines' ? change.contents.lines : [];
  const knownIds = newContentIds.contents?.layout === 'lines' ? newContentIds.contents.lineIds : [];
  const index = readPositionAfter(knownIds, line.afterId);
  return {
    change: { ...change, contents: { layout: 'lines', lines: insertAt(lines, index, line.text) } },
    newContentIds: {
      ...newContentIds,
      contents: { layout: 'lines', lineIds: insertAt(knownIds, index, lineIds.id) },
    },
  };
}

function fillWithEntry(
  { change, newContentIds }: SectionVersion,
  { frame, bullets, gaps, afterEntryId }: EntryChange,
  entryIds: EntryIds
): Filled {
  const entries = change.contents?.layout === 'entries' ? change.contents.entries : [];
  const knownIds =
    newContentIds.contents?.layout === 'entries' ? newContentIds.contents.entries : [];
  const index = readPositionAfter(
    knownIds.map((ids) => ids.entryId),
    afterEntryId
  );
  return {
    change: {
      ...change,
      // An empty custom section holds whatever goes in first, so it now holds entries.
      section: { ...change.section, layout: 'entries' },
      contents: {
        layout: 'entries',
        entries: insertAt(entries, index, { frame, bullets, gaps }),
      },
    },
    newContentIds: {
      ...newContentIds,
      contents: { layout: 'entries', entries: insertAt(knownIds, index, entryIds.entry) },
    },
  };
}

/**
 * Return the entry and its ids with the bullet added after `afterId`. A bullet with a
 * number to fill keeps its version without a number, under its new id.
 */
function addBulletToEntry(
  entry: { draft: EntryDraft; ids: NewEntryIds },
  bullet: AddChange,
  bulletIds: AddIds
): { draft: EntryDraft; ids: NewEntryIds } {
  const index = readPositionAfter(entry.ids.bulletIds, bullet.afterId);
  const { gaps } = entry.draft;
  return {
    draft: {
      ...entry.draft,
      bullets: insertAt(entry.draft.bullets, index, bullet.text),
      gaps: bullet.gap ? { ...gaps, [bulletIds.id]: bullet.gap } : gaps,
    },
    ids: { ...entry.ids, bulletIds: insertAt(entry.ids.bulletIds, index, bulletIds.id) },
  };
}

function fillEntryWithBullet(
  { change, newContentIds }: EntryVersion,
  bullet: AddChange,
  bulletIds: AddIds
): Filled {
  const { draft, ids } = addBulletToEntry(
    { draft: change, ids: newContentIds.entry },
    bullet,
    bulletIds
  );
  return {
    change: { ...change, bullets: draft.bullets, gaps: draft.gaps },
    newContentIds: { ...newContentIds, entry: ids },
  };
}

function fillSectionEntryWithBullet(
  { change, newContentIds }: SectionVersion,
  bullet: AddChange & { place: { unit: 'bullet' } },
  bulletIds: AddIds
): Filled | null {
  const { contents } = change;
  const knownIds = newContentIds.contents;
  if (contents?.layout !== 'entries' || knownIds?.layout !== 'entries') return null;
  const index = knownIds.entries.findIndex((ids) => ids.entryId === bullet.place.entryId);
  if (index < 0) return null;
  const filled = addBulletToEntry(
    { draft: contents.entries[index], ids: knownIds.entries[index] },
    bullet,
    bulletIds
  );
  const replaceAt = <T>(list: readonly T[], value: T) =>
    list.map((each, position) => (position === index ? value : each));
  return {
    change: {
      ...change,
      contents: { ...contents, entries: replaceAt(contents.entries, filled.draft) },
    },
    newContentIds: {
      ...newContentIds,
      contents: { ...knownIds, entries: replaceAt(knownIds.entries, filled.ids) },
    },
  };
}

/** Write the change into the version. Returns null when the change doesn't fit there. */
function fillWith(
  version: FillableVersion,
  change: ProposalChange,
  filledIds: NewContentIds | null
): Filled | null {
  if (change.kind === 'entry' && filledIds?.kind === 'entry' && isSectionVersion(version)) {
    return fillWithEntry(version, change, filledIds);
  }
  if (change.kind !== 'add' || filledIds?.kind !== 'add') return null;
  const { place } = change;
  if (place.unit === 'line') {
    return isSectionVersion(version) ? fillWithLine(version, change, filledIds) : null;
  }
  return isEntryVersion(version)
    ? fillEntryWithBullet(version, change, filledIds)
    : fillSectionEntryWithBullet(version, { ...change, place }, filledIds);
}

/** Return the id to label "just added": the added entry or bullet. An added line gets no label. */
function readTaggedId(filledIds: NewContentIds): string | null {
  if (filledIds.kind === 'entry') return filledIds.entry.entryId;
  return filledIds.kind === 'add' ? filledIds.id : null;
}

/**
 * Write the change into a version of a suggestion and return the result.
 * `findSuggestionToFill` must have returned that suggestion for this change. Set `isLate`
 * when the change comes from a later run than the one that made the version. The added
 * entry or bullet is then labelled "just added" on the card.
 */
export function fillSuggestion(
  version: ProposalVersion,
  change: ProposalChange,
  isLate: boolean
): FilledContents {
  const filledIds = createNewContentIds(change);
  const isFillable = isSectionVersion(version) || isEntryVersion(version);
  const filled = isFillable ? fillWith(version, change, filledIds) : null;
  if (!filled || !filledIds) {
    throw new Error(
      `Expected an entry, line or bullet that fits the "${version.change.kind}" suggestion version "${version.id}", received "${change.kind}"`
    );
  }
  const taggedId = isLate ? readTaggedId(filledIds) : null;
  const lateIds = taggedId ? [...(version.lateIds ?? []), taggedId] : version.lateIds;
  return { ...filled, lateIds, filledIds };
}
