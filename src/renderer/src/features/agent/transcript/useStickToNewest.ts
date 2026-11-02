import { useEffect, useRef, type RefObject } from 'react';
import { scrollQuietly } from '@/lib/scrollbarReveal';
import { useConversationStore } from '@/stores/conversationStore';

/** Closer than this to the end counts as reading the newest. */
const PINNED_WITHIN_PX = 72;

/**
 * Follows transcript growth while the user is near the newest messages; preserves their
 * position after they scroll up. A ResizeObserver handles both streamed text and new turns.
 * Does not follow the bottom of an older message window when newer messages are not loaded.
 * Sending returns to the newest messages. `isHeld` pauses resize-driven following while an
 * open record is being read, even near the bottom.
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
      // Automatic following should not reveal the scrollbar as user scrolling does.
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
