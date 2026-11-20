import { formatEntryHeading } from '@/lib/resume/entryHeading';
import { findEntry, findSection } from '@/lib/resume/proposalAnchor';
import type {
  AddPlace,
  EntryDraft,
  NewContentIds,
  NewEntryIds,
  ProposalChange,
  ProposalFlag,
} from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { checkClaimsMore } from './claimsMore';
import { checkDoubledWords } from './doubledWords';
import { checkNewNames } from './newNames';
import { checkNewNumbers } from './newNumbers';
import { checkRemovedDetail } from './removedDetail';
import { checkUnfilledGap } from './unfilledGap';

type TextCheck = (before: string, after: string, requestText: string) => ProposalFlag[];

const TEXT_CHECKS: TextCheck[] = [
  checkDoubledWords,
  checkClaimsMore,
  checkNewNumbers,
  checkRemovedDetail,
  checkNewNames,
  checkUnfilledGap,
];

/**
 * What new text sits among, which it may repeat without being new: an entry's heading and
 * bullets, or a section's lines. Nothing is removed by adding, so it is never "before".
 */
function readAddedContext(doc: ResumeData, place: AddPlace): string {
  if (place.unit === 'line') {
    return (findSection(doc, place.sectionId)?.items ?? []).map((line) => line.text).join('\n');
  }
  const entry = findEntry(doc, place.sectionId, place.entryId);
  if (!entry) return '';
  return [formatEntryHeading(entry), entry.dates, ...entry.bullets.map((b) => b.text)].join('\n');
}

/** A new entry's facts, which its bullets may repeat: the user confirms each one. */
const readEntryFacts = ({ frame }: EntryDraft) =>
  [formatEntryHeading(frame), frame.dates].join('\n');

/**
 * One text the checks read: what it replaces, what it writes, and what else it may repeat.
 * `textId` is set on a new entry's bullet, so its flags show on that bullet.
 */
interface CheckedText {
  before: string;
  after: string;
  context: string;
  textId?: string;
}

/**
 * A text for each bullet of a new entry, read against the entry's facts. Each is checked on
 * its own, so a flag belongs to one bullet. The ids are absent before staging gives them.
 */
const readEntryBullets = (entry: EntryDraft, ids: NewEntryIds | undefined): CheckedText[] =>
  entry.bullets.map((bullet, index) => ({
    before: '',
    after: bullet,
    context: readEntryFacts(entry),
    textId: ids?.bulletIds[index],
  }));

/** Return the ids of each entry in a new section, in order, when staging has given them. */
function readSectionEntryIds(newContentIds: NewContentIds | null): NewEntryIds[] {
  return newContentIds?.kind === 'section' && newContentIds.contents?.layout === 'entries'
    ? newContentIds.contents.entries
    : [];
}

/** The texts a change writes, each with what it replaces; empty when it writes none. */
function readCheckedTexts(
  doc: ResumeData,
  change: ProposalChange,
  newContentIds: NewContentIds | null
): CheckedText[] {
  switch (change.kind) {
    case 'rewrite':
      return [{ before: change.before, after: change.after, context: '' }];
    case 'merge':
      // A line each, so the second bullet's first word isn't read as a name mid-sentence.
      return [{ before: change.before.join('\n'), after: change.after, context: '' }];
    case 'split':
      // A split writes new words only when one of its two bullets was reworded.
      return change.halves
        ? [{ before: change.before, after: change.halves.join('\n'), context: '' }]
        : [];
    case 'add':
      return [{ before: '', after: change.text, context: readAddedContext(doc, change.place) }];
    case 'entry': {
      const ids = newContentIds?.kind === 'entry' ? newContentIds.entry : undefined;
      return readEntryBullets(change, ids);
    }
    case 'section': {
      const { contents } = change;
      if (contents === null) return [];
      if (contents.layout === 'lines') {
        return [{ before: '', after: contents.lines.join('\n'), context: '' }];
      }
      const entryIds = readSectionEntryIds(newContentIds);
      return contents.entries.flatMap((entry, index) => readEntryBullets(entry, entryIds[index]));
    }
    default:
      // A heading is the user's words, not a claim; the rest write no new words.
      return [];
  }
}

/**
 * What the local checks notice about a change, in the order the card lists them. Pass the
 * ids staging gave the change so the flags on a new entry's bullets name their bullet.
 * They must match the change: for a reviewed change, the ids from `resolveNewContentIds`.
 */
export function checkProposal(
  doc: ResumeData,
  change: ProposalChange,
  requestText: string,
  newContentIds: NewContentIds | null = null
): ProposalFlag[] {
  return readCheckedTexts(doc, change, newContentIds).flatMap((text) => {
    const known = [requestText, text.context].filter(Boolean).join('\n');
    const flags = TEXT_CHECKS.flatMap((check) => check(text.before, text.after, known));
    return text.textId ? flags.map((flag) => ({ ...flag, textId: text.textId })) : flags;
  });
}
