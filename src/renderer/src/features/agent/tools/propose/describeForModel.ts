import type {
  Proposal,
  ProposalChange,
  ProposalFlag,
  ProposalFlagKind,
} from '@shared/types/agentProposal';
import { readShowPlaceId, readTextPlaceId } from '@/features/suggestions/proposals/proposalAnchor';
import type { AgentToolRun } from '../agentToolRun';

/*
 * What the model hears about a suggestion: what it is for, what the checks noticed, and
 * what it would make where our code wrote that, so the model can fix its own work without
 * reading again.
 */

const knownHandle = (run: AgentToolRun, id: string) => run.handles.handleById.get(id) ?? id;

/** The bullet, line, entry or section a change is about, by the handle the model knows it by. */
export function describeTarget(run: AgentToolRun, change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
      return knownHandle(run, readTextPlaceId(change.place));
    case 'select':
      return knownHandle(run, readShowPlaceId(change.place));
    case 'split':
      return knownHandle(run, change.bulletId);
    case 'merge':
      return `${knownHandle(run, change.firstId)} and ${knownHandle(run, change.secondId)}`;
    case 'reorder': {
      const { place } = change;
      if (place.unit === 'sections') return 'the sections';
      return knownHandle(run, place.unit === 'bullets' ? place.entryId : place.sectionId);
    }
    case 'add': {
      const { place } = change;
      const into = place.unit === 'bullet' ? place.entryId : place.sectionId;
      return `a new ${place.unit} in ${knownHandle(run, into)}`;
    }
    case 'entry':
      return `a new entry in ${knownHandle(run, change.sectionId)}`;
    case 'section':
      return `a new section, ${change.section.label}`;
    case 'rename':
      return `the heading of ${knownHandle(run, change.sectionId)}`;
  }
}

/**
 * What the resume would say, only where our code wrote it: a replace's text, a split's
 * halves. The rest the model sent itself, and hearing it again costs its context.
 */
export function describeResultWeWrote({ change, source }: Proposal): string | null {
  if (change.kind === 'split') {
    const first = change.before.slice(0, change.at).trim();
    const second = change.before.slice(change.at).trim();
    return `It would become two bullets: "${first}" and "${second}"`;
  }
  if (change.kind === 'rewrite' && source === 'replace') return `It would read: "${change.after}"`;
  return null;
}

const quoteWords = (flag: ProposalFlag) => flag.words.map((word) => `"${word}"`).join(', ');

/** Each check's finding in words the model can act on. */
const FLAG_NOTES: Record<ProposalFlagKind, (flag: ProposalFlag) => string> = {
  doubledWords: (flag) =>
    `${quoteWords(flag)} repeats where your change meets the old words. Write the bullet as one correct sentence.`,
  claimsMore: (flag) =>
    `${quoteWords(flag)} makes the role sound bigger than the original. Keep the user's role unless they asked.`,
  newNumbers: (flag) =>
    `${quoteWords(flag)} is a number the user never gave. Use {{?}} for a number only they know.`,
  calculatedNumbers: (flag) =>
    `${quoteWords(flag)} is worked out from other numbers. The user will be asked to check it.`,
  removedDetail: (flag) => `It drops ${quoteWords(flag)}, which the original had.`,
  newNames: (flag) => `It names ${quoteWords(flag)}, which the original didn't.`,
  unfilledGap: () => 'The user fills {{?}} before it applies.',
};

export const describeFlag = (flag: ProposalFlag) => FLAG_NOTES[flag.kind](flag);
