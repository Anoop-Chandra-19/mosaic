import { useRef, useState } from 'react';
import { Square } from 'lucide-react';
import { AppButton, AppTextarea, Text } from '@/components/ui-kit';
import { dismissNotice, type NoticeSource } from '@/stores/agentNoticeStore';
import {
  openConversation,
  startNewConversation,
  useConversationStore,
} from '@/stores/conversationStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { explainFailure, showToast } from '@/stores/toastStore';
import { AgentNoticeSlot, type NoticeHandledAction } from '../notices/AgentNotice';
import { useAgentNotice } from '../notices/useAgentNotice';
import { stopAgentRun, useRunningRun } from '../useRunningRun';
import { canSendMessage, sendAgain, sendMessage } from './sendMessage';

/**
 * Where the user writes to the assistant. Enter sends and Shift+Enter starts a new line;
 * while a run is going, Send becomes Stop (Esc stops too, anywhere in the pane). Above it,
 * the one notice for anything that needs the user (`notices/`): a message main won't start,
 * which keeps its place in the box, or a run that stopped.
 */
export function AgentPromptBox() {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const running = useRunningRun();
  const conversationId = useConversationStore((s) => s.conversationId);
  const choice = useAgentNotice();
  const openSettings = useOverlayStore((s) => s.openSettings);
  const shown = choice.notice;
  const canSend = !isSending && canSendMessage(draft, running !== null);

  const attemptSend = async (send: () => Promise<boolean>, clearsBox: boolean) => {
    setIsSending(true);
    try {
      if ((await send()) && clearsBox) setDraft('');
    } catch (error) {
      showToast(explainFailure(error, 'Couldn’t send your message'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  /** A send while a "Can’t run" notice shows answers it; a "Run stopped" one just goes. */
  const send = () => {
    if (!canSend) return;
    const answering = shown?.words.level === 'cantRun' ? shown.source : null;
    void attemptSend(() => sendMessage(draft, answering), true);
  };

  /** A refusal's message is still in the box, so it goes again; a stop's run carries on. */
  const sendNoticeAgain = (source: NoticeSource) => {
    if (source.type === 'refusal') {
      if (canSend) void attemptSend(() => sendMessage(draft, source), true);
    } else if (!isSending && !running && conversationId !== null) {
      void attemptSend(() => sendAgain(conversationId, source), false);
    }
  };

  const runAction = (source: NoticeSource, action: NoticeHandledAction) => {
    const handlers: Record<NoticeHandledAction['kind'], () => void> = {
      again: () => sendNoticeAgain(source),
      settings: () => openSettings('ai'),
      ask: () => {
        dismissNotice(source);
        boxRef.current?.focus();
      },
      newConversation: startNewConversation,
      openRunning: () => {
        dismissNotice(source);
        if (running) void openConversation(running.conversationId);
      },
    };
    handlers[action.kind]();
  };

  return (
    <>
      <AgentNoticeSlot
        choice={choice}
        onAction={(action) => shown && runAction(shown.source, action)}
        onDismiss={() => shown && dismissNotice(shown.source)}
      />
      <div className="shrink-0 border-t border-line bg-pane px-2.75 pt-1.75 pb-2 [[data-notice-slot]+&]:border-t-0">
        <div className="rounded-[0.5625rem] border border-line-strong bg-pane-sunken transition-colors duration-150 focus-within:border-line-heavy">
          <AppTextarea
            ref={boxRef}
            variant="bare"
            aria-label="Message"
            placeholder="Ask for a change, or paste a posting…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
            className="block max-h-[40vh] min-h-9.5 px-2.5 pt-2 pb-0.5"
          />
          <div className="flex items-center justify-end gap-1.75 pt-1.25 pr-1.75 pb-1.5 pl-2.25">
            <Text variant="meta">{running ? 'Esc' : 'Enter'}</Text>
            {running ? (
              <AppButton size="xs" variant="outline" onClick={() => stopAgentRun(running.runId)}>
                <Square className="size-2.5 fill-current" />
                Stop
              </AppButton>
            ) : (
              <AppButton size="xs" variant="solid" disabled={!canSend} onClick={send}>
                Send
              </AppButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
