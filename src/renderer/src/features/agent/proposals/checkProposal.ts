import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { AddPlace, ProposalChange, ProposalFlag } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { checkClaimsMore } from './checks/claimsMore';
import { checkDoubledWords } from './checks/doubledWords';
import { checkNewNames } from './checks/newNames';
import { checkNewNumbers } from './checks/newNumbers';
import { checkRemovedDetail } from './checks/removedDetail';
import { checkUnfilledGap } from './checks/unfilledGap';
import { findEntry, findSection } from './proposalAnchor';

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
      return { before: '', after: change.bullets.join('\n'), context: '' };
    case 'section': {
      const { contents } = change;
      const after =
        contents.layout === 'lines' ? contents.lines.join('\n') : contents.entry.bullets.join('\n');
      return { before: '', after, context: '' };
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
