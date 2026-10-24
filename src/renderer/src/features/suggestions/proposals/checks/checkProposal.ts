import { formatEntryHeading } from '@shared/resume/entryHeading';
import type {
  AddPlace,
  EntryDraft,
  ProposalChange,
  ProposalFlag,
} from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { checkClaimsMore } from './claimsMore';
import { checkDoubledWords } from './doubledWords';
import { checkNewNames } from './newNames';
import { checkNewNumbers } from './newNumbers';
import { checkRemovedDetail } from './removedDetail';
import { checkUnfilledGap } from './unfilledGap';
import { findEntry, findSection } from '../proposalAnchor';

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

/** The text a change replaces, what it writes, and what else it may repeat; null when it writes none. */
function readCheckedText(
  doc: ResumeData,
  change: ProposalChange
): { before: string; after: string; context: string } | null {
  switch (change.kind) {
    case 'rewrite':
      return { before: change.before, after: change.after, context: '' };
    case 'merge':
      return { before: change.before.join(' '), after: change.after, context: '' };
    case 'add':
      return { before: '', after: change.text, context: readAddedContext(doc, change.place) };
    case 'entry':
      return { before: '', after: change.bullets.join('\n'), context: readEntryFacts(change) };
    case 'section': {
      const { contents } = change;
      if (contents.layout === 'lines') {
        return { before: '', after: contents.lines.join('\n'), context: '' };
      }
      const { entry } = contents;
      return { before: '', after: entry.bullets.join('\n'), context: readEntryFacts(entry) };
    }
    default:
      // A heading is the user's words, not a claim; the rest write no new words.
      return null;
  }
}

/** What the local checks notice about a change, in the order the card lists them. */
export function checkProposal(
  doc: ResumeData,
  change: ProposalChange,
  requestText: string
): ProposalFlag[] {
  const text = readCheckedText(doc, change);
  if (!text) return [];
  const known = [requestText, text.context].filter(Boolean).join('\n');
  return TEXT_CHECKS.flatMap((check) => check(text.before, text.after, known));
}
