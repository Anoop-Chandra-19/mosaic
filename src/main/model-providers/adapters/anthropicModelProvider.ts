import Anthropic, { APIConnectionError, APIError } from '@anthropic-ai/sdk';
import type {
  ContentBlockParam,
  MessageCreateParamsStreaming,
  MessageDeltaUsage,
  MessageParam,
  RawMessageStreamEvent,
  RedactedThinkingBlock,
  StopReason,
  ThinkingBlock,
  Tool,
  Usage,
} from '@anthropic-ai/sdk/resources/messages';
import type { ErrorType } from '@anthropic-ai/sdk/resources/shared';
import { isRecord } from '@shared/resume/validateResume';
import type {
  ModelProviderError,
  ModelReplyPart,
  ModelStreamEvent,
  ModelUsage,
} from '@shared/types/modelReply';
import type { ModelTool } from '@shared/types/modelTool';
import { describeNetworkError } from '../describeNetworkError';
import type { ModelMessage, ModelProvider, ModelRequest } from '../modelProvider';
import { noteArrivals } from '../noteArrivals';
import { parseToolArguments } from '../parseToolArguments';
import { PROVIDER_API_URL } from '../providerEndpoints';
import { readRateLimit } from '../readRateLimit';

/*
 * Anthropic, through its Messages API. Each request sends the whole conversation, with
 * Anthropic's prompt cache asked for (it caches only when asked). Thinking comes back as
 * thinking blocks with a signature, or as redacted ones; each is stored whole as the
 * reasoning part's `providerState` and goes back unchanged and in order, as Anthropic
 * requires across tool calls.
 */

/**
 * Anthropic requires a cap on the reply. This one fits every current Claude model's
 * output limit and leaves thinking, which counts towards it, plenty of room.
 */
const MAX_REPLY_TOKENS = 32_000;

/** Electron's `net.fetch` takes no `URL` objects; the SDK's are made strings. */
export type AnthropicFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: AnthropicFetch;
  now?: () => number;
}

type NamedReason = Exclude<ModelProviderError['reason'], 'failed'>;

/** The `type` in Anthropic's error body; overloaded and server errors stay `failed`, retried. */
const REASON_BY_ERROR_TYPE: Partial<Record<ErrorType, NamedReason>> = {
  authentication_error: 'keyRefused',
  permission_error: 'keyRefused',
  billing_error: 'quotaExceeded',
  not_found_error: 'model-not-found',
  rate_limit_error: 'rateLimited',
};

/** Refusals Anthropic sends as a plain `invalid_request_error`, told apart by their words. */
const REASON_BY_REQUEST_ERROR_WORDS: [RegExp, NamedReason][] = [
  [/prompt is too long/i, 'context-too-long'],
  [/credit balance/i, 'quotaExceeded'],
];

export function createAnthropicModelProvider({
  apiKey,
  fetch,
  now = () => performance.now(),
}: AnthropicProviderOptions): ModelProvider {
  const client = createAnthropicClient(apiKey, fetch);
  return {
    async *streamReply(request) {
      try {
        const events = await client.messages.create(buildMessageBody(request), {
          signal: request.signal,
        });
        yield* readMessageEvents(noteArrivals(events, request), now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeAnthropicError(error) };
      }
    },
  };
}

/**
 * Every setting the SDK would otherwise take from the environment or its config files is
 * given, so only Settings decides where requests go and with which key.
 */
function createAnthropicClient(apiKey: string, fetch: AnthropicFetch): Anthropic {
  return new Anthropic({
    apiKey,
    fetch: (url, init) => fetch(String(url), init),
    baseURL: PROVIDER_API_URL.anthropic,
    webhookKey: null,
    maxRetries: 0,
    logLevel: 'off',
    openTelemetry: false,
  });
}

function buildMessageBody(request: ModelRequest): MessageCreateParamsStreaming {
  return {
    model: request.model,
    max_tokens: MAX_REPLY_TOKENS,
    system: request.system,
    messages: toAnthropicMessages(request.messages),
    tools: request.tools.map(toAnthropicTool),
    stream: true,
    // Marks the last block, so each step reads the conversation so far from the cache.
    cache_control: { type: 'ephemeral' },
  };
}

function toAnthropicTool(tool: ModelTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: { ...tool.inputSchema, type: 'object' },
  };
}

