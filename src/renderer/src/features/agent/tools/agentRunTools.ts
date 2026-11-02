import { useEffect } from 'react';
import { agentService } from '@/lib/services/agentService';
import { useResumeStore } from '@/stores/resumeStore';
import { useRunStore } from '@/stores/runStore';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentStart, AgentToolCall } from '@shared/types/agentBridge';
import { runAgentTool } from './runAgentTool';
import { createAgentToolRun, type AgentToolRun } from './tool-run/agentToolRun';

/*
 * Renderer entry points for assistant runs executed in main. `askAgent` and
 * `carryOnAgent` (Send again) create an `AgentToolRun` with run-wide repair tracking
 * and the previous run's handles and receipt for that conversation. `runAgentTool`
 * answers tool calls from main. The shell subscribes through `useAnswerAgentToolCalls`.
 */

interface ToolRunEntry {
  conversationId: number;
  run: AgentToolRun;
}

const toolRunById = new Map<number, ToolRunEntry>();

/** Retain each conversation's last run for this session; restarting requires a new read. */
const lastToolRunByConversation = new Map<number, AgentToolRun>();

/** Wait for run registration: the first tool call can arrive before the start response. */
let starting: Promise<unknown> = Promise.resolve();

/** Register tool state for the run started in main, reusing the conversation's last reading. */
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

/** Continue the conversation from its log without adding a message. */
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

/** Keep staged suggestion IDs and retain the run's reading for the next conversation turn. */
function endToolRun(runId: number): void {
  const entry = toolRunById.get(runId);
  if (!entry) return;
  const { conversationId, run } = entry;
  useRunStore.getState().keepStagedIds(runId, [...run.stagedIds]);
  lastToolRunByConversation.set(conversationId, run);
  toolRunById.delete(runId);
}

/** Subscribe to tool calls and run endings for runs started by this renderer. */
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
