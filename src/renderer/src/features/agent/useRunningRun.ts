import { agentService } from '@/lib/services/agentService';
import { useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { attempt } from '@/stores/toastStore';

/** The run still going, in whichever conversation; null when none is. */
export function useRunningRun(): { runId: number; conversationId: number } | null {
  const runId = useRunStore((s) => (s.live && !s.live.hasEnded ? s.live.runId : null));
  const conversationId = useRunStore((s) => s.live?.conversationId ?? null);
  return runId === null || conversationId === null ? null : { runId, conversationId };
}

/** The run going in the open conversation: the only one the box and Esc can stop. */
export function useRunningHere(): { runId: number; conversationId: number } | null {
  const running = useRunningRun();
  const openId = useConversationStore((s) => s.conversationId);
  return running?.conversationId === openId ? running : null;
}

export function stopAgentRun(runId: number): void {
  void attempt(agentService.stop(runId), 'Couldn’t stop the run');
}
