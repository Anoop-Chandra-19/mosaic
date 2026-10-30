import { useEffect, useState } from 'react';
import { useAgentNoticeStore } from '@/stores/agentNoticeStore';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useRunStore } from '@/stores/runStore';
import type { RunView } from '@/types/agentRunView';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import type { SecretsStatus } from '@shared/types/secrets';
import { buildRunView } from '../transcript/buildRunView';
import { useChosenModel } from '../useChosenModel';
import { pickNotice, type LiveRunFacts, type NoticeChoice } from './pickNotice';
import { describeStartRefusal } from './startRefusalWords';
import { describeStop, findKeySavedSince } from './stopWords';

/** The open conversation's run under way, as plain facts. */
function useLiveRunFacts(conversationId: number | null): LiveRunFacts | null {
  const runId = useRunStore((s) =>
    s.live && s.live.conversationId === conversationId ? s.live.runId : null
  );
  const hasProgress = useRunStore((s) => (s.live?.parts.length ?? 0) > 0);
  const hasEnded = useRunStore((s) => s.live?.hasEnded ?? false);
  return runId === null ? null : { runId, hasProgress, hasEnded };
}

/** The saved keys' dates, read again as Settings closes: keys only change there. */
function useSavedKeys(): SecretsStatus['saved'] {
  const isSettingsOpen = useOverlayStore((s) => s.settingsSection !== null);
  const [saved, setSaved] = useState<SecretsStatus['saved']>({});

  useEffect(() => {
    if (isSettingsOpen) return;
    let isCurrent = true;
    window.mosaic.secrets.status().then(
      (status) => {
        if (isCurrent) setSaved(status.saved);
      },
      (error: unknown) => console.error('Could not check for saved keys', error)
    );
    return () => {
      isCurrent = false;
    };
  }, [isSettingsOpen]);

  return saved;
}

/** The notice the slot over the prompt box shows now, if any. */
export function useAgentNotice(): NoticeChoice {
  const conversationId = useConversationStore((s) => s.conversationId);
  const messages = useConversationStore((s) => s.messages);
  const live = useLiveRunFacts(conversationId);
  const { refusal, resend, dismissedRunIds } = useAgentNoticeStore();
  const ollamaAddress = useAgentSettingsStore((s) => s.ollamaAddress);
  const savedKeys = useSavedKeys();
  const chosen = useChosenModel();

  return pickNotice({
    conversationId,
    runs: buildRunView(messages),
    live,
    refusal,
    resend,
    dismissedRunIds,
    describeRun: (run: RunView) =>
      run.stop &&
      describeStop(run.stop, run.model, ollamaAddress, findKeySavedSince(run, savedKeys)),
    describeRefusal: (reason: AgentStartRefusal) => describeStartRefusal(reason, chosen),
  });
}
