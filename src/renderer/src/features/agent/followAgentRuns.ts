import { useEffect } from 'react';
import { agentService } from '@/lib/services/agentService';
import { catchUpConversation } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { loadSecretsStatus } from '@/stores/secretsStore';
import type { AgentRunEnvelope } from '@shared/types/agentBridge';

/*
 * Tracks events from every run and updates the live run in `runStore`.
 * The first event refreshes the conversation to include the user's message or a resume
 * switch. When the run ends, load its saved messages before removing the live copy,
 * so it does not briefly disappear from the transcript. Runs in other conversations
 * continue in the background. Also refresh API key status when a run ends, because
 * the result may change whether a key is known to work.
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

/** Subscribe to all run events. Return a function that unsubscribes. */
export function followAgentRuns(): () => void {
  return agentService.onEvent(followRunEnvelope);
}

export function useFollowAgentRuns(): void {
  useEffect(followAgentRuns, []);
}
