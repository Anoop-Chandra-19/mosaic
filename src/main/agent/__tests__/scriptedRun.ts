import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelProvider, ModelRequest } from '../../model-providers/modelProvider';
import type { ToolBridge, ToolCallRequest } from '../runToolRound';

/** A step's reply: events played back, or a stream of its own (to hang, or to fail). */
export type ScriptedReply =
  | ModelStreamEvent[]
  | ((request: ModelRequest) => AsyncIterable<ModelStreamEvent>);

/** A model that plays back one reply per request, and remembers every request. */
export function scriptedModel(replies: ScriptedReply[]) {
  const requests: ModelRequest[] = [];
  const provider: ModelProvider = {
    async *streamReply(request) {
      requests.push(request);
      const reply = replies[requests.length - 1];
      if (!reply) throw new Error(`No reply scripted for request ${requests.length}`);
      if (typeof reply === 'function') yield* reply(request);
      else yield* reply;
    },
  };
  return { provider, requests };
}

export const DONE: ModelStreamEvent = {
  type: 'finish',
  reason: 'complete',
  usage: { inputTokens: 100, outputTokens: 10 },
};

export const callTool = (callId: string, name: string, args: unknown = {}): ModelStreamEvent => ({
  type: 'toolCall',
  callId,
  name,
  args,
});

export const say = (text: string): ModelStreamEvent => ({ type: 'textDelta', text });

/** Waits until the request is cancelled, sending nothing. */
export const hang = (request: ModelRequest): AsyncIterable<ModelStreamEvent> => ({
  [Symbol.asyncIterator]: () => ({
    next: () =>
      new Promise<IteratorResult<ModelStreamEvent>>((resolve) => {
        const end = () => resolve({ done: true, value: undefined });
        if (request.signal.aborted) end();
        else request.signal.addEventListener('abort', end);
      }),
  }),
});

export type PageAnswer = Omit<AgentToolResult, 'draft'> & { draft?: AgentToolResult['draft'] };

/** A page that answers each call with `answer`, remembering the calls. */
export function fakePage(
  answer: (call: ToolCallRequest) => PageAnswer | Promise<PageAnswer>,
  draft: AgentToolResult['draft'] = null
) {
  const calls: ToolCallRequest[] = [];
  const bridge: ToolBridge = {
    async runTool(call) {
      calls.push(call);
      return { draft, ...(await answer(call)) };
    },
  };
  return { bridge, calls };
}

export const ok = (content: string): PageAnswer => ({ content, isError: false });
export const refused = (content: string): PageAnswer => ({ content, isError: true });
