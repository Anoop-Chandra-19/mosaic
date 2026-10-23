import { use, type ReactNode } from 'react';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';
import { labelSuggestionKind } from '../../proposals/describeSuggestion';
import { cn } from '@/lib/utils';
import type { SuggestionMark as Mark, SuggestionMove } from './suggestionPage';
import { SuggestionSelection } from '../suggestionSelection';
import { needsNumber, readSuggestionState, type SuggestionState } from '../suggestionState';

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
        className="inline-block min-w-3.25 rounded-[0.125rem] border border-dashed border-paper-flag px-0.5 text-center leading-2.75 font-bold text-paper-flag"
      >
        ?
      </span>
    ),
    part,
  ]);
}

/** Where a mark's flag dot sits: past a bullet's marker, or just before a line or heading. */
export type FlagGutter = 'bullet' | 'line';

const FLAG_GUTTER_CLASSES: Record<FlagGutter, string> = {
  bullet: '-left-7.75',
  line: '-left-3',
};

/** A suggestion's mark on the page: click it to read it in the inspector. */
export function SuggestionMark({
  mark,
  gutter = 'bullet',
  children,
}: {
  mark: Mark;
  gutter?: FlagGutter;
  children: ReactNode;
}) {
  const { selectedId, select } = use(SuggestionSelection);
  const { proposal, look } = mark;
  const state = readSuggestionState(proposal);
  const isLive = state !== 'dropped' && state !== 'stale';
  const flagCount = isLive ? proposal.flags.length : 0;
  const isCurrent = selectedId === proposal.id;
  const isLeavingBlock = mark.block === 'leaving' && isLive;
  const title =
    state === 'stale'
      ? 'Out of date: you changed this after it was suggested'
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
        // The scroll margin keeps a selected mark clear of the floating apply bar.
        'relative cursor-pointer scroll-mb-20 rounded-[0.125rem] border-b-[1.5px] px-px text-inherit transition-colors duration-100 group-data-landing/review:animate-mark-in motion-reduce:animate-none',
        LOOK_CLASSES[look],
        STATE_CLASSES[state],
        isCurrent && CURRENT_CLASSES[look],
        look === 'hide' &&
          isLive &&
          !isLeavingBlock &&
          'line-through decoration-paper-del opacity-50',
        // The heading of a whole entry or section leaving: struck, on the block's faded ink.
        isLeavingBlock && 'static bg-transparent text-paper-tag line-through decoration-paper-del'
      )}
    >
      {flagCount > 0 && (
        <span
          aria-hidden
          className={cn(
            'absolute top-1 size-1.5 group-data-landing/review:animate-flag-in motion-reduce:animate-none',
            FLAG_GUTTER_CLASSES[gutter],
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

/** A small chip on the page beside what a suggestion moves or brings back. */
function PageChip({ proposalId, children }: { proposalId: string; children: ReactNode }) {
  const { select } = use(SuggestionSelection);
  return (
    <span
      onClick={(event) => {
        event.stopPropagation();
        select(proposalId);
      }}
      className="ml-1.25 inline-flex cursor-pointer items-center gap-0.75 rounded-[0.1875rem] border border-paper-add bg-paper-add-soft px-1 align-[1.5px] font-sans text-[0.5rem] font-bold tracking-[0.03em] whitespace-nowrap text-paper-add not-italic uppercase"
    >
      {children}
    </span>
  );
}

/** The chip a reorder leaves beside a bullet, entry or section it moves. */
export function SuggestionMoveChip({ move }: { move: SuggestionMove }) {
  return (
    <PageChip proposalId={move.proposal.id}>
      moved {move.from}→{move.to}
    </PageChip>
  );
}

/** Beside the heading of an entry or section a suggestion puts back on the page. */
export function SuggestionBackChip({ mark }: { mark: Mark }) {
  return <PageChip proposalId={mark.proposal.id}>back on the page</PageChip>;
}
