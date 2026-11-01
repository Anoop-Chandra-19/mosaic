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
 * What the prompt box sends: a message, or Send again from a notice. One run at a time:
 * while one is going here, the box can stop it but not send. Main decides for a run going
 * elsewhere. A message main turns down stays in the box, so nothing typed is lost, and the
 * notice or the running strip says why. A send made while a notice showed (`answering`) is
 * told apart by its answer (`agentNoticeStore`), for as long as a quick answer takes: a model
 * can be silent for a minute, and the notice doesn't wait.
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

/** The strip says it when it can; main can know of a run this page hasn't heard of yet. */
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

/** Sends in the open conversation, or starts one; true once it is on its way. */
export function sendMessage(text: string, answering: NoticeSource | null): Promise<boolean> {
  const { conversationId } = useConversationStore.getState();
  return startSend(conversationId, answering, () => askAgent(text.trim(), conversationId));
}

/** Sends the open conversation again with no new message, after a stop. */
export function sendAgain(conversationId: number, answering: NoticeSource): Promise<boolean> {
  return startSend(conversationId, answering, () => carryOnAgent(conversationId));
}
