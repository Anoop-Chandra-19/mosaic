import type { ProposalChange, ProposalFlag, ProposalFlagKind } from '@shared/types/agentProposal';
import { formatEntryHeading } from '@shared/resume/entryHeading';
import { readTextPlaceId } from '@/features/agent/proposals/proposalAnchor';
import type { AgentToolRun } from '../agentToolRun';

/*
 * What the model hears about a suggestion: which bullet it is, what it would make, and what
 * the checks noticed, so it can see its own result and fix it without reading again.
 */

const knownHandle = (run: AgentToolRun, id: string) => run.handles.handleById.get(id) ?? id;

/** The bullet, entry or section a change is about, by the handle the model knows it by. */
export function describeTarget(run: AgentToolRun, change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
    case 'select':
      return knownHandle(run, readTextPlaceId(change.place));
    case 'split':
      return knownHandle(run, change.bulletId);
    case 'merge':
      return `${knownHandle(run, change.firstId)} and ${knownHandle(run, change.secondId)}`;
    case 'reorder': {
      const { place } = change;
      return knownHandle(run, place.unit === 'bullets' ? place.entryId : place.sectionId);
    }
    case 'add': {
      const { place } = change;
      const into = place.unit === 'bullet' ? place.entryId : place.sectionId;
      return `a new ${place.unit} in ${knownHandle(run, into)}`;
    }
    case 'entry':
      return `a new entry in ${knownHandle(run, change.sectionId)}`;
  }
}

/** What the resume would say once the change applies. */
export function describeResult(run: AgentToolRun, change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
      return `It would read: "${change.after}"`;
    case 'merge':
      return `The two would read as one: "${change.after}"`;
    case 'split': {
      const first = change.before.slice(0, change.at).trim();
      const second = change.before.slice(change.at).trim();
      return `It would become two bullets: "${first}" and "${second}"`;
    }
    case 'select':
      return change.selected ? 'It would be back on the page.' : 'It would be left off the page.';
    case 'reorder':
      return `The new order: ${change.after.map((id) => knownHandle(run, id)).join(', ')}`;
    case 'add':
      return `It would read: "${change.text}"`;
    case 'entry': {
      const heading = formatEntryHeading(change.frame) || 'an untitled entry';
      return `It would add ${heading}, with ${change.bullets.length} bullets.`;
    }
  }
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
