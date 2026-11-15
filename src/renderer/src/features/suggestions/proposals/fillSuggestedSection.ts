import type {
  NewContentIds,
  Proposal,
  ProposalChange,
  SectionContents,
} from '@/types/agentProposal';
import { createNewContentIds } from './newContentIds';

/*
 * Put a new line or a first entry into a section that a waiting suggestion made.
 *
 * The assistant makes a new section empty and then fills it. What it puts in does not
 * become more suggestions. It goes into the section's suggestion, so the user reviews
 * the section, its place and its contents as one card.
 *
 * A section's suggestion holds its lines, or its first entry. Anything else added to the
 * section is a suggestion of its own: a second entry, or a bullet in the first entry.
 *
 * Staging calls `findSectionToFill` for each change, and `fillSection` when it finds one.
 */

type SectionChange = Extract<ProposalChange, { kind: 'section' }>;
type SectionIds = Extract<NewContentIds, { kind: 'section' }>;

/** A change that can go into a new section: a line, or an entry. */
type SectionFilling =
  | Extract<ProposalChange, { kind: 'entry' }>
  | (Extract<ProposalChange, { kind: 'add' }> & { place: { unit: 'line' } });

/** A waiting suggestion for a new section, with the ids staging gave it. */
type SectionSuggestion = Proposal & { change: SectionChange; newContentIds: SectionIds };

export interface FilledSection {
  /** The section's change with the new contents in it. */
  change: SectionChange;
  /** The section's ids with the ids of the new contents added. */
  newContentIds: SectionIds;
  /** The ids of only the line or entry that was put in. */
  filledIds: NewContentIds;
}

const isSectionSuggestion = (proposal: Proposal): proposal is SectionSuggestion =>
  proposal.change.kind === 'section' && proposal.newContentIds?.kind === 'section';

function isFilling(change: ProposalChange): change is SectionFilling {
  return change.kind === 'entry' || (change.kind === 'add' && change.place.unit === 'line');
}

const readSectionId = (filling: SectionFilling) =>
  filling.kind === 'entry' ? filling.sectionId : filling.place.sectionId;

/** A section's suggestion holds one entry, so an entry goes in only while it is empty. */
const hasRoomFor = (contents: SectionContents | null, filling: SectionFilling) =>
  filling.kind === 'entry' ? contents === null : contents?.layout !== 'entries';

/**
 * Find the waiting suggestion whose new section this change adds to, when the change can
 * go into that suggestion. Returns null for any other change, for a section the user
 * already kept, and for contents the section's suggestion can't hold.
 */
export function findSectionToFill(
  proposals: readonly Proposal[],
  change: ProposalChange
): SectionSuggestion | null {
  if (!isFilling(change)) return null;
  const sectionId = readSectionId(change);
  const suggestion = proposals.find(
    (proposal): proposal is SectionSuggestion =>
      isSectionSuggestion(proposal) &&
      proposal.status === 'pending' &&
      !proposal.isStale &&
      proposal.newContentIds.sectionId === sectionId
  );
  return suggestion && hasRoomFor(suggestion.change.contents, change) ? suggestion : null;
}

/** Return the ids of an empty section that waiting suggestions made and nothing has gone into. */
export function listEmptySectionIds(proposals: readonly Proposal[]): Set<string> {
  const empty = proposals.filter(
    (proposal): proposal is SectionSuggestion =>
      isSectionSuggestion(proposal) &&
      proposal.status === 'pending' &&
      proposal.change.contents === null
  );
  return new Set(empty.map((proposal) => proposal.newContentIds.sectionId));
}

const insertAt = <T>(list: readonly T[], index: number, value: T) => [
  ...list.slice(0, index),
  value,
  ...list.slice(index),
];

function fillWithLine(
  { change, newContentIds }: SectionSuggestion,
  filling: Extract<SectionFilling, { kind: 'add' }>,
  filledIds: Extract<NewContentIds, { kind: 'add' }>
): Pick<FilledSection, 'change' | 'newContentIds'> {
  const lines = change.contents?.layout === 'lines' ? change.contents.lines : [];
  const lineIds = newContentIds.contents?.layout === 'lines' ? newContentIds.contents.lineIds : [];
  const index = filling.afterId === null ? 0 : lineIds.indexOf(filling.afterId) + 1;
  return {
    change: {
      ...change,
      contents: { layout: 'lines', lines: insertAt(lines, index, filling.text) },
    },
    newContentIds: {
      ...newContentIds,
      contents: { layout: 'lines', lineIds: insertAt(lineIds, index, filledIds.id) },
    },
  };
}

function fillWithEntry(
  { change, newContentIds }: SectionSuggestion,
  { frame, bullets }: Extract<SectionFilling, { kind: 'entry' }>,
  filledIds: Extract<NewContentIds, { kind: 'entry' }>
): Pick<FilledSection, 'change' | 'newContentIds'> {
  return {
    change: {
      ...change,
      // An empty custom section holds whatever goes in first, so it now holds entries.
      section: { ...change.section, layout: 'entries' },
      contents: { layout: 'entries', entry: { frame, bullets } },
    },
    newContentIds: {
      ...newContentIds,
      contents: { layout: 'entries', entry: filledIds.entry },
    },
  };
}

/**
 * Return the section's suggestion with the change put into it. `findSectionToFill` must
 * have returned this suggestion for this change.
 */
export function fillSection(suggestion: Proposal, change: ProposalChange): FilledSection {
  const filledIds = createNewContentIds(change);
  if (isSectionSuggestion(suggestion) && isFilling(change)) {
    if (change.kind === 'add' && filledIds?.kind === 'add') {
      return { ...fillWithLine(suggestion, change, filledIds), filledIds };
    }
    if (change.kind === 'entry' && filledIds?.kind === 'entry') {
      return { ...fillWithEntry(suggestion, change, filledIds), filledIds };
    }
  }
  throw new Error(
    `Expected a line or an entry to put into a new section's suggestion, received "${change.kind}" for a "${suggestion.change.kind}" suggestion`
  );
}
