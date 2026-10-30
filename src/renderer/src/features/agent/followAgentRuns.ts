import { useEffect } from 'react';
import { agentService } from '@/lib/services/agentService';
import { catchUpConversation } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { loadSecretsStatus } from '@/stores/secretsStore';
import type { AgentRunEnvelope } from '@shared/types/agentBridge';

/*
 * Keeps the pane up with every run, whoever started it. Its events build the live run
 * (`runStore`). When its conversation is the open one, its first event shows what it
 * opened with (the user's message, a switch of resume), and at its end the transcript
 * reads what it stored; only then is the live copy dropped, so the run never blinks out
 * between the two. A run in another conversation carries on in the background. A run's
 * end can also say something about its API key, so the saved keys are read again then.
 */

const catchUp = (conversationId: number) =>
  catchUpConversation(conversationId).catch((error: unknown) =>
    console.error('Couldn’t read the conversation', error)
  );

async function foldEndedRun({ conversationId, runId }: AgentRunEnvelope): Promise<void> {
  await catchUp(conversationId);
  useRunStore.getState().dropLiveRun(runId);
}

function followRunEnvelope(envelope: AgentRunEnvelope): void {
  useRunStore.getState().followRunEvent(envelope);
  if (envelope.seq === 1) void catchUp(envelope.conversationId);
  if (envelope.event.type === 'runEnded') {
    void foldEndedRun(envelope);
    void loadSecretsStatus();
  }
}

/** Follows every run's events; returns the call that stops. */
export function followAgentRuns(): () => void {
  return agentService.onEvent(followRunEnvelope);
}

export function useFollowAgentRuns(): void {
  useEffect(followAgentRuns, []);
}
