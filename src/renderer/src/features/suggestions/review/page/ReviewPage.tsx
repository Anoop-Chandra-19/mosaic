import { useEffect, useMemo, useRef } from 'react';
import type { MarkGutter } from '@/features/document-diff/pageMarks';
import { BULLET_GUTTER, LINE_GUTTER } from '@/features/document-diff/pageMarks';
import type { PageDecorations } from '@/features/preview/pageDecorations';
import { cn } from '@/lib/utils';
import { ReviewPaper } from './ReviewPaper';
import { SuggestionDates, SuggestionLine } from './SuggestionMark';
import type { SuggestionPage } from './suggestionPage';
import { readSuggestionState } from '../../suggestionState';

/** A whole entry or section one suggestion is about: one outline when it is selected. */
const BLOCK =
  'rounded-[2px] has-[[aria-current=true]]:outline-[1.5px] has-[[aria-current=true]]:outline-offset-[3px] has-[[aria-current=true]]:outline-paper-changed';
/** Leaving, it has one bar down its side, in the bar's lane: dashed until it is kept. */
const LEAVING_BLOCK =
  'relative before:pointer-events-none before:absolute before:top-0.75 before:bottom-0.75 before:-left-6 before:w-[2.5px] before:rounded-[2px]';
const LEAVING_WAITING =
  'before:bg-[repeating-linear-gradient(to_bottom,var(--paper-del)_0_3px,transparent_3px_5.5px)]';
const LEAVING_KEPT = 'before:bg-paper-del';

/** The page's marks, built once per page so selecting one never lays the page out again. */
function decorateSuggestions(page: SuggestionPage): PageDecorations {
  const markLine = (gutter: MarkGutter) => (id: string, text: string) => (
    <SuggestionLine
      mark={page.marks.get(id)}
      move={page.moves.get(id)}
      text={text}
      gutter={gutter}
    />
  );
  return {
    bullet: markLine(BULLET_GUTTER),
    line: markLine(LINE_GUTTER),
    entryHeading: markLine(LINE_GUTTER),
    sectionLabel: markLine(LINE_GUTTER),
    entryDates: (id, dates) => {
      const mark = page.marks.get(id);
      return mark ? <SuggestionDates mark={mark} dates={dates} /> : dates;
    },
    blockClassName: (id) => {
      const block = page.blocks.get(id);
      if (!block) return undefined;
      if (!block.isLeaving) return BLOCK;
      const isWaiting = readSuggestionState(block.proposal) === 'waiting';
      return cn(BLOCK, LEAVING_BLOCK, isWaiting ? LEAVING_WAITING : LEAVING_KEPT);
    },
  };
}

interface ReviewPageProps {
  page: SuggestionPage;
  selectedId: string | null;
  /** A click on the paper away from any mark. */
  onBlank: () => void;
}

/** The page as Apply would leave it, every waiting suggestion marked where it lands. */
export function ReviewPage({ page, selectedId, onBlank }: ReviewPageProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const decorations = useMemo(() => decorateSuggestions(page), [page]);

  // A suggestion picked in the list, or stepped to, comes into view on the page.
  useEffect(() => {
    if (!selectedId) return;
    scrollRef.current
      ?.querySelector(`[data-suggestion-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  return (
    <ReviewPaper doc={page.doc} scrollRef={scrollRef} decorations={decorations} onBlank={onBlank} />
  );
}
