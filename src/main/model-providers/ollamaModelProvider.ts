import { randomUUID } from 'node:crypto';
import type { ModelProviderError, ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelTool } from '@shared/types/modelTool';
import type { AssistantMessage, ModelMessage, ModelProvider, ModelRequest } from './modelProvider';
import type { OllamaFetch } from './ollamaModels';

interface OllamaChatChunk {
  message?: {
    content?: string;
    thinking?: string;
    tool_calls?: { id?: string; function: { name: string; arguments: unknown } }[];
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

interface ReasoningSoFar {
  text: string;
  startedAt: number;
}

export interface OllamaProviderOptions {
  /** Already checked with `normalizeOllamaAddress`. */
  address: string;
  fetch: OllamaFetch;
  /** The user's choice in Settings; left out, Ollama's own Context length applies. */
  contextTokens?: number;
  now?: () => number;
}

export function createOllamaModelProvider({
  address,
  fetch,
  contextTokens,
  now = () => performance.now(),
}: OllamaProviderOptions): ModelProvider {
  return {
    async *streamReply(request) {
      let response: Response;
      try {
        response = await fetch(`${address}/api/chat`, {
          method: 'POST',
          body: JSON.stringify(buildChatBody(request, contextTokens)),
          signal: request.signal,
        });
      } catch {
        if (!request.signal.aborted) yield { type: 'error', error: { reason: 'unreachable' } };
        return;
      }
      if (!response.ok || !response.body) {
        yield { type: 'error', error: await readErrorResponse(response) };
        return;
      }
      try {
        yield* readChatEvents(readJsonLines(response.body), now);
      } catch (error) {
        if (request.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        yield { type: 'error', error: { reason: 'failed', message } };
      }
    },
  };
}

function buildChatBody(request: ModelRequest, contextTokens: number | undefined) {
  return {
    model: request.model,
    stream: true,
    think: false,
    options: contextTokens === undefined ? undefined : { num_ctx: contextTokens },
    tools: request.tools.map(toOllamaTool),
    messages: [
      { role: 'system', content: request.system },
      ...request.messages.map(toOllamaMessage),
    ],
  };
}

function toOllamaTool(tool: ModelTool) {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  };
}

function toOllamaMessage(message: ModelMessage) {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text };
    case 'assistant':
      return toOllamaAssistantMessage(message);
    case 'toolResult':
      return {
        role: 'tool',
        tool_name: message.toolName,
        tool_call_id: message.callId,
        content: message.content,
      };
  }
}

function toOllamaAssistantMessage({ parts }: AssistantMessage) {
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : []));
  const thinking = parts.flatMap((part) => (part.type === 'reasoning' ? [part.text ?? ''] : []));
  const toolCalls = parts.flatMap((part) =>
    part.type === 'toolCall'
      ? [{ id: part.callId, function: { name: part.name, arguments: part.args } }]
      : []
  );
  return {
    role: 'assistant',
    content: text.join(''),
    thinking: thinking.join('') || undefined,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

/** Each line of a streamed NDJSON body, parsed. A line can arrive split across chunks. */
async function* readJsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let unfinished = '';
  for (;;) {
    const { done, value } = await reader.read();
    unfinished += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const lines = unfinished.split('\n');
    unfinished = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (line.trim() !== '') yield JSON.parse(line);
    }
    if (done) return;
  }
}

async function* readChatEvents(
  chunks: AsyncIterable<unknown>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  let reasoning: ReasoningSoFar | null = null;
  for await (const value of chunks) {
    const chunk = value as OllamaChatChunk;
    if (chunk.error) {
      yield { type: 'error', error: describeOllamaError(chunk.error) };
      return;
    }
    const { content, thinking, tool_calls: toolCalls = [] } = chunk.message ?? {};

    if (thinking) {
      if (!reasoning) {
        reasoning = { text: '', startedAt: now() };
        yield { type: 'reasoningStart' };
      }
      reasoning.text += thinking;
    }
    if (reasoning && (content || toolCalls.length > 0 || chunk.done)) {
      yield { type: 'reasoningEnd', text: reasoning.text, durationMs: now() - reasoning.startedAt };
      reasoning = null;
    }

    if (content) yield { type: 'textDelta', text: content };
    for (const call of toolCalls) {
      yield {
        type: 'toolCall',
        callId: call.id ?? randomUUID(),
        name: call.function.name,
        args: call.function.arguments,
      };
    }

    if (chunk.done) {
      yield {
        type: 'finish',
        reason: chunk.done_reason === 'length' ? 'outputLimit' : 'complete',
        usage:
          chunk.prompt_eval_count === undefined || chunk.eval_count === undefined
            ? null
            : { inputTokens: chunk.prompt_eval_count, outputTokens: chunk.eval_count },
      };
      return;
    }
  }
  throw new Error('Ollama stopped before the reply was finished');
}

async function readErrorResponse(response: Response): Promise<ModelProviderError> {
  const body = await response.text().catch(() => '');
  let message = '';
  try {
    message = String((JSON.parse(body) as { error?: unknown }).error ?? '');
  } catch {
    message = body;
  }
  if (response.status === 404 && /not found/i.test(message)) return { reason: 'model-not-found' };
  return describeOllamaError(message || `Ollama answered ${response.status}`, response.status);
}

function describeOllamaError(message: string, httpStatus?: number): ModelProviderError {
  if (/context length/i.test(message)) return { reason: 'context-too-long' };
  return { reason: 'failed', message, httpStatus };
}
