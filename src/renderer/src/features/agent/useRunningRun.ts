import { useRunStore } from '@/stores/runStore';

/** The run still going, in whichever conversation; null when none is. */
export function useRunningRun(): { runId: number; conversationId: number } | null {
  const runId = useRunStore((s) => (s.live && !s.live.hasEnded ? s.live.runId : null));
  const conversationId = useRunStore((s) => s.live?.conversationId ?? null);
  return runId === null || conversationId === null ? null : { runId, conversationId };
}

export function stopAgentRun(runId: number): void {
  void window.mosaic.agent.stop(runId);
}
