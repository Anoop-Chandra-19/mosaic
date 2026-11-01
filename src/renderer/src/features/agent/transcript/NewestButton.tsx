import { useEffect, useState, type RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import { AppButton } from '@/components/ui-kit';
import { fade } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { returnToNewest, useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';

type ConversationState = ReturnType<typeof useConversationStore.getState>;

/** What has happened at the newest since the user left it. */
type NewestSign = 'quiet' | 'running' | 'written';

const SIGN_WORDS: Record<NewestSign, string | null> = {
  quiet: null,
  running: 'Working',
  written: 'New',
};

const readNewestSeq = ({ hasNewer, lastRun, messages }: ConversationState) =>
  (hasNewer ? lastRun : messages).at(-1)?.seq ?? 0;

/** A view's height from the end, or the end isn't what is held at all. */
function isFarFromNewest(scroller: HTMLElement): boolean {
  const { scrollHeight, scrollTop, clientHeight } = scroller;
  return (
    useConversationStore.getState().hasNewer ||
    scrollHeight - scrollTop - clientHeight > clientHeight
  );
}

/** Null at the newest; away from it, what the newest has been doing since the user left. */
function useNewestSign(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): NewestSign | null {
  const [left, setLeft] = useState<{ seq: number } | null>(null);
  const newestSeq = useConversationStore(readNewestSeq);
  const conversationId = useConversationStore((s) => s.conversationId);
  const isRunning = useRunStore(
    (s) => s.live !== null && !s.live.hasEnded && s.live.conversationId === conversationId
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const check = () =>
      setLeft((before) =>
        isFarFromNewest(scroller)
          ? (before ?? { seq: readNewestSeq(useConversationStore.getState()) })
          : null
      );
    const resizes = new ResizeObserver(check);
    scroller.addEventListener('scroll', check);
    resizes.observe(scroller);
    resizes.observe(content);
    return () => {
      scroller.removeEventListener('scroll', check);
      resizes.disconnect();
    };
  }, [scrollRef, contentRef]);

  if (left === null) return null;
  if (isRunning) return 'running';
  return newestSeq > left.seq ? 'written' : 'quiet';
}

interface NewestButtonProps {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
}

/**
 * The way back once the user has scrolled a good way up. It jumps rather than scrolls, as
 * scrolling there would draw everything on the way. Its words say when there is a reason to go.
 */
export function NewestButton({ scrollRef, contentRef }: NewestButtonProps) {
  const sign = useNewestSign(scrollRef, contentRef);
  const { shown, isLeaving, ref } = usePresenceMotion(sign, sign && 'newest', fade);
  if (!shown) return null;
  const words = SIGN_WORDS[shown];
  const goToNewest = () => {
    const { conversationId } = useConversationStore.getState();
    if (conversationId !== null) void returnToNewest(conversationId);
  };
  return (
    <div
      ref={ref}
      inert={isLeaving}
      className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center"
    >
      <AppButton
        variant="floating"
        size="xs"
        shape={words ? 'pill' : 'square'}
        aria-label={words ? `Go to the newest. ${words}` : 'Go to the newest'}
        onClick={goToNewest}
        className="pointer-events-auto rounded-full"
      >
        <ArrowDown />
        {words}
      </AppButton>
    </div>
  );
}
