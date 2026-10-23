import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { PageDecorations } from '@/features/preview/PreviewSection';
import { ReviewPaper } from './ReviewPaper';
import {
  SuggestionBackChip,
  SuggestionMark,
  SuggestionMoveChip,
  type FlagGutter,
} from './SuggestionMark';
import type { SuggestionPage } from './suggestionPage';

/**
 * A whole entry or section waiting to leave: its text faded, one bracket down its side in
 * the margin. Kept, it stays the same until Apply.
 */
const LEAVING_BLOCK_CLASSES =
  'relative text-paper-faded before:pointer-events-none before:absolute before:inset-y-0.75 before:-left-3.25 before:w-1.25 before:rounded-l-[0.125rem] before:border-[1.5px] before:border-r-0 before:border-paper-del';

/** The page's marks, built once per page so selecting one never lays the page out again. */
function decorateSuggestions(page: SuggestionPage): PageDecorations {
  /** Text or a heading in its mark, with the chips a move or a return leaves beside it. */
  const markWithChips = (gutter: FlagGutter) => (id: string, node: ReactNode) => {
    const mark = page.marks.get(id);
    const move = page.moves.get(id);
    if (!mark && !move) return node;
    return (
      <>
        {mark ? (
          <SuggestionMark mark={mark} gutter={gutter}>
            {node}
          </SuggestionMark>
        ) : (
          node
        )}
        {mark?.block === 'back' && <SuggestionBackChip mark={mark} />}
        {move && <SuggestionMoveChip move={move} />}
      </>
    );
  };
  const markOnly = (id: string, node: ReactNode) => {
    const mark = page.marks.get(id);
    return mark ? (
      <SuggestionMark mark={mark} gutter="line">
        {node}
      </SuggestionMark>
    ) : (
      node
    );
  };
  return {
    bullet: markWithChips('bullet'),
    line: markWithChips('line'),
    entryHeading: markWithChips('line'),
    entryDates: markOnly,
    sectionLabel: markWithChips('line'),
    blockClassName: (id) => {
      const mark = page.marks.get(id);
      const isLeaving = mark?.block === 'leaving' && !mark.proposal.isStale;
      return isLeaving && mark.proposal.status !== 'rejected' ? LEAVING_BLOCK_CLASSES : undefined;
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
