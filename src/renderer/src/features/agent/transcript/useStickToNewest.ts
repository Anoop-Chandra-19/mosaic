import { useEffect, type RefObject } from 'react';

/** Closer than this to the end counts as reading the newest. */
const PINNED_WITHIN_PX = 72;

/**
 * Keeps the end of the transcript in view as it grows, unless the user has scrolled up to
 * read: then it stays where they are. Growth is watched by size, so streamed text and new
 * turns are followed alike.
 */
export function useStickToNewest(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    let isPinned = true;
    const onScroll = () => {
      isPinned =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < PINNED_WITHIN_PX;
    };
    const resizes = new ResizeObserver(() => {
      if (isPinned) scroller.scrollTop = scroller.scrollHeight;
    });
    scroller.addEventListener('scroll', onScroll);
    resizes.observe(content);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      resizes.disconnect();
    };
  }, [scrollRef, contentRef]);
}
