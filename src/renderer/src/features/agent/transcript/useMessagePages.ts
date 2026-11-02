import { useEffect, type RefObject } from 'react';
import {
  readNewerMessages,
  readOlderMessages,
  useConversationStore,
} from '@/stores/conversationStore';

/** Starts loading a page within this many viewport heights of either loaded boundary. */
const READ_AHEAD_VIEWS = 2;

const isNearTheTop = ({ scrollTop, clientHeight }: HTMLElement) =>
  scrollTop < clientHeight * READ_AHEAD_VIEWS;

const isNearTheEnd = ({ scrollHeight, scrollTop, clientHeight }: HTMLElement) =>
  scrollHeight - scrollTop - clientHeight < clientHeight * READ_AHEAD_VIEWS;

const hasNothingToScroll = ({ scrollHeight, clientHeight }: HTMLElement) =>
  scrollHeight <= clientHeight;

/**
 * Loads messages before the user reaches either end of the loaded window. Browser scroll
 * anchoring preserves the visible position as messages are added or removed above it, except
 * at scrollTop zero. Moves one pixel down there before loading older messages. `shownBy`
 * triggers a short-page recheck when a filter or other input changes the visible content.
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

  // Load older messages when the content is too short to trigger a scroll event.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && hasOlder && hasNothingToScroll(scroller)) void readOlderMessages();
  }, [scrollRef, hasOlder, firstSeq, shownBy]);
}
