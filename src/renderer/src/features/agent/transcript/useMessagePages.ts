import { useEffect, type RefObject } from 'react';
import {
  readNewerMessages,
  readOlderMessages,
  useConversationStore,
} from '@/stores/conversationStore';

/** How many window heights from the view the next page starts being read. */
const READ_AHEAD_VIEWS = 2;

const isNearTheTop = ({ scrollTop, clientHeight }: HTMLElement) =>
  scrollTop < clientHeight * READ_AHEAD_VIEWS;

const isNearTheEnd = ({ scrollHeight, scrollTop, clientHeight }: HTMLElement) =>
  scrollHeight - scrollTop - clientHeight < clientHeight * READ_AHEAD_VIEWS;

const hasNothingToScroll = ({ scrollHeight, clientHeight }: HTMLElement) =>
  scrollHeight <= clientHeight;

/**
 * Reads the next page before the user reaches either end of what is held. The browser's scroll
 * anchoring holds the view still as messages land or go above it, but gives up at exactly the
 * top, so the view never rests there while there is more to read. `shownBy` is whatever else
 * can shorten what is drawn, as a filter does.
 */
export function useMessagePages(scrollRef: RefObject<HTMLElement | null>, shownBy?: unknown): void {
  const firstSeq = useConversationStore((s) => s.messages[0]?.seq);
  const hasOlder = useConversationStore((s) => s.hasOlder);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const state = useConversationStore.getState();
      if (state.hasNewer && isNearTheEnd(scroller)) void readNewerMessages();
      if (!state.hasOlder || !isNearTheTop(scroller)) return;
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
  }, [scrollRef, hasOlder, firstSeq, shownBy]);
}
