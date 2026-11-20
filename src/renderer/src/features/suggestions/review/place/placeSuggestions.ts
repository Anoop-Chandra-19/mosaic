import { findSection } from '@/lib/resume/proposalAnchor';
import type { Proposal, ProposalChange } from '@/types/agentProposal';
import type { ResumeData, ResumeSection } from '@shared/types/resume';
import {
  labelSuggestionKind,
  nameEntry,
  placeSuggestion,
  readEntryId,
  readSectionId,
} from '../../proposals/describeSuggestion';
import { findUnconfirmedFacts, resolveChange } from '../../proposals/reviewedChange';
import { readSuggestionState } from '../../suggestionState';

/*
 * Review by place. The inspector and Compare all show one card for each place on the page
 * that has suggestions. A place is an existing entry, an existing section (its heading,
 * its lines, and whether it shows), the order of the sections, a new entry, or a new
 * section. Each place lists its suggestions in the order the assistant made them.
 *
 * The places are listed in the order the review's page shows them, with the suggestions
 * laid in: after a suggested reorder, the sections are in their new order, and a new
 * section or entry is where it would go. Places are named as the draft names them.
 *
 * `groupSuggestionsByPlace` makes the places. The cards (`PlaceCard`, `SuggestionDocument`)
 * use the tally functions at the end of this file.
 */

export type PlaceKind = 'order' | 'section' | 'entry' | 'newSection' | 'newEntry' | 'missing';

export interface SuggestionPlace {
  key: string;
  kind: PlaceKind;
  /** The name of the place as the page shows it: an entry's organization, or a section's label. */
  title: string;
  /** The line under the name: an entry's job title, or what kind of place this is. */
  detail: string;
  /** The label of the section an existing entry is in. Set only for existing entries. */
  sectionLabel?: string;
  proposals: Proposal[];
}

type PlaceName = Omit<SuggestionPlace, 'proposals'>;

/**
 * Where a place is on the review's page, as three numbers compared in turn:
 * 1. the position of the section;
 * 2. the part of that section: 0 for the section itself, 1 for its entries, 2 for a new
 *    section that isn't on the page, placed after the section it follows;
 * 3. the position of the entry in the section.
 * Something that can't be found on the page goes last.
 */
type PagePosition = [number, number, number];

interface LocatedPlace {
  name: PlaceName;
  position: PagePosition;
}

const SECTION_ORDER_PLACE: LocatedPlace = {
  name: { key: 'order', kind: 'order', title: 'Section order', detail: 'The whole resume' },
  position: [-1, 0, 0],
};

const AT_THE_END: PagePosition = [Infinity, 0, 0];

const SECTION_DETAILS: Record<ResumeSection['layout'], string> = {
  entries: 'Section',
  lines: 'Section of lines',
};

const findSectionIndex = (page: ResumeData, sectionId: string | null) =>
  page.sections.findIndex((section) => section.id === sectionId);

const findEntryIndex = (section: ResumeSection, entryId: string | undefined) =>
  section.items.findIndex((item) => item.id === entryId);

/** Find an entry on the page. Returns null when its section or the entry isn't there. */
function findEntryOnPage(
  page: ResumeData,
  sectionId: string,
  entryId: string | undefined
): PagePosition | null {
  const sectionIndex = findSectionIndex(page, sectionId);
  if (sectionIndex < 0) return null;
  const entryIndex = findEntryIndex(page.sections[sectionIndex], entryId);
  return entryIndex < 0 ? null : [sectionIndex, 1, entryIndex];
}

function locateSection(page: ResumeData, section: ResumeSection): LocatedPlace {
  const sectionIndex = findSectionIndex(page, section.id);
  return {
    name: {
      key: `section:${section.id}`,
      kind: 'section',
      title: section.label,
      detail: SECTION_DETAILS[section.layout],
    },
    position: sectionIndex < 0 ? AT_THE_END : [sectionIndex, 0, 0],
  };
}

function locateEntry(
  page: ResumeData,
  section: ResumeSection,
  entryIndexInDraft: number
): LocatedPlace {
  const entry = section.items[entryIndexInDraft];
  // When the organization names the entry, the job title goes on the line under it.
  const jobTitle = entry.organization?.trim() ? (entry.title?.trim() ?? '') : '';
  return {
    name: {
      key: `entry:${entry.id}`,
      kind: 'entry',
      title: nameEntry(entry, entryIndexInDraft),
      detail: jobTitle,
      sectionLabel: section.label,
    },
    position: findEntryOnPage(page, section.id, entry.id) ?? AT_THE_END,
  };
}

