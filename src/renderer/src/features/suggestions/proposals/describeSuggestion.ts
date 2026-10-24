import type { Proposal, ProposalChange, TextPlace } from '@shared/types/agentProposal';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { findEntry, findSection } from './proposalAnchor';

/*
 * How a suggestion is named to the user, in review and in history: its kind ("Rewrite"),
 * and its place on the resume ("Experience › Harbor Freight Labs › bullet 3"). Read
 * against the draft it was suggested for, before anything is applied.
 */

const KIND_LABELS: Record<ProposalChange['kind'], (change: ProposalChange) => string> = {
  rewrite: () => 'Rewrite',
  split: () => 'Split',
  merge: () => 'Merge',
  reorder: () => 'Reorder',
  select: (change) => (change.kind === 'select' && change.selected ? 'Show' : 'Hide'),
  add: (change) =>
    change.kind === 'add' && change.place.unit === 'line' ? 'New line' : 'New bullet',
  entry: () => 'New entry',
  section: () => 'New section',
  rename: () => 'Rename',
};

export function labelSuggestionKind(change: ProposalChange): string {
  return KIND_LABELS[change.kind](change);
}

/** An entry as the user knows it: where, else what, else its place in the section. */
function nameEntry(entry: ResumeEntry, index: number): string {
  return entry.organization?.trim() || entry.title?.trim() || `entry ${index + 1}`;
}

/** The parts of a place below its section, each named as the user knows it. */
function nameWithin(doc: ResumeData, section: ResumeSection) {
  const entry = (entryId: string) => {
    const index = section.items.findIndex((item) => item.id === entryId);
    return index >= 0 ? nameEntry(section.items[index], index) : null;
  };
  const bulletNumber = (entryId: string, bulletId: string) =>
    (findEntry(doc, section.id, entryId)?.bullets.findIndex((b) => b.id === bulletId) ?? -1) + 1;
  const bullet = (entryId: string, bulletId: string) => `bullet ${bulletNumber(entryId, bulletId)}`;
  const line = (lineId: string) =>
    `line ${section.items.findIndex((item) => item.id === lineId) + 1}`;
  const text = (place: TextPlace) =>
    place.unit === 'line'
      ? [line(place.lineId)]
      : [entry(place.entryId), bullet(place.entryId, place.bulletId)];
  return { entry, bulletNumber, bullet, line, text };
}

/** The section a change is in; a new section and the sections' order are in none. */
function readSectionId(change: ProposalChange): string | null {
  switch (change.kind) {
    case 'rewrite':
    case 'select':
    case 'add':
      return change.place.sectionId;
    case 'reorder':
      return change.place.unit === 'sections' ? null : change.place.sectionId;
    case 'section':
      return null;
    default:
      return change.sectionId;
  }
}

/** Where added text goes: "after bullet 2", or "first". The kind's label says what it is. */
function nameAddedPlace(
  doc: ResumeData,
  section: ResumeSection,
  change: Extract<ProposalChange, { kind: 'add' }>
): (string | null)[] {
  const within = nameWithin(doc, section);
  const { place, afterId } = change;
  if (place.unit === 'line') {
    return [afterId ? `after ${within.line(afterId)}` : 'first'];
  }
  return [
    within.entry(place.entryId),
    afterId ? `after ${within.bullet(place.entryId, afterId)}` : 'first',
  ];
}

/**
 * Its place, from the section down: the section's label, the entry, then the bullets. What
 * is new is placed, not named ("after Lantern Maps"): the kind's label goes beside it.
 */
export function placeSuggestion(doc: ResumeData, change: ProposalChange): string[] {
  if (change.kind === 'section') return [change.section.label];
  const sectionId = readSectionId(change);
  if (sectionId === null) return ['Section order'];
  const section = findSection(doc, sectionId);
  if (!section) return [];
  const within = nameWithin(doc, section);
  const path = (...parts: (string | null)[]) =>
    [section.label, ...parts].filter((part): part is string => !!part);

  switch (change.kind) {
    case 'rewrite':
      return path(...within.text(change.place));
    case 'select': {
      const { place } = change;
      if (place.unit === 'section') return path();
      if (place.unit === 'entry') return path(within.entry(place.entryId));
      return path(...within.text(place));
    }
    case 'split':
      return path(within.entry(change.entryId), within.bullet(change.entryId, change.bulletId));
    case 'merge': {
      const first = within.bulletNumber(change.entryId, change.firstId);
      return path(within.entry(change.entryId), `bullets ${first} and ${first + 1}`);
    }
    case 'reorder':
      return path(change.place.unit === 'bullets' ? within.entry(change.place.entryId) : null);
    case 'add':
      return path(...nameAddedPlace(doc, section, change));
    case 'entry': {
      const after = change.afterEntryId && within.entry(change.afterEntryId);
      return path(after ? `after ${after}` : 'first');
    }
    case 'rename':
      return path('heading');
  }
}

/** The entry a change is inside, if it is inside one: a bullet's, or an entry's own. */
function readEntryId(change: ProposalChange): string | null {
  switch (change.kind) {
    case 'rewrite':
    case 'select':
    case 'add':
      return 'entryId' in change.place ? change.place.entryId : null;
    case 'reorder':
      return change.place.unit === 'bullets' ? change.place.entryId : null;
    case 'split':
    case 'merge':
      return change.entryId;
    default:
      return null;
  }
}

/** Where a landed suggestion is, for a version's title: its entry, else its section. */
function nameWhere(doc: ResumeData, change: ProposalChange): string {
  const [section, entryName] = placeSuggestion(doc, change);
  return readEntryId(change) && entryName ? entryName : section;
}

/**
 * The title of the version an apply adds: what it holds, never a count against the turn.
 * One: "Rewrite in Harbor Freight Labs, bullet 3". More: "4 suggestions in Harbor Freight
 * Labs and Lantern Geo", or "in 3 places".
 */
export function describeLandedSuggestions(doc: ResumeData, landed: readonly Proposal[]): string {
  if (landed.length === 1) {
    const { change } = landed[0];
    if (change.kind === 'section') return `${labelSuggestionKind(change)}, ${change.section.label}`;
    const [section, ...rest] = placeSuggestion(doc, change);
    // Within an entry, the entry names it; otherwise the section does ("Summary, line 2").
    const where = readEntryId(change) ? rest : [section, ...rest];
    return `${labelSuggestionKind(change)} in ${where.join(', ')}`;
  }
  const entries = [...new Set(landed.map((proposal) => nameWhere(doc, proposal.change)))];
  const where = entries.length <= 2 ? entries.join(' and ') : `${entries.length} places`;
  return `${landed.length} suggestions in ${where}`;
}
