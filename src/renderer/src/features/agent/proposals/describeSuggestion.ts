import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import type { ResumeData, ResumeEntry } from '@shared/types/resume';
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
  entry: () => 'New entry',
};

export function labelSuggestionKind(change: ProposalChange): string {
  return KIND_LABELS[change.kind](change);
}

/** An entry as the user knows it: where, else what, else its place in the section. */
function nameEntry(entry: ResumeEntry, index: number): string {
  return entry.organization?.trim() || entry.title?.trim() || `entry ${index + 1}`;
}

/** Its place, from the section down: the section's label, the entry, then the bullets. */
export function placeSuggestion(doc: ResumeData, change: ProposalChange): string[] {
  const section = findSection(doc, change.sectionId);
  if (!section) return [];
  const entryName = (entryId: string) => {
    const index = section.items.findIndex((item) => item.id === entryId);
    return index >= 0 ? nameEntry(section.items[index], index) : null;
  };
  const bulletNumber = (entryId: string, bulletId: string) =>
    (findEntry(doc, change.sectionId, entryId)?.bullets.findIndex((b) => b.id === bulletId) ?? -1) +
    1;
  const path = (...parts: (string | null)[]) =>
    [section.label, ...parts].filter((part): part is string => !!part);

  switch (change.kind) {
    case 'rewrite':
    case 'split':
    case 'select':
      return path(
        entryName(change.entryId),
        `bullet ${bulletNumber(change.entryId, change.bulletId)}`
      );
    case 'merge': {
      const first = bulletNumber(change.entryId, change.firstId);
      return path(entryName(change.entryId), `bullets ${first} and ${first + 1}`);
    }
    case 'reorder':
      return path(change.entryId ? entryName(change.entryId) : null);
    case 'entry': {
      const after = change.afterEntryId && entryName(change.afterEntryId);
      return path(after ? `new entry, after ${after}` : 'new entry, first');
    }
  }
}

/**
 * The title of the version an apply adds: what it holds, never a count against the turn.
 * One: "Rewrite in Harbor Freight Labs, bullet 3". More: "4 suggestions in Harbor Freight
 * Labs and Lantern Geo", or "in 3 places".
 */
export function describeLandedSuggestions(doc: ResumeData, landed: readonly Proposal[]): string {
  const places = landed.map((proposal) => placeSuggestion(doc, proposal.change));
  if (landed.length === 1) {
    const [section, ...rest] = places[0];
    return `${labelSuggestionKind(landed[0].change)} in ${rest.join(', ') || section}`;
  }
  const entries = [
    ...new Set(
      places.map(([section, entry]) => (entry && !entry.startsWith('new entry') ? entry : section))
    ),
  ];
  const where = entries.length <= 2 ? entries.join(' and ') : `${entries.length} places`;
  return `${landed.length} suggestions in ${where}`;
}
