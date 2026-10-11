import { use, type ReactNode } from 'react';
import { GAP_MARK } from '../proposals/checks/unfilledGap';
import { labelSuggestionKind } from '../proposals/describeSuggestion';
import { cn } from '@/lib/utils';
import type { SuggestionMark as Mark, SuggestionMove } from './suggestionPage';
import { SuggestionSelection } from './suggestionSelection';
import { needsNumber, readSuggestionState, type SuggestionState } from './suggestionState';

const LOOK_CLASSES: Record<Mark['look'], string> = {
  edit: 'bg-paper-suggested-soft border-paper-suggested hover:bg-paper-suggested-hover',
  add: 'bg-paper-add-soft border-paper-add',
  hide: 'bg-paper-del-soft border-paper-del',
};

/** Kept reads as added; dropped and out of date fall back to the draft's own words. */
const STATE_CLASSES: Partial<Record<SuggestionState, string>> = {
  kept: 'bg-paper-add-soft border-paper-add hover:bg-paper-add-soft',
  held: 'bg-paper-add-soft border-paper-add hover:bg-paper-add-soft',
  dropped: 'bg-transparent border-dashed border-paper-tag-line text-paper-tag',
  stale: 'bg-transparent border-dashed border-paper-stale-line text-paper-stale-text',
};

const CURRENT_CLASSES: Record<Mark['look'], string> = {
  edit: 'bg-paper-suggested-current ring-2 ring-paper-suggested',
  add: 'bg-paper-add-current ring-2 ring-paper-add',
  hide: 'bg-paper-suggested-current ring-2 ring-paper-suggested',
};

/** A number only the user knows, shown as the gap the suggestion left for it. */
function withGaps(text: ReactNode): ReactNode {
  if (typeof text !== 'string' || !text.includes(GAP_MARK)) return text;
  return text.split(GAP_MARK).flatMap((part, index) => [
    index > 0 && (
      <span
        key={index}
        className="inline-block min-w-3.25 rounded-[0.125rem] border border-dashed border-paper-flag px-0.5 text-center leading-[0.6875rem] font-bold text-paper-flag"
      >
        ?
      </span>
    ),
    part,
  ]);
}

/** A suggestion's mark on the page: click it to read it in the inspector. */
export function SuggestionMark({ mark, children }: { mark: Mark; children: ReactNode }) {
  const { selectedId, select } = use(SuggestionSelection);
  const { proposal, look } = mark;
  const state = readSuggestionState(proposal);
  const isLive = state !== 'dropped' && state !== 'stale';
  const flagCount = isLive ? proposal.flags.length : 0;
  const isCurrent = selectedId === proposal.id;
  const title =
    state === 'stale'
      ? 'Out of date: you changed this bullet after it was suggested'
      : `${labelSuggestionKind(proposal.change)}${flagCount ? ` · ${flagCount} to check` : ''}`;
  return (
    <mark
      data-suggestion-id={proposal.id}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        select(proposal.id);
      }}
      className={cn(
        'relative cursor-pointer rounded-[0.125rem] border-b-[1.5px] px-px text-inherit transition-colors duration-100',
        LOOK_CLASSES[look],
        STATE_CLASSES[state],
        isCurrent && CURRENT_CLASSES[look],
        look === 'hide' && isLive && 'line-through decoration-paper-del opacity-50'
      )}
    >
      {flagCount > 0 && (
        <span
          aria-hidden
          className={cn(
            'absolute top-1 -left-7.75 size-1.5',
            needsNumber(proposal)
              ? 'rounded-[0.0625rem] bg-white shadow-[inset_0_0_0_1.5px_var(--paper-flag)]'
              : 'rounded-full bg-paper-flag shadow-[0_0_0_2px_white]'
          )}
        />
      )}
      {withGaps(children)}
    </mark>
  );
}

/** The chip a reorder leaves beside a bullet it moves. */
export function SuggestionMoveChip({ move }: { move: SuggestionMove }) {
  const { select } = use(SuggestionSelection);
  const { from, to } = move;
  return (
    <span
      onClick={(event) => {
        event.stopPropagation();
        select(move.proposal.id);
      }}
      className="ml-1.25 inline-flex cursor-pointer items-center gap-0.75 rounded-[0.1875rem] border border-paper-add bg-paper-add-soft px-1 align-[1.5px] font-sans text-[0.5rem] font-bold tracking-[0.03em] whitespace-nowrap text-paper-add uppercase"
    >
      moved {from}→{to}
    </span>
  );
}
