import { useState } from 'react';
import { Square } from 'lucide-react';
import { AppButton, AppTextarea, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { openConversation } from '@/stores/conversationStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { explainFailure, showToast } from '@/stores/toastStore';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import { canSendMessage, sendMessage } from './sendMessage';
import { StartRefusalNotice } from './StartRefusalNotice';
import { describeStartRefusal, type StartNoticeActionKind } from './startRefusalWords';
import { useChosenModel } from '../useChosenModel';
import { stopAgentRun, useRunningRun } from '../useRunningRun';

/**
 * Where the user writes to the assistant. Enter sends and Shift+Enter starts a new line;
 * while a run is going, Send becomes Stop (Esc stops too, anywhere in the pane). A message
 * main won't start keeps its place in the box, with a notice above it saying why.
 */
export function AgentPromptBox() {
  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<AgentStartRefusal | null>(null);
  const [isSending, setIsSending] = useState(false);
  const running = useRunningRun();
  const { providerLabel, model } = useChosenModel();
  const openSettings = useOverlayStore((s) => s.openSettings);
  const canSend = !isSending && canSendMessage(draft, running !== null);

  const send = async () => {
    if (!canSend) return;
    setIsSending(true);
    setRefusal(null);
    try {
      const refused = await sendMessage(draft);
      if (refused) setRefusal(refused);
      else setDraft('');
    } catch (error) {
      showToast(explainFailure(error, 'Couldn’t send your message'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const runAction: Record<StartNoticeActionKind, () => void> = {
    settings: () => openSettings('ai'),
    again: () => void send(),
    openRunning: () => {
      setRefusal(null);
      if (running) void openConversation(running.conversationId);
    },
  };

  return (
    <>
      {refusal && (
        <div className="shrink-0 border-t border-line bg-pane px-2.75 pt-2.25">
          <StartRefusalNotice
            words={describeStartRefusal(refusal, providerLabel)}
            who={`${providerLabel} · ${model}`}
            onAction={(kind) => runAction[kind]()}
          />
        </div>
      )}
      <div
        className={cn(
          'shrink-0 border-t border-line bg-pane px-2.75 pt-1.75 pb-2',
          refusal && 'border-t-0'
        )}
      >
        <div className="rounded-[0.5625rem] border border-line-strong bg-pane-sunken transition-colors duration-150 focus-within:border-line-heavy">
          <AppTextarea
            variant="bare"
            aria-label="Message"
            placeholder="Ask for a change, or paste a posting…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              void send();
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
              <AppButton size="xs" variant="solid" disabled={!canSend} onClick={() => void send()}>
                Send
              </AppButton>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
