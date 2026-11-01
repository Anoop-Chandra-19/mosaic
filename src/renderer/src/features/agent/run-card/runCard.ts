import type { Proposal } from '@/types/agentProposal';
import { countSuggestions } from '@/features/suggestions/suggestionState';

/*
 * What a run's card says, from what became of the suggestions it staged: counts and where
 * they are, never the changes themselves, which live on the page. No elements here.
 */

export interface StopQuestion {
  count: number;
  title: string;
  body: string;
  keepLabel: string;
}

export interface SuggestionHandle {
  title: string;
  note: string;
  /** Every suggestion here is out of date, so nothing is ready to review. */
  isAllStale: boolean;
}

export interface RunCardWords {
  /** The user's Stop, with suggestions it hasn't decided about. */
  stopQuestion: StopQuestion | null;
  handle: SuggestionHandle | null;
  /** "Applied 3 of 6 suggestions", once any of them are in the draft. */
  applied: string | null;
  /** The run's suggestions were thrown away, which the user's Stop leaves a line for. */
  isDiscarded: boolean;
}

interface RunCardFacts {
  /** What is left of the run's suggestions: applied ones stay, discarded ones go. */
  staged: readonly Proposal[];
  isCancelled: boolean;
  /** The user has answered the question a Stop asks. */
  isStopDecided: boolean;
}

const countSuggestionWords = (count: number) =>
  `${count} ${count === 1 ? 'suggestion' : 'suggestions'}`;

function askAboutStop(count: number): StopQuestion {
  const isOne = count === 1;
  return {
    count,
    title: `${countSuggestionWords(count)} from before you stopped`,
    body: `${isOne ? 'It' : 'They'} passed Mosaic’s checks. Keep ${isOne ? 'it' : 'them'} staged, or discard the turn?`,
    keepLabel: `Keep ${count} staged`,
  };
}

function describeHandle(waiting: number, stale: number): SuggestionHandle {
  if (waiting === 0) {
    return {
      title: `${countSuggestionWords(stale)} out of date`,
      note: 'Your text changed after the assistant suggested this, so it can’t be applied as it is.',
      isAllStale: true,
    };
  }
  const outOfDate = stale > 0 ? ` · ${stale} out of date` : '';
  return {
    title: `${countSuggestionWords(waiting)} ready to review${outOfDate}`,
    note: 'Each bullet is its own suggestion: keep, drop, or edit it on the page. Nothing is on the page yet.',
    isAllStale: false,
  };
}

export function readRunCard({ staged, isCancelled, isStopDecided }: RunCardFacts): RunCardWords {
  const { waiting, stale } = countSuggestions(staged);
  const open = waiting + stale;
  const appliedCount = staged.filter((proposal) => proposal.status === 'applied').length;
  const isAsking = isCancelled && !isStopDecided && open > 0;
  return {
    stopQuestion: isAsking ? askAboutStop(open) : null,
    handle: !isAsking && open > 0 ? describeHandle(waiting, stale) : null,
    applied:
      appliedCount > 0 ? `Applied ${appliedCount} of ${countSuggestionWords(staged.length)}` : null,
    isDiscarded: isCancelled && isStopDecided && staged.length === 0,
  };
}

/** The suggestions with these ids, wherever they wait: a run can outlast its resume being open. */
export function findRunSuggestions(
  byTemplate: Readonly<Record<string, readonly Proposal[]>>,
  ids: readonly string[]
): Proposal[] {
  return Object.values(byTemplate).flatMap((proposals) =>
    proposals.filter((proposal) => ids.includes(proposal.id))
  );
}

export const isSuggestionOpen = ({ status }: Proposal) =>
  status !== 'applied' && status !== 'rejected';

/** The one to open the review on: the first that can still be applied, if there is one. */
export const findFirstToReview = (staged: readonly Proposal[]): Proposal | undefined => {
  const open = staged.filter(isSuggestionOpen);
  return open.find((proposal) => !proposal.isStale) ?? open[0];
};

/** The sections its suggestions are in, each once, for the open resume's own. */
export function listSections(
  staged: readonly Proposal[],
  templateId: string | null,
  placeOf: (proposal: Proposal) => string[]
): string[] {
  const sections = staged
    .filter((proposal) => isSuggestionOpen(proposal) && proposal.templateId === templateId)
    .flatMap((proposal) => placeOf(proposal).slice(0, 1));
  return [...new Set(sections)];
}

/** The newest version an apply kept that holds any of these. */
export function findAppliedVersionId(
  idsByAppliedVersion: Readonly<Record<string, readonly string[]>>,
  staged: readonly Proposal[]
): string | null {
  const versions = Object.entries(idsByAppliedVersion).filter(([, ids]) =>
    staged.some((proposal) => ids.includes(proposal.id))
  );
  return versions.at(-1)?.[0] ?? null;
}
