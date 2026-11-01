import { useEffect, useRef, type RefObject } from 'react';
import { scrollQuietly } from '@/lib/scrollbarReveal';
import { useConversationStore } from '@/stores/conversationStore';

/** Closer than this to the end counts as reading the newest. */
const PINNED_WITHIN_PX = 72;

/**
 * Keeps the end of the transcript in view as it grows, unless the user has scrolled up to
 * read: then it stays where they are. Growth is watched by size, so streamed text and new
 * turns are followed alike. The end of what is held isn't the newest while the window is back
 * from the end of the log, so it isn't followed then. A send comes back to the newest.
 * `isHeld` stops the following while something in view is being read, however near the end.
 */
export function useStickToNewest(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  isHeld = false
): void {
  const returnsToNewest = useConversationStore((s) => s.returnsToNewest);
  const isPinned = useRef(true);
  const isHeldNow = useRef(isHeld);

  useEffect(() => {
    isHeldNow.current = isHeld;
  }, [isHeld]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const onScroll = () => {
      isPinned.current =
        !useConversationStore.getState().hasNewer &&
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < PINNED_WITHIN_PX;
    };
    const resizes = new ResizeObserver(() => {
      // Following isn't the user scrolling, so it doesn't show the scrollbar.
      if (isPinned.current && !isHeldNow.current) scrollQuietly(scroller, scroller.scrollHeight);
    });
    scroller.addEventListener('scroll', onScroll);
    resizes.observe(content);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      resizes.disconnect();
    };
  }, [scrollRef, contentRef]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (returnsToNewest === 0 || !scroller) return;
    isPinned.current = true;
    scrollQuietly(scroller, scroller.scrollHeight);
  }, [scrollRef, returnsToNewest]);
}
