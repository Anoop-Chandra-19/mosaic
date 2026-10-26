import { APIConnectionError, APIError } from 'openai';
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { CompletionUsage } from 'openai/resources/completions';
import { isRecord } from '@shared/resume/validateResume';
import type {
  ModelProviderError,
  ModelReplyPart,
  ModelStreamEvent,
  ModelUsage,
} from '@shared/types/modelReply';
import type { ModelTool } from '@shared/types/modelTool';
import { describeNetworkError } from './describeNetworkError';
import type { ModelMessage, ModelProvider, ModelRequest } from './modelProvider';
import { createOpenAiClient, type OpenAiFetch } from './openAiClient';
import { parseToolArguments } from './parseToolArguments';
import { readRateLimit } from './readRateLimit';

/*
 * OpenRouter, through its OpenAI-compatible Chat Completions, with the `openai` SDK. It
 * routes each request to a provider behind it. Reasoning arrives as `reasoning_details`
 * pieces, merged by index, stored as the reasoning part's `providerState` and sent back
 * unchanged, so the model keeps its reasoning across tool calls. OpenRouter's own fields
 * (reasoning details, caching, error metadata) are typed here, since the SDK doesn't know
 * them.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterProviderOptions {
  apiKey: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: OpenAiFetch;
  now?: () => number;
}

/**
 * One piece of reasoning, as the provider behind OpenRouter gave it: `reasoning.text`,
 * `reasoning.summary` or `reasoning.encrypted`. Kept whole, fields we don't read included,
 * since it goes back unchanged.
 */
type ReasoningDetail = { type: string; index?: number } & Record<string, unknown>;

/** What a stored reasoning part holds for OpenRouter. */
interface OpenRouterReasoning {
  type: 'openrouter';
  details: ReasoningDetail[];
}

type OpenRouterDelta = ChatCompletionChunk.Choice.Delta & {
  reasoning?: string | null;
  reasoning_details?: ReasoningDetail[];
};

type OpenRouterAssistantMessage = ChatCompletionAssistantMessageParam & {
  reasoning_details?: ReasoningDetail[];
};

type OpenRouterRequestBody = ChatCompletionCreateParamsStreaming & {
  /** Asks providers that cache only when asked (Anthropic's) to cache the conversation so far. */
  cache_control: { type: 'ephemeral' };
  /** Keeps a conversation on one provider endpoint, so its cache stays warm. */
  session_id: string;
};

/** Streamed pieces of these fields are joined; any other field takes its latest value. */
const JOINED_DETAIL_FIELDS = new Set(['text', 'summary', 'data']);

type NamedReason = Exclude<ModelProviderError['reason'], 'failed'>;

/** A request error's status is its code; one partway through has the code alone. */
const REASON_BY_CODE: Record<number, NamedReason | undefined> = {
  401: 'keyRefused',
  402: 'quotaExceeded',
  404: 'model-not-found',
  429: 'rateLimited',
};

export function createOpenRouterModelProvider({
  apiKey,
  fetch,
  now = () => performance.now(),
}: OpenRouterProviderOptions): ModelProvider {
  const client = createOpenAiClient(apiKey, OPENROUTER_URL, fetch);
  return {
    async *streamReply(request) {
      try {
        const chunks = await client.chat.completions.create(buildRequestBody(request), {
          signal: request.signal,
        });
        yield* readChunks(chunks, now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeOpenRouterError(error) };
      }
    },
  };
}

function buildRequestBody(request: ModelRequest): OpenRouterRequestBody {
  return {
    model: request.model,
    messages: [{ role: 'system', content: request.system }, ...request.messages.map(toChatMessage)],
    tools: request.tools.map(toFunctionTool),
    stream: true,
    cache_control: { type: 'ephemeral' },
    session_id: request.cacheKey,
  };
}

function toFunctionTool(tool: ModelTool): ChatCompletionTool {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  };
}

