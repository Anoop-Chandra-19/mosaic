import { use, type MouseEvent, type ReactNode } from 'react';
import { AppTooltip } from '@/components/ui-kit';
import { DIFF_MARKS } from '@/features/document-diff/diffMarks';
import {
  GutterMarks,
  MarkTarget,
  MoveGlyph,
  type BarFill,
} from '@/features/document-diff/PageMarkParts';
import { measureGutterReach, type MarkGutter } from '@/features/document-diff/pageMarks';
import type { ChangeTone } from '@/lib/resume/changes/resumeChange';
import { cn } from '@/lib/utils';
import { FlaggedText, MarkedText } from '../../card/text/SuggestionText';
import { needsNumber, readSuggestionState, type SuggestionState } from '../../suggestionState';
import { SuggestionSelection } from '../suggestionSelection';
import { describeMarkTip } from './describeMarkTip';
import type { SuggestionMark as Mark, SuggestionLook, SuggestionMove } from './suggestionPage';

const LOOK_TONES: Record<SuggestionLook, ChangeTone> = { edit: 'edit', add: 'add', hide: 'del' };

/**
 * The bar's tone says what changed and its fill what was decided. Dropped and out-of-date
 * lines print the user's words, with one quiet underline and no bar.
 */
const STATE_LINES: Record<SuggestionState, { fill: BarFill | null; lineClassName?: string }> = {
  waiting: { fill: 'dashed' },
  kept: { fill: 'solid' },
  held: { fill: 'hollow' },
  dropped: {
    fill: null,
    lineClassName:
      'underline decoration-paper-tag-line decoration-dotted decoration-1 underline-offset-3',
  },
  stale: {
    fill: null,
    lineClassName:
      'underline decoration-paper-stale-line decoration-dashed decoration-1 underline-offset-3',
  },
};

/** A number only the user knows, shown as the gap the suggestion left for it. */
const PAGE_GAP = (
  <span className="inline-block min-w-3.25 rounded-[0.125rem] border border-dashed border-paper-flag px-0.5 text-center leading-2.75 font-bold text-paper-flag">
    ?
  </span>
);

/** Marks wash in as the review lands. */
const WASHES_IN = 'group-data-landing/review:**:animate-mark-in motion-reduce:**:animate-none';
const COMES_IN =
  'contents group-data-landing/review:**:animate-flag-in motion-reduce:**:animate-none';

const FLAG = 'pointer-events-none absolute top-1 size-1.5';

/** The flag lane: a dot to look at, a square for a number to fill, a ring for out of date. */
function MarginFlag({ mark, gutter }: { mark: Mark; gutter: MarkGutter }) {
  const { proposal } = mark;
  const state = readSuggestionState(proposal);
  const style = { left: -gutter.flagPx };
  if (state === 'stale') {
    return (
      <span
        aria-hidden
        className={cn(
          FLAG,
          'rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--paper-stale-line)]'
        )}
        style={style}
      />
    );
  }
  if (state === 'dropped' || proposal.flags.length === 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        FLAG,
        needsNumber(proposal)
          ? 'rounded-[0.0625rem] bg-white shadow-[inset_0_0_0_1.5px_var(--paper-flag)]'
          : 'rounded-full bg-paper-flag shadow-[0_0_0_2px_white]'
      )}
      style={style}
    />
  );
}

/** The words of a line a suggestion marks. A line split across pages prints part of its text. */
function MarkedWords({ mark, text }: { mark: Mark; text: string }): ReactNode {
  if (mark.look === 'hide') return <span className={DIFF_MARKS.removed}>{text}</span>;
  if (mark.look === 'add') {
    return (
      <span className={DIFF_MARKS.addedLine}>
        <FlaggedText text={text} gap={PAGE_GAP} />
      </span>
    );
  }
  const { words } = mark;
  if (words?.after === text && readSuggestionState(mark.proposal) !== 'stale') {
    return <MarkedText before={words.before} after={text} gap={PAGE_GAP} />;
  }
  return <FlaggedText text={text} gap={PAGE_GAP} />;
}

const readDirection = (move: SuggestionMove) => (move.to < move.from ? 'up' : 'down');

/** The arrow of a move on a line another suggestion marks: its own target, for its own suggestion. */
function MoveTarget({ move, gutter }: { move: SuggestionMove; gutter: MarkGutter }) {
  const { selectedId, select } = use(SuggestionSelection);
  return (
    <AppTooltip content={describeMarkTip(undefined, move)} shouldFollowPointer>
      <MoveGlyph
        direction={readDirection(move)}
        gutter={gutter}
        data-suggestion-id={move.proposal.id}
        aria-current={selectedId === move.proposal.id || undefined}
        onClick={(event) => {
          event.stopPropagation();
          select(move.proposal.id);
        }}
        className={cn('pointer-events-auto z-1 cursor-pointer', DIFF_MARKS.currentLine)}
      />
    </AppTooltip>
  );
}

interface SuggestionLineProps {
  /** What a suggestion does to the line's words; a move may be all that marks it. */
  mark?: Mark;
  move?: SuggestionMove;
  text: string;
  gutter: MarkGutter;
}

/**
 * A line a suggestion marks, in the same lanes as a version's: the line is the target, for
 * the tip and to read it in the inspector. Its box must be positioned. The lines of a whole
 * entry or section have no outline of their own, and those leaving no bar: the block draws them.
 */
export function SuggestionLine({ mark, move, text, gutter }: SuggestionLineProps) {
  const { selectedId, select } = use(SuggestionSelection);
  const proposal = mark?.proposal ?? move?.proposal;
  if (!proposal) return text;
  const { fill, lineClassName } = STATE_LINES[readSuggestionState(proposal)];
  const selectLine = (event: MouseEvent) => {
    event.stopPropagation();
    select(proposal.id);
  };
  const lineMoveGlyph = move && (
    <MoveGlyph aria-hidden direction={readDirection(move)} gutter={gutter} />
  );
  return (
    <>
      <span className={COMES_IN}>
        <GutterMarks
          tone={mark ? LOOK_TONES[mark.look] : 'edit'}
          fill={mark?.block === 'leaving' ? null : fill}
          moveGlyph={mark && move ? <MoveTarget move={move} gutter={gutter} /> : lineMoveGlyph}
          gutter={gutter}
        />
        {mark && <MarginFlag mark={mark} gutter={gutter} />}
      </span>
      <MarkTarget
        tip={describeMarkTip(mark, move)}
        gutterReachPx={measureGutterReach(gutter, move !== undefined)}
        isWholeLine
        isOutlined={!mark?.block}
        data-suggestion-id={proposal.id}
        aria-current={selectedId === proposal.id || undefined}
        onClick={selectLine}
        // The scroll margin keeps a selected line clear of the floating apply bar.
        className={cn('scroll-mb-20', WASHES_IN, lineClassName)}
      >
        {mark ? <MarkedWords mark={mark} text={text} /> : text}
      </MarkTarget>
    </>
  );
}

/** An entry's dates, marked with it when it is new, put back, or leaving. */
export function SuggestionDates({ mark, dates }: { mark: Mark; dates: string }) {
  const { select } = use(SuggestionSelection);
  if (mark.look === 'edit') return dates;
  return (
    <MarkTarget
      tip={describeMarkTip(mark)}
      isOutlined={false}
      onClick={(event) => {
        event.stopPropagation();
        select(mark.proposal.id);
      }}
      className={WASHES_IN}
    >
      <MarkedWords mark={mark} text={dates} />
    </MarkTarget>
  );
}