/**
 * Find a new entry on the page. When it isn't laid in (dropped or out of date), it goes
 * just after the entry it follows, or before every entry when it has none to follow.
 */
function findNewEntryOnPage(
  page: ResumeData,
  proposal: Proposal,
  change: Extract<ProposalChange, { kind: 'entry' }>
): PagePosition {
  const { newContentIds } = proposal;
  const newEntryId = newContentIds?.kind === 'entry' ? newContentIds.entry.entryId : undefined;
  const laidIn = findEntryOnPage(page, change.sectionId, newEntryId);
  if (laidIn) return laidIn;
  const sectionIndex = findSectionIndex(page, change.sectionId);
  if (sectionIndex < 0) return AT_THE_END;
  if (change.afterEntryId === undefined) return [sectionIndex, 1, -0.5];
  const followedIndex = findEntryIndex(page.sections[sectionIndex], change.afterEntryId);
  return followedIndex < 0 ? AT_THE_END : [sectionIndex, 1, followedIndex + 0.5];
}

function locateNewEntry(
  page: ResumeData,
  proposal: Proposal,
  change: Extract<ProposalChange, { kind: 'entry' }>,
  section: ResumeSection
): LocatedPlace {
  const { organization, title } = change.frame;
  return {
    name: {
      key: `new:${proposal.id}`,
      kind: 'newEntry',
      title: organization?.trim() || title?.trim() || 'New entry',
      detail: `New entry in ${section.label}`,
    },
    position: findNewEntryOnPage(page, proposal, change),
  };
}

/**
 * Find a new section on the page. When it isn't laid in (dropped or out of date), it goes
 * after everything in the section it follows, or first when it has none to follow.
 */
function findNewSectionOnPage(
  page: ResumeData,
  proposal: Proposal,
  change: Extract<ProposalChange, { kind: 'section' }>
): PagePosition {
  const { newContentIds } = proposal;
  const newSectionId = newContentIds?.kind === 'section' ? newContentIds.sectionId : null;
  const laidInIndex = findSectionIndex(page, newSectionId);
  if (laidInIndex >= 0) return [laidInIndex, 0, 0];
  if (change.afterSectionId === null) return [-0.5, 0, 0];
  const followedIndex = findSectionIndex(page, change.afterSectionId);
  return followedIndex < 0 ? AT_THE_END : [followedIndex, 2, 0];
}

function locateNewSection(
  draft: ResumeData,
  page: ResumeData,
  proposal: Proposal,
  change: Extract<ProposalChange, { kind: 'section' }>
): LocatedPlace {
  const followedSection = change.afterSectionId && findSection(draft, change.afterSectionId);
  return {
    name: {
      key: `new:${proposal.id}`,
      kind: 'newSection',
      title: change.section.label,
      detail: followedSection ? `New section, after ${followedSection.label}` : 'New section',
    },
    position: findNewSectionOnPage(page, proposal, change),
  };
}

/** An out-of-date suggestion whose section is gone gets a card of its own, at the end. */
function locateMissingPlace(proposalId: string, change: ProposalChange): LocatedPlace {
  return {
    name: {
      key: `missing:${proposalId}`,
      kind: 'missing',
      title: labelSuggestionKind(change),
      detail: 'Its place is no longer in your draft',
    },
    position: AT_THE_END,
  };
}

/**
 * Find the place a suggestion belongs to, named from the draft and positioned on the page.
 * A change inside an entry that the draft no longer has belongs to that entry's section.
 */
function locateSuggestion(draft: ResumeData, page: ResumeData, proposal: Proposal): LocatedPlace {
  // Use the change as the user reviewed it, so a new section or entry shows the name they gave it.
  const change = resolveChange(proposal);
  if (change.kind === 'section') return locateNewSection(draft, page, proposal, change);
  const sectionId = readSectionId(change);
  if (sectionId === null) return SECTION_ORDER_PLACE;
  const section = findSection(draft, sectionId);
  if (!section) return locateMissingPlace(proposal.id, change);
  if (change.kind === 'entry') return locateNewEntry(page, proposal, change, section);
  const entryId = readEntryId(change);
  const entryIndex = entryId ? findEntryIndex(section, entryId) : -1;
  return entryIndex < 0 ? locateSection(page, section) : locateEntry(page, section, entryIndex);
}