/**
 * Anthropic takes turns that alternate, so a step's tool results, and a message after
 * them, are one user turn; tool results go back as blocks of it.
 */
function toAnthropicMessages(messages: ModelMessage[]): MessageParam[] {
  const turns: { role: 'user' | 'assistant'; content: ContentBlockParam[] }[] = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const blocks = toContentBlocks(message);
    if (blocks.length === 0) continue;
    const last = turns.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  }
  return turns;
}

function toContentBlocks(message: ModelMessage): ContentBlockParam[] {
  switch (message.role) {
    case 'user':
      return [{ type: 'text', text: message.text }];
    case 'assistant':
      return message.parts.flatMap(toAssistantBlocks);
    case 'toolResult':
      return [
        {
          type: 'tool_result',
          tool_use_id: message.callId,
          content: message.content,
          is_error: message.isError,
        },
      ];
  }
}

function toAssistantBlocks(part: ModelReplyPart): ContentBlockParam[] {
  switch (part.type) {
    // Anthropic refuses an empty text block.
    case 'text':
      return part.text ? [{ type: 'text', text: part.text }] : [];
    case 'reasoning':
      return isAnthropicThinking(part.providerState) ? [part.providerState] : [];
    case 'toolCall':
      return [
        {
          type: 'tool_use',
          id: part.callId,
          name: part.name,
          // Arguments that didn't parse can't go back as written: Anthropic takes an object.
          // The tool's result already told the model what was wrong with them.
          input: isRecord(part.args) ? part.args : {},
        },
      ];
  }
}

/** Thinking Anthropic sent; another provider's, in a conversation that switched, isn't sent. */
function isAnthropicThinking(state: unknown): state is ThinkingBlock | RedactedThinkingBlock {
  if (!isRecord(state)) return false;
  if (state.type === 'redacted_thinking') return typeof state.data === 'string';
  return (
    state.type === 'thinking' &&
    typeof state.thinking === 'string' &&
    typeof state.signature === 'string'
  );
}

/** A block of the reply under way, by its index, until its stop event. */
type BlockUnderWay =
  | { type: 'text' }
  | { type: 'thinking'; startedAt: number; thinking: string; signature: string }
  | { type: 'redactedThinking'; startedAt: number; block: RedactedThinkingBlock }
  | { type: 'toolUse'; callId: string; name: string; args: string };

/**
 * The stream's events as ours. Text goes on as it arrives; thinking and calls go on whole
 * when their block stops. Usage comes at the start and is added to by `message_delta`.
 */
async function* readMessageEvents(
  events: AsyncIterable<RawMessageStreamEvent>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  const blocks = new Map<number, BlockUnderWay>();
  let usage: Usage | null = null;
  let stopReason: StopReason | null = null;
  for await (const event of events) {
    switch (event.type) {
      case 'message_start':
        usage = event.message.usage;
        break;
      case 'content_block_start': {
        const block = startBlock(event.content_block, now);
        if (block) blocks.set(event.index, block);
        if (block?.type === 'thinking' || block?.type === 'redactedThinking') {
          yield { type: 'reasoningStart' };
        }
        if (block?.type === 'toolUse') {
          yield { type: 'toolCallStart', callId: block.callId, name: block.name };
        }
        break;
      }
      case 'content_block_delta': {
        const block = blocks.get(event.index);
        if (event.delta.type === 'text_delta') yield { type: 'textDelta', text: event.delta.text };
        if (block?.type === 'thinking' && event.delta.type === 'thinking_delta') {
          block.thinking += event.delta.thinking;
        }
        if (block?.type === 'thinking' && event.delta.type === 'signature_delta') {
          block.signature = event.delta.signature;
        }
        if (block?.type === 'toolUse' && event.delta.type === 'input_json_delta') {
          block.args += event.delta.partial_json;
        }
        break;
      }
      case 'content_block_stop': {
        const block = blocks.get(event.index);
        blocks.delete(event.index);
        if (block) yield* endBlock(block, now);
        break;
      }
      case 'message_delta':
        usage = addDeltaUsage(usage, event.usage);
        stopReason = event.delta.stop_reason ?? stopReason;
        break;
      case 'message_stop':
        yield finishEvent(stopReason, usage);
        return;
    }
  }
  throw new Error('Anthropic stopped before the reply was finished');
}