function toChatMessage(message: ModelMessage): ChatCompletionMessageParam {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text };
    case 'assistant':
      return toAssistantMessage(message.parts);
    case 'toolResult':
      return { role: 'tool', tool_call_id: message.callId, content: message.content };
  }
}

/** A reply's parts as one message: its text, its calls, and OpenRouter's reasoning. */
function toAssistantMessage(parts: ModelReplyPart[]): OpenRouterAssistantMessage {
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
  const toolCalls = parts.flatMap((part) => (part.type === 'toolCall' ? [toToolCall(part)] : []));
  const details = parts.flatMap((part) =>
    part.type === 'reasoning' && isOpenRouterReasoning(part.providerState)
      ? part.providerState.details
      : []
  );
  const message: OpenRouterAssistantMessage = { role: 'assistant', content: text };
  if (toolCalls.length > 0) {
    // Calls alone have no content, rather than an empty one some providers refuse.
    message.content = text || null;
    message.tool_calls = toolCalls;
  }
  if (details.length > 0) message.reasoning_details = details;
  return message;
}

function toToolCall(
  part: Extract<ModelReplyPart, { type: 'toolCall' }>
): ChatCompletionMessageToolCall {
  const args = typeof part.args === 'string' ? part.args : JSON.stringify(part.args);
  return { id: part.callId, type: 'function', function: { name: part.name, arguments: args } };
}

/** Reasoning OpenRouter sent; another provider's, in a conversation that switched, isn't sent. */
function isOpenRouterReasoning(state: unknown): state is OpenRouterReasoning {
  return isRecord(state) && state.type === 'openrouter' && Array.isArray(state.details);
}

/** Reasoning under way: from its first piece until the reply moves on to text or a call. */
interface ReasoningUnderWay {
  startedAt: number;
  text: string;
  details: ReasoningDetail[];
}

interface CallUnderWay {
  callId: string;
  name: string;
  args: string;
}

/**
 * The stream's chunks as our events. Calls arrive in pieces by index and go on whole at
 * the end; usage comes in the last chunk, after the finish reason.
 */
async function* readChunks(
  chunks: AsyncIterable<ChatCompletionChunk>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  let reasoning: ReasoningUnderWay | null = null;
  const calls = new Map<number, CallUnderWay>();
  let finishReason: string | null = null;
  let usage: CompletionUsage | undefined;
  for await (const chunk of chunks) {
    usage = chunk.usage ?? usage;
    const choice = chunk.choices[0];
    if (!choice) continue;
    const delta = choice.delta as OpenRouterDelta;
    if (delta.reasoning || delta.reasoning_details?.length) {
      if (!reasoning) {
        reasoning = { startedAt: now(), text: '', details: [] };
        yield { type: 'reasoningStart' };
      }
      addReasoning(reasoning, delta);
    } else if (reasoning && (delta.content || delta.tool_calls)) {
      yield endReasoning(reasoning, now);
      reasoning = null;
    }
    if (delta.content) yield { type: 'textDelta', text: delta.content };
    for (const piece of delta.tool_calls ?? []) addCallPiece(calls, piece);
    finishReason = choice.finish_reason ?? finishReason;
  }
  if (reasoning) yield endReasoning(reasoning, now);
  if (!finishReason) throw new Error('OpenRouter stopped before the reply was finished');
  for (const index of [...calls.keys()].sort((a, b) => a - b)) {
    const { callId, name, args } = calls.get(index)!;
    yield { type: 'toolCall', callId, name, args: parseToolArguments(args) };
  }
  yield finishEvent(finishReason, usage);
}

function addReasoning(reasoning: ReasoningUnderWay, delta: OpenRouterDelta): void {
  reasoning.text += delta.reasoning ?? '';
  for (const piece of delta.reasoning_details ?? []) addReasoningDetail(reasoning.details, piece);
}

