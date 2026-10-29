import { useEffect } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useRunStore } from '@/stores/runStore';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentStart, AgentToolCall } from '@shared/types/agentBridge';
import {
  createAgentToolRun,
  type AgentToolRun,
  type ConversationReading,
} from './tools/agentToolRun';
import { runAgentTool } from './tools/runAgentTool';

/*
 * The page's side of the assistant's runs, which happen in main. A run asked for here
 * (`askAgent`) gets its own `AgentToolRun`, so the repairs last the whole run, and starts
 * from the reading its conversation's last run left: the handles and the receipt. Each tool
 * call main sends is answered with `runAgentTool` (`tools/`). The shell answers calls
 * through `useAnswerAgentToolCalls`.
 */

interface ToolRunEntry {
  conversationId: number;
  run: AgentToolRun;
}

const toolRunById = new Map<number, ToolRunEntry>();

/** Kept for this session: after a restart, the model reads again. */
const readingByConversation = new Map<number, ConversationReading>();

/** The start under way: a run's first call can come in before its id does. */
let starting: Promise<unknown> = Promise.resolve();

/** Starts a run on the resume open now, in the conversation given or a new one. */
export function askAgent(text: string, conversationId: number | null = null): Promise<AgentStart> {
  const { templateId } = useResumeStore.getState();
  const start = window.mosaic.agent.start({ conversationId, text, templateId }).then((result) => {
    if (result.ok) {
      const reading = readingByConversation.get(result.conversationId);
      const run = createAgentToolRun(text, reading);
      toolRunById.set(result.runId, { conversationId: result.conversationId, run });
    }
    return result;
  });
  starting = start.catch(() => undefined);
  return start;
}

async function answerToolCall(call: AgentToolCall): Promise<AgentToolResult> {
  await starting;
  const entry = toolRunById.get(call.runId);
  if (!entry) throw new Error(`Run ${call.runId} wasn’t asked for from this page`);
  return runAgentTool(entry.run, call.name, call.args);
}

/** What the run left staged is kept, and its reading passes to the next run; the rest goes. */
function endToolRun(runId: number): void {
  const entry = toolRunById.get(runId);
  if (!entry) return;
  const { conversationId, run } = entry;
  useRunStore.getState().keepStagedIds(runId, [...run.suggestionIdByTarget.values()]);
  readingByConversation.set(conversationId, { handles: run.handles, receipt: run.receipt });
  toolRunById.delete(runId);
}

/** Answers the tool calls of runs asked for from this page, and ends each run's tools as it ends. */
export function answerAgentToolCalls(): () => void {
  const stopFollowing = window.mosaic.agent.onEvent(({ runId, event }) => {
    if (event.type === 'runEnded') void starting.then(() => endToolRun(runId));
  });
  const removeRunner = window.mosaic.agent.onToolCall(answerToolCall);
  return () => {
    stopFollowing();
    removeRunner();
  };
}

export function useAnswerAgentToolCalls(): void {
  useEffect(answerAgentToolCalls, []);
}
