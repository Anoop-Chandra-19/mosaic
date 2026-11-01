import { useEffect, useRef, useState } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { foldAway } from '@/lib/motion/presenceMotions';
import { washLanded } from '@/lib/motion/rowMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { agentService } from '@/lib/services/agentService';
import { useAgentNoticeStore } from '@/stores/agentNoticeStore';
import { useConversationStore } from '@/stores/conversationStore';
import { TracingDots } from '../reply/TracingDots';
import { titleConversation } from './conversationListWords';

const MOST_TITLE_CHARS = 60;

/** The conversation's title to show, once read; one that can't be read shows as untitled. */
function useTitleOf(conversationId: number | null): string | null {
  const [read, setRead] = useState<{ conversationId: number; title: string } | null>(null);
  useEffect(() => {
    if (conversationId === null) return;
    let isCurrent = true;
    const answer = (title: string | null) => {
      if (isCurrent) setRead({ conversationId, title: titleConversation(title, MOST_TITLE_CHARS) });
    };
    agentService.readConversationTitle(conversationId).then(answer, (error: unknown) => {
      console.error('Couldn’t read the running conversation’s title', error);
      answer(null);
    });
    return () => {
      isCurrent = false;
    };
  }, [conversationId]);
  return read && read.conversationId === conversationId ? read.title : null;
}

interface RunningElsewhereProps {
  /** The run going, in whichever conversation. */
  running: { runId: number; conversationId: number } | null;
  onGoTo: (conversationId: number) => void;
}

/**
 * A run going in another conversation, under the pane's header: where it is and the way there.
 * A send from here is main's to turn down, and this says so, with the words kept in the box.
 */
export function RunningElsewhere({ running, onGoTo }: RunningElsewhereProps) {
  const openId = useConversationStore((s) => s.conversationId);
  const isStartingRun = useAgentNoticeStore((s) => s.isStartingRun);
  const blocked = useAgentNoticeStore((s) => s.blockedSend);
  const elsewhere = running && running.conversationId !== openId && !isStartingRun ? running : null;
  const title = useTitleOf(elsewhere?.conversationId ?? null);
  const { shown, isLeaving, ref } = usePresenceMotion(title, elsewhere?.runId ?? null, foldAway);
  const stripRef = useRef<HTMLDivElement>(null);
  const isBlockedHere =
    blocked !== null && blocked.runId === elsewhere?.runId && blocked.conversationId === openId;
  const blockedAt = isBlockedHere ? blocked.at : null;

  useEffect(() => {
    if (blockedAt !== null && stripRef.current) washLanded(stripRef.current);
  }, [blockedAt]);

  if (shown === null) return null;

  return (
    <div ref={ref} inert={isLeaving} className="shrink-0 overflow-hidden bg-pane-sunken">
      <div
        ref={stripRef}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-1.25 pr-2 pl-3"
      >
        <TracingDots tone="muted" />
        <Text variant="secondary" className="min-w-0 flex-1 truncate text-ink-muted">
          Running in <span className="font-control text-ink-soft">{shown}</span>
        </Text>
        <AppButton
          variant="ghost"
          size="xs"
          className="h-6 px-2"
          onClick={() => elsewhere && onGoTo(elsewhere.conversationId)}
        >
          Go to it
        </AppButton>
        {blockedAt !== null && (
          <Text
            key={blockedAt}
            as="p"
            role="alert"
            variant="secondary"
            className="basis-full pb-0.75 pl-4 text-pretty text-ink-soft"
          >
            One run at a time. Your message is still in the box; send it when that run ends, or stop
            it there first.
          </Text>
        )}
      </div>
    </div>
  );
}
