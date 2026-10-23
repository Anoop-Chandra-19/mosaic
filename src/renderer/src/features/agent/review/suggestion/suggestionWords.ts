import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { AddPlace, ProposalChange, TextPlace } from '@shared/types/agentProposal';
import type { ResumeData, ResumeEntry } from '@shared/types/resume';
import { findEntry, findSection } from '../../proposals/proposalAnchor';

/*
 * The words a suggestion's card uses for what it is about: "this bullet", "your summary",
 * "Harbor Freight Labs", and what an out-of-date one says changed under it.
 */

/** What a card calls the text it is about. */
export type TextNoun = 'bullet' | 'line' | 'summary';

/** A line of the Summary is "your summary"; any other line is "this line". */
export function nameTextPlace(draft: ResumeData, place: TextPlace | AddPlace): TextNoun {
  if (place.unit === 'bullet') return 'bullet';
  return findSection(draft, place.sectionId)?.kind === 'summary' ? 'summary' : 'line';
}

/** An entry as the user knows it: where, else what. */
export const nameEntry = (entry: ResumeEntry | undefined) =>
  entry?.organization?.trim() ||
  entry?.title?.trim() ||
  formatEntryHeading(entry ?? {}) ||
  'this entry';

/** The bullets or lines new text goes among, and the entry or section they belong to. */
export function nameAddedContainer(draft: ResumeData, place: AddPlace): string {
  if (place.unit === 'bullet') return nameEntry(findEntry(draft, place.sectionId, place.entryId));
  return findSection(draft, place.sectionId)?.label ?? 'this section';
}

const TEXT_STALE: Record<TextNoun, string> = {
  bullet: 'You changed this bullet after it was suggested, so it no longer fits your text.',
  line: 'You changed this line after it was suggested, so it no longer fits your text.',
  summary: 'You changed your summary after it was suggested, so it no longer fits your text.',
};

/** What an out-of-date suggestion says changed under it, in one sentence. */
export function describeStaleChange(draft: ResumeData, change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
      return TEXT_STALE[nameTextPlace(draft, change.place)];
    case 'split':
    case 'merge':
      return TEXT_STALE.bullet;
    case 'add': {
      const noun = change.place.unit === 'line' ? 'line' : 'bullet';
      return `The ${noun} it was to follow is gone, so this has no place to go.`;
    }
    case 'reorder': {
      const items = change.place.unit === 'bullets' ? 'bullets' : 'entries';
      return `You reordered these ${items} after this order was suggested.`;
    }
    case 'select':
      return TEXT_STALE[nameTextPlace(draft, change.place)];
    case 'entry':
      return 'The entry it was to follow is gone, so this has no place to go.';
  }
}
