import { openSentConversation, useConversationStore } from '@/stores/conversationStore';
import type { AgentStartRefusal } from '@shared/types/agentBridge';
import { askAgent } from '../agentRunTools';

/*
 * What the prompt box sends. One run at a time: while one is going, the box can stop it
 * but not send. A message main turns down stays in the box, so nothing typed is lost.
 */

export const canSendMessage = (text: string, isRunning: boolean): boolean =>
  !isRunning && text.trim() !== '';

/** Sends in the open conversation, or starts one; null once it is on its way. */
export async function sendMessage(text: string): Promise<AgentStartRefusal | null> {
  const start = await askAgent(text.trim(), useConversationStore.getState().conversationId);
  if (!start.ok) return start.reason;
  await openSentConversation(start.conversationId);
  return null;
}
