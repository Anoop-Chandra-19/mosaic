import { useEffect } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentStart, AgentToolCall } from '@shared/types/agentBridge';
import { createAgentToolRun, type AgentToolRun } from './tools/agentToolRun';
import { runAgentTool } from './tools/runAgentTool';

/*
 * The page's side of the assistant's runs, which happen in main. A run asked for here
 * (`askAgent`) gets its own `AgentToolRun`, so the handles, the receipt and the repairs
 * last the whole run, and each tool call main sends is answered with `runAgentTool`
 * (`tools/`). The shell answers calls through `useAnswerAgentToolCalls`.
 */

const toolRunById = new Map<number, AgentToolRun>();

/** The start under way: a run's first call can come in before its id does. */
let starting: Promise<unknown> = Promise.resolve();

/** Starts a run in a new conversation, on the resume open now. */
export function askAgent(text: string): Promise<AgentStart> {
  const { templateId } = useResumeStore.getState();
  const start = window.mosaic.agent
    .start({ conversationId: null, text, templateId })
    .then((result) => {
      if (result.ok) toolRunById.set(result.runId, createAgentToolRun(text));
      return result;
    });
  starting = start.catch(() => undefined);
  return start;
}

async function answerToolCall(call: AgentToolCall): Promise<AgentToolResult> {
  await starting;
  const run = toolRunById.get(call.runId);
  if (!run) throw new Error(`Run ${call.runId} wasn’t asked for from this page`);
  return runAgentTool(run, call.name, call.args);
}

/** Answers the tool calls of runs asked for from this page, and forgets each run as it ends. */
export function answerAgentToolCalls(): () => void {
  const stopFollowing = window.mosaic.agent.onEvent(({ runId, event }) => {
    if (event.type === 'runEnded') void starting.then(() => toolRunById.delete(runId));
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
