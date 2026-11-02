import {
  letNoticeGo,
  noteSendBlocked,
  noteSendFailed,
  noteSendRefused,
  noteSendStarted,
  noteSendStarting,
  type NoticeSource,
} from '@/stores/agentNoticeStore';
import { openSentConversation, useConversationStore } from '@/stores/conversationStore';
import { useRunStore } from '@/stores/runStore';
import { showToast } from '@/stores/toastStore';
import type { AgentStart, AgentStartRefusal } from '@shared/types/agentBridge';
import { askAgent, carryOnAgent } from './tools/agentRunTools';

/*
 * Sends a new message or retries a conversation from a notice. Only one run can be
 * active at a time. If this conversation is running, the prompt box allows Stop but
 * not Send. The main process checks for runs in other conversations.
 *
 * If the main process refuses to start, keep the draft and explain why in a notice
 * or the banner for a run in another conversation. When retrying a notice (`answering`),
 * `agentNoticeStore` tracks the result. Stop waiting after five seconds if the model
 * has not responded, rather than leaving the old notice in a sending state.
 */

const NOTICE_HOLD_MS = 5000;

export const canSendMessage = (text: string, isRunningHere: boolean): boolean =>
  !isRunningHere && text.trim() !== '';

function letNoticeGoIfStillSilent(runId: number): void {
  const { live } = useRunStore.getState();
  if (live?.runId === runId && live.parts.length === 0 && !live.hasEnded) letNoticeGo(runId);
}

function isRunGoing(): boolean {
  const { live } = useRunStore.getState();
  return live !== null && !live.hasEnded;
}

/** Use the other-run banner when possible; fall back to a toast if its run is not loaded. */
function noteRefused(conversationId: number | null, reason: AgentStartRefusal): void {
  if (reason !== 'runInProgress') return noteSendRefused(conversationId, reason);
  const { live } = useRunStore.getState();
  if (live && !live.hasEnded && live.conversationId !== conversationId) {
    return noteSendBlocked(conversationId, live.runId);
  }
  noteSendFailed();
  showToast('Not sent. One run at a time, and one is still going.', 'error');
}

async function startSend(
  conversationId: number | null,
  answering: NoticeSource | null,
  start: () => Promise<AgentStart>
): Promise<boolean> {
  noteSendStarting(conversationId, answering, isRunGoing());
  let started: AgentStart;
  try {
    started = await start();
  } catch (error) {
    noteSendFailed();
    throw error;
  }
  if (!started.ok) {
    noteRefused(conversationId, started.reason);
    return false;
  }
  noteSendStarted(started.runId);
  if (answering) setTimeout(() => letNoticeGoIfStillSilent(started.runId), NOTICE_HOLD_MS);
  await openSentConversation(started.conversationId);
  return true;
}

/** Send in the open conversation, or create one. Return true if the run starts. */
export function sendMessage(text: string, answering: NoticeSource | null): Promise<boolean> {
  const { conversationId } = useConversationStore.getState();
  return startSend(conversationId, answering, () => askAgent(text.trim(), conversationId));
}

/** Resume a stopped conversation without adding a new user message. */
export function sendAgain(conversationId: number, answering: NoticeSource): Promise<boolean> {
  return startSend(conversationId, answering, () => carryOnAgent(conversationId));
}
