import type {
  Proposal,
  ProposalChange,
  ProposalFlag,
  ProposalFlagKind,
} from '@/types/agentProposal';
import { hasSameWords } from '@/lib/resume/hasSameWords';
import { isPlaceShown, readShowPlaceId, readTextPlaceId } from '@/lib/resume/proposalAnchor';
import type { ResumeData } from '@shared/types/resume';
import type { AgentToolRun } from '../tool-run/agentToolRun';
import { handleFor } from '../tool-run/resumeHandles';

/*
 * Describe suggestion targets, check findings, generated results, and no-op changes
 * to the model so it can revise its work without reading the resume again.
 */

const knownHandle = (run: AgentToolRun, id: string) => run.handles.handleById.get(id) ?? id;

/** Describe the change's target using handles known to the model. */
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
 * Explain a no-op change ("It already reads that."), or return null otherwise.
 * Text comparisons use `hasSameWords`, which ignores whitespace differences.
 */
export function describeNoChange(doc: ResumeData, change: ProposalChange): string | null {
  switch (change.kind) {
    case 'rewrite':
    case 'rename':
      return hasSameWords(change.before, change.after) ? 'It already reads that.' : null;
    case 'reorder': {
      const isSameOrder = change.after.every((id, index) => id === change.before[index]);
      return isSameOrder ? 'Already in that order.' : null;
    }
    case 'select': {
      const isAlready = isPlaceShown(doc, change.place) === change.selected;
      return isAlready ? `Already ${change.selected ? 'on' : 'off'} the page.` : null;
    }
    default:
      return null;
  }
}

/**
 * Describe the parts of a result that the model can't know from its own call:
 * - text that our code wrote: a replacement's result and the two halves of a split;
 * - the handles of new bullets and entries, so the model can edit them;
 * - which bullet a merge removed.
 * Text the model supplied is left out, so it isn't repeated in the model's context.
 */
export function describeResultWeWrote(
  run: AgentToolRun,
  { change, source, newContentIds }: Proposal
): string | null {
  const newBullet = (id: string) => handleFor(run.handles, 'bullet', id);
  if (change.kind === 'split' && newContentIds?.kind === 'split') {
    const first = change.before.slice(0, change.at).trim();
    const second = change.before.slice(change.at).trim();
    const handles = [knownHandle(run, change.bulletId), newBullet(newContentIds.secondBulletId)];
    return `It is two bullets now: "${first}" (${handles[0]}) and "${second}" (${handles[1]}).`;
  }
  if (change.kind === 'merge') {
    const [first, second] = [change.firstId, change.secondId].map((id) => knownHandle(run, id));
    return `${first} holds the merged text now, and ${second} is gone.`;
  }
  if (change.kind === 'entry' && newContentIds?.kind === 'entry') {
    const { entryId, bulletIds } = newContentIds.entry;
    const bullets = change.bullets.map((_, index) => newBullet(bulletIds[index]));
    const entry = `It is ${handleFor(run.handles, 'entry', entryId)}`;
    return bullets.length ? `${entry}, with bullets ${bullets.join(', ')}.` : `${entry}.`;
  }
  if (change.kind === 'rewrite' && source === 'replace') return `It reads: "${change.after}".`;
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
