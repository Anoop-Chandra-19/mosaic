import { useAgentNoticeStore } from '@/stores/agentNoticeStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { useSecretsStatus } from '@/stores/secretsStore';
import type { RunView } from '@/types/agentRunView';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import { buildRunView } from '../transcript/buildRunView';
import { useChosenModel } from '../useChosenModel';
import { pickNotice, type LiveRunFacts, type NoticeChoice } from './pickNotice';
import { describeStartRefusal } from './startRefusalWords';
import { describeStop, findKeySavedSince } from './stopWords';
import { useServerAddresses } from './useServerAddresses';

/** The open conversation's run under way, as plain facts. */
function useLiveRunFacts(conversationId: number | null): LiveRunFacts | null {
  const runId = useRunStore((s) =>
    s.live && s.live.conversationId === conversationId ? s.live.runId : null
  );
  const hasProgress = useRunStore(
    (s) =>
      s.live?.parts.some((part) => part.type !== 'toolCall' || part.status !== 'waiting') ?? false
  );
  const hasEnded = useRunStore((s) => s.live?.hasEnded ?? false);
  return runId === null ? null : { runId, hasProgress, hasEnded };
}

/** The notice the slot over the prompt box shows now, if any. */
export function useAgentNotice(): NoticeChoice {
  const conversationId = useConversationStore((s) => s.conversationId);
  const messages = useConversationStore((s) => s.messages);
  const live = useLiveRunFacts(conversationId);
  const { refusal, resend, dismissedRunIds } = useAgentNoticeStore();
  const serverAddresses = useServerAddresses();
  const savedKeys = useSecretsStatus().status?.saved ?? {};
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
      describeStop(run.stop, run.model, serverAddresses, findKeySavedSince(run, savedKeys)),
    describeRefusal: (reason: AgentStartRefusal) => describeStartRefusal(reason, chosen),
  });
}