/** A piece with an index already seen continues that detail; any other starts one. */
function addReasoningDetail(details: ReasoningDetail[], piece: ReasoningDetail): void {
  const continued = details.find(
    (detail) => piece.index !== undefined && detail.index === piece.index
  );
  if (!continued) {
    details.push({ ...piece });
    return;
  }
  for (const [field, value] of Object.entries(piece)) {
    if (value === null || value === undefined) continue;
    const before = continued[field];
    const isJoined =
      JOINED_DETAIL_FIELDS.has(field) && typeof before === 'string' && typeof value === 'string';
    continued[field] = isJoined ? before + value : value;
  }
}

function endReasoning(reasoning: ReasoningUnderWay, now: () => number): ModelStreamEvent {
  const providerState: OpenRouterReasoning = { type: 'openrouter', details: reasoning.details };
  return {
    type: 'reasoningEnd',
    text: reasoning.text || undefined,
    durationMs: now() - reasoning.startedAt,
    providerState: reasoning.details.length > 0 ? providerState : undefined,
  };
}

/** The first piece of a call has its id and name; the rest add to its arguments. */
function addCallPiece(
  calls: Map<number, CallUnderWay>,
  piece: ChatCompletionChunk.Choice.Delta.ToolCall
): void {
  const call = calls.get(piece.index) ?? { callId: '', name: '', args: '' };
  call.callId = piece.id ?? call.callId;
  call.name = piece.function?.name ?? call.name;
  call.args += piece.function?.arguments ?? '';
  calls.set(piece.index, call);
}

function finishEvent(finishReason: string, usage: CompletionUsage | undefined): ModelStreamEvent {
  if (finishReason === 'content_filter') {
    return { type: 'error', error: { reason: 'contentBlocked' } };
  }
  const reason = finishReason === 'length' ? 'outputLimit' : 'complete';
  return { type: 'finish', reason, usage: readUsage(usage) };
}

function readUsage(usage: CompletionUsage | undefined): ModelUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens,
  };
}

/** The SDK's errors: the network, an error status, or an error chunk partway through. */
function describeOpenRouterError(error: unknown): ModelProviderError {
  if (error instanceof APIConnectionError) {
    const message = error.cause ? describeNetworkError(error.cause) : error.message;
    return { reason: 'unreachable', message };
  }
  if (error instanceof APIError) {
    const body = isRecord(error.error) ? error.error : {};
    return sortError({
      code: error.status ?? (typeof body.code === 'number' ? body.code : undefined),
      httpStatus: error.status,
      message: readErrorMessage(body) ?? error.message,
      metadata: isRecord(body.metadata) ? body.metadata : {},
      headers: error.headers,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return { reason: 'failed', message };
}

/**
 * OpenRouter's words, then, when it passes on the error of the provider behind it, that
 * provider's own, as it came.
 */
function readErrorMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body.message !== 'string') return undefined;
  const raw = isRecord(body.metadata) ? body.metadata.raw : undefined;
  return typeof raw === 'string' && raw !== '' ? `${body.message}\n${raw}` : body.message;
}

interface OpenRouterErrorFacts {
  code?: number;
  httpStatus?: number;
  message: string;
  metadata: Record<string, unknown>;
  headers?: Headers;
}

function sortError({
  code,
  httpStatus,
  message,
  metadata,
  headers,
}: OpenRouterErrorFacts): ModelProviderError {
  // OpenRouter says "No endpoints found that support tool use" when no route takes tools.
  if (code === 404 && /tool use/i.test(message)) {
    return { reason: 'toolsUnsupported', message, httpStatus };
  }
  // A 403 is also a key's permissions or a guardrail; moderation is the one with reasons.
  if (code === 403 && metadata.reasons !== undefined) {
    return { reason: 'contentBlocked', message, httpStatus };
  }
  const reason = code === undefined ? undefined : REASON_BY_CODE[code];
  if (reason === 'rateLimited' && headers) {
    return { ...readRateLimit(headers), message, httpStatus };
  }
  if (reason) return { reason, message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}