function comparePagePositions(first: PagePosition, second: PagePosition): number {
  for (let i = 0; i < first.length; i++) {
    if (first[i] < second[i]) return -1;
    if (first[i] > second[i]) return 1;
  }
  return 0;
}

/**
 * Group the suggestions by their place, with the places in the order the page shows them.
 * `draft` names the places. `page` is the draft with the suggestions laid in, as the review
 * shows it (`buildSuggestionPage`), and gives their order.
 */
export function groupSuggestionsByPlace(
  draft: ResumeData,
  page: ResumeData,
  proposals: readonly Proposal[]
): SuggestionPlace[] {
  const groupsByKey = new Map<string, { place: SuggestionPlace; position: PagePosition }>();
  for (const proposal of proposals) {
    const { name, position } = locateSuggestion(draft, page, proposal);
    const existingGroup = groupsByKey.get(name.key);
    if (existingGroup) existingGroup.place.proposals.push(proposal);
    else groupsByKey.set(name.key, { place: { ...name, proposals: [proposal] }, position });
  }
  return [...groupsByKey.values()]
    .sort((first, second) => comparePagePositions(first.position, second.position))
    .map(({ place }) => place);
}

/**
 * Name a suggestion inside its place: its kind, and the part of the place it changes
 * ("Rewrite, bullet 3"). The card already names the entry or section.
 */
export function nameSuggestionInPlace(draft: ResumeData, proposal: Proposal): string {
  const target = placeSuggestion(draft, proposal.change).at(-1);
  const kind = labelSuggestionKind(proposal.change);
  return target ? `${kind}, ${target}` : kind;
}

/** List every suggestion, place by place. This is the order the j and k keys move in. */
export const orderSuggestionsByPlace = (places: readonly SuggestionPlace[]): Proposal[] =>
  places.flatMap((place) => place.proposals);

/** Check whether the user has finished with a suggestion: it is kept, dropped or out of date. */
export const isDecided = (proposal: Proposal) => readSuggestionState(proposal) !== 'waiting';

/** Check whether a waiting suggestion has flags from the checks or facts to confirm. */
const hasSomethingToCheck = (proposal: Proposal) =>
  proposal.flags.length > 0 || findUnconfirmedFacts(proposal).length > 0;

/**
 * Return the waiting suggestions that can be kept without a closer look: no flags from the
 * checks and no facts to confirm. A number still to fill is one of the flags.
 */
export const listEasySuggestions = (proposals: readonly Proposal[]): Proposal[] =>
  proposals.filter((proposal) => !isDecided(proposal) && !hasSomethingToCheck(proposal));

/**
 * Check whether a place's card is folded to one line. The user's own choice wins. Otherwise
 * it folds once every suggestion in it is decided, unless one of them is selected.
 */
export function isPlaceFolded(
  place: SuggestionPlace,
  selectedId: string | null,
  foldedByUser: boolean | undefined
): boolean {
  if (foldedByUser !== undefined) return foldedByUser;
  const hasSelected = place.proposals.some((proposal) => proposal.id === selectedId);
  return !hasSelected && place.proposals.every(isDecided);
}

export interface PlaceTally {
  kept: number;
  dropped: number;
  waiting: number;
  stale: number;
  /** The waiting suggestions that have flags or facts to confirm. */
  toCheck: number;
}

export function tallyPlace(proposals: readonly Proposal[]): PlaceTally {
  const tally: PlaceTally = { kept: 0, dropped: 0, waiting: 0, stale: 0, toCheck: 0 };
  for (const proposal of proposals) {
    const state = readSuggestionState(proposal);
    if (state === 'kept' || state === 'held') tally.kept++;
    else if (state === 'dropped') tally.dropped++;
    else if (state === 'stale') tally.stale++;
    else tally.waiting++;
    if (state === 'waiting' && hasSomethingToCheck(proposal)) tally.toCheck++;
  }
  return tally;
}

/** Write the tally in words, such as "3 kept · 1 dropped · 2 waiting". Counts of zero are left out. */
export function formatPlaceTally(tally: PlaceTally): string {
  const parts = [
    tally.kept > 0 && `${tally.kept} kept`,
    tally.dropped > 0 && `${tally.dropped} dropped`,
    tally.waiting > 0 && `${tally.waiting} waiting`,
    tally.stale > 0 && `${tally.stale} out of date`,
  ];
  return parts.filter(Boolean).join(' · ');
}
