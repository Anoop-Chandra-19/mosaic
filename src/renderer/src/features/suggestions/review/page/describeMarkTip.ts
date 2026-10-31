import { diffTextsAsPhrases } from '@/lib/resume/changes/diffTextsAsPhrases';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';
import { labelSuggestionKind } from '../../proposals/describeSuggestion';
import { readSuggestionState, type SuggestionState } from '../../suggestionState';
import type { SuggestionMark, SuggestionMove } from './suggestionPage';

const STATE_WORDS: Record<SuggestionState, string> = {
  waiting: 'waiting',
  kept: 'kept',
  held: 'kept, held back until it has a number',
  dropped: 'dropped, so your words print',
  stale: 'out of date: you changed this after it was suggested',
};

const quote = (text: string) => `“${text.trim()}”`;

/** The first change to a line's words and how many follow, as a version's tips say it. */
function describeWords({ before, after }: NonNullable<SuggestionMark['words']>): string | null {
  const edits = diffTextsAsPhrases(before, after.replaceAll(GAP_MARK, '?')).filter(
    (phrase) => phrase.k === 'edit'
  );
  const [first, ...rest] = edits;
  if (!first) return null;
  let what = `${quote(first.del)} taken out`;
  if (first.del.trim() && first.ins.trim())
    what = `${quote(first.del)} becomes ${quote(first.ins)}`;
  else if (first.ins.trim()) what = `${quote(first.ins)} added`;
  if (rest.length === 0) return `${what}.`;
  return `${what}, and ${rest.length} more ${rest.length === 1 ? 'change' : 'changes'}.`;
}

function describeChecks(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 thing to check.' : `${count} things to check.`;
}

/** What a marked line's tip says: the suggestion, where it stands, what it changes, what to check. */
export function describeMarkTip(mark: SuggestionMark | undefined, move?: SuggestionMove): string {
  const proposal = mark?.proposal ?? move?.proposal;
  if (!proposal) return '';
  const state = readSuggestionState(proposal);
  const isInPlay = state !== 'dropped' && state !== 'stale';
  const parts = [
    `${labelSuggestionKind(proposal.change)}, ${STATE_WORDS[state]}.`,
    isInPlay && mark?.words ? describeWords(mark.words) : null,
    isInPlay && mark ? describeChecks(proposal.flags.length) : null,
    mark?.block === 'back' ? 'Back on the page, as you left it.' : null,
    !mark && move ? `Moved from ${move.from} to ${move.to}.` : null,
  ];
  return parts.filter((part) => part !== null).join(' ');
}
