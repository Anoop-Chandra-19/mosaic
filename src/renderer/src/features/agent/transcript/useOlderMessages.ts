import { useEffect, type RefObject } from 'react';
import { readOlderMessages, useConversationStore } from '@/stores/conversationStore';

/** How many window heights above the view the next page starts being read. */
const READ_AHEAD_VIEWS = 2;

const isNearTheTop = ({ scrollTop, clientHeight }: HTMLElement) =>
  scrollTop < clientHeight * READ_AHEAD_VIEWS;

const hasNothingToScroll = ({ scrollHeight, clientHeight }: HTMLElement) =>
  scrollHeight <= clientHeight;

/**
 * Reads older messages before the user reaches the top. The browser's scroll anchoring holds
 * the view still as they land above it, but gives up at exactly the top, so the view never
 * rests there while there is more to read.
 */
export function useOlderMessages(scrollRef: RefObject<HTMLElement | null>): void {
  const firstSeq = useConversationStore((s) => s.messages[0]?.seq);
  const hasOlder = useConversationStore((s) => s.hasOlder);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      if (!useConversationStore.getState().hasOlder || !isNearTheTop(scroller)) return;
      if (scroller.scrollTop === 0) scroller.scrollTop = 1;
      void readOlderMessages();
    };
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  // A page too short to scroll fires no scroll to ask for the next.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && hasOlder && hasNothingToScroll(scroller)) void readOlderMessages();
  }, [scrollRef, hasOlder, firstSeq]);
}
