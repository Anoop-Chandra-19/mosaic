import { useEffect } from 'react';
import { agentService } from '@/lib/services/agentService';
import { useResumeStore } from '@/stores/resumeStore';
import { useRunStore } from '@/stores/runStore';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentStart, AgentToolCall } from '@shared/types/agentBridge';
import { createAgentToolRun, type AgentToolRun } from './agentToolRun';
import { runAgentTool } from './runAgentTool';

/*
 * The page's side of the assistant's runs, which happen in main. A run asked for here
 * (`askAgent`, or `carryOnAgent` for Send again) gets its own `AgentToolRun`, so the
 * repairs last the whole run, and starts from the reading its conversation's last run
 * left: the handles and the receipt. Each tool call main sends is answered with
 * `runAgentTool`. The shell answers calls through `useAnswerAgentToolCalls`.
 */

interface ToolRunEntry {
  conversationId: number;
  run: AgentToolRun;
}

const toolRunById = new Map<number, ToolRunEntry>();

/** Kept for this session: after a restart, the model reads again. */
const lastToolRunByConversation = new Map<number, AgentToolRun>();

/** The start under way: a run's first call can come in before its id does. */
let starting: Promise<unknown> = Promise.resolve();

/** Gives the run main started its tools, built from the conversation's last run. */
function startToolRun(
  start: Promise<AgentStart>,
  readRequestText: (lastRun: AgentToolRun | undefined) => string
): Promise<AgentStart> {
  const started = start.then((result) => {
    if (result.ok) {
      const lastRun = lastToolRunByConversation.get(result.conversationId);
      const run = createAgentToolRun(readRequestText(lastRun), lastRun);
      toolRunById.set(result.runId, { conversationId: result.conversationId, run });
    }
    return result;
  });
  starting = started.catch(() => undefined);
  return started;
}

/** Starts a run on the resume open now, in the conversation given or a new one. */
export function askAgent(text: string, conversationId: number | null = null): Promise<AgentStart> {
  const { templateId } = useResumeStore.getState();
  return startToolRun(agentService.start({ conversationId, text, templateId }), () => text);
}

/** Sends the conversation again with no new message: the run goes on from its log. */
export function carryOnAgent(conversationId: number): Promise<AgentStart> {
  const { templateId } = useResumeStore.getState();
  return startToolRun(
    agentService.carryOn({ conversationId, templateId }),
    (lastRun) => lastRun?.requestText ?? ''
  );
}

async function answerToolCall(call: AgentToolCall): Promise<AgentToolResult> {
  await starting;
  const entry = toolRunById.get(call.runId);
  if (!entry) throw new Error(`Run ${call.runId} wasn’t asked for from this page`);
  return runAgentTool(entry.run, call.name, call.args);
}

/** What the run left staged is kept, and the next run in its conversation starts from it. */
function endToolRun(runId: number): void {
  const entry = toolRunById.get(runId);
  if (!entry) return;
  const { conversationId, run } = entry;
  useRunStore.getState().keepStagedIds(runId, [...run.stagedIds]);
  lastToolRunByConversation.set(conversationId, run);
  toolRunById.delete(runId);
}

/** Answers the tool calls of runs asked for from this page, and ends each run's tools as it ends. */
export function answerAgentToolCalls(): () => void {
  const stopFollowing = agentService.onEvent(({ runId, event }) => {
    if (event.type === 'runEnded') void starting.then(() => endToolRun(runId));
  });
  const removeRunner = agentService.onToolCall(answerToolCall);
  return () => {
    stopFollowing();
    removeRunner();
  };
}

export function useAnswerAgentToolCalls(): void {
  useEffect(answerAgentToolCalls, []);
}