/** Blocks other than these (server tools, which Mosaic doesn't offer) are passed over. */
function startBlock(
  block: Extract<RawMessageStreamEvent, { type: 'content_block_start' }>['content_block'],
  now: () => number
): BlockUnderWay | null {
  switch (block.type) {
    case 'text':
      return { type: 'text' };
    case 'thinking':
      return {
        type: 'thinking',
        startedAt: now(),
        thinking: block.thinking,
        signature: block.signature,
      };
    case 'redacted_thinking':
      return { type: 'redactedThinking', startedAt: now(), block };
    case 'tool_use':
      return { type: 'toolUse', callId: block.id, name: block.name, args: '' };
    default:
      return null;
  }
}

function* endBlock(block: BlockUnderWay, now: () => number): Generator<ModelStreamEvent> {
  switch (block.type) {
    case 'text':
      return;
    case 'thinking': {
      const providerState: ThinkingBlock = {
        type: 'thinking',
        thinking: block.thinking,
        signature: block.signature,
      };
      const text = block.thinking || undefined;
      yield { type: 'reasoningEnd', text, durationMs: now() - block.startedAt, providerState };
      return;
    }
    case 'redactedThinking':
      yield {
        type: 'reasoningEnd',
        durationMs: now() - block.startedAt,
        providerState: block.block,
      };
      return;
    case 'toolUse':
      // A call without arguments streams none; Anthropic means an empty object.
      yield {
        type: 'toolCall',
        callId: block.callId,
        name: block.name,
        args: parseToolArguments(block.args || '{}'),
      };
      return;
  }
}

/** `message_delta`'s counts are totals so far; a null one leaves the earlier count. */
function addDeltaUsage(usage: Usage | null, delta: MessageDeltaUsage): Usage | null {
  if (!usage) return null;
  return {
    ...usage,
    input_tokens: delta.input_tokens ?? usage.input_tokens,
    output_tokens: delta.output_tokens,
    cache_read_input_tokens: delta.cache_read_input_tokens ?? usage.cache_read_input_tokens,
    cache_creation_input_tokens:
      delta.cache_creation_input_tokens ?? usage.cache_creation_input_tokens,
  };
}

function finishEvent(stopReason: StopReason | null, usage: Usage | null): ModelStreamEvent {
  switch (stopReason) {
    case 'refusal':
      return { type: 'error', error: { reason: 'contentBlocked' } };
    case 'model_context_window_exceeded':
      return { type: 'error', error: { reason: 'context-too-long' } };
    case 'max_tokens':
      return { type: 'finish', reason: 'outputLimit', usage: readUsage(usage) };
    default:
      return { type: 'finish', reason: 'complete', usage: readUsage(usage) };
  }
}

/** Anthropic counts cached input apart from the rest; ours counts all input together. */
function readUsage(usage: Usage | null): ModelUsage | null {
  if (!usage) return null;
  const cachedInputTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  return {
    inputTokens: usage.input_tokens + cachedInputTokens + cacheWriteTokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens,
  };
}

/** The SDK's errors: the network, an error status, or an `error` event midway. */
function describeAnthropicError(error: unknown): ModelProviderError {
  if (error instanceof APIConnectionError) {
    const message = error.cause ? describeNetworkError(error.cause) : error.message;
    return { reason: 'unreachable', message };
  }
  if (error instanceof APIError) {
    return sortError({
      type: error.type,
      httpStatus: error.status,
      // Anthropic's own words; the SDK's message starts with the status.
      message: readBodyMessage(error.error) ?? error.message,
      headers: error.headers,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return { reason: 'failed', message };
}

/** Anthropic's body is `{ type: 'error', error: { type, message } }`. */
function readBodyMessage(body: unknown): string | undefined {
  const inner = isRecord(body) ? body.error : undefined;
  return isRecord(inner) && typeof inner.message === 'string' ? inner.message : undefined;
}

interface AnthropicErrorFacts {
  type: ErrorType | null;
  httpStatus?: number;
  message: string;
  headers?: Headers;
}

function sortError({
  type,
  httpStatus,
  message,
  headers,
}: AnthropicErrorFacts): ModelProviderError {
  const reason =
    type === 'invalid_request_error'
      ? REASON_BY_REQUEST_ERROR_WORDS.find(([words]) => words.test(message))?.[1]
      : type && REASON_BY_ERROR_TYPE[type];
  if (reason === 'rateLimited' && headers) {
    return { ...readRateLimit(headers), message, httpStatus };
  }
  if (reason) return { reason, message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}
