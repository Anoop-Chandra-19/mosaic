import { APIConnectionError, APIError } from 'openai';
import type {
  FunctionTool,
  Response as OpenAiResponse,
  ResponseCreateParamsStreaming,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseReasoningItem,
  ResponseStreamEvent,
  ResponseUsage,
} from 'openai/resources/responses/responses';
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
 * OpenAI, through its Responses API. Nothing is kept on OpenAI's side (`store: false`), so
 * each request sends the whole conversation. Reasoning comes back encrypted, is stored as
 * the reasoning part's `providerState`, and goes back unchanged, which keeps it across
 * tool calls.
 */

const OPENAI_URL = 'https://api.openai.com/v1';

export interface OpenAiProviderOptions {
  apiKey: string;
  /** Main passes Electron's `net.fetch`. */
  fetch: OpenAiFetch;
  now?: () => number;
}

type NamedReason = Exclude<ModelProviderError['reason'], 'failed'>;

/** Codes that say more than the status, in an error body or a reply that failed midway. */
const REASON_BY_CODE: Record<string, NamedReason | undefined> = {
  insufficient_quota: 'quotaExceeded',
  context_length_exceeded: 'context-too-long',
  rate_limit_exceeded: 'rateLimited',
  model_not_found: 'model-not-found',
};

const REASON_BY_STATUS: Record<number, NamedReason | undefined> = {
  401: 'keyRefused',
  403: 'keyRefused',
  404: 'model-not-found',
  429: 'rateLimited',
};

export function createOpenAiModelProvider({
  apiKey,
  fetch,
  now = () => performance.now(),
}: OpenAiProviderOptions): ModelProvider {
  const client = createOpenAiClient(apiKey, OPENAI_URL, fetch);
  return {
    async *streamReply(request) {
      try {
        const events = await client.responses.create(buildResponseBody(request), {
          signal: request.signal,
        });
        yield* readResponseEvents(events, now);
      } catch (error) {
        if (request.signal.aborted) return;
        yield { type: 'error', error: describeOpenAiError(error) };
      }
    },
  };
}

function buildResponseBody(request: ModelRequest): ResponseCreateParamsStreaming {
  return {
    model: request.model,
    instructions: request.system,
    input: request.messages.flatMap(toInputItems),
    tools: request.tools.map(toFunctionTool),
    stream: true,
    store: false,
    include: ['reasoning.encrypted_content'],
    prompt_cache_key: request.cacheKey,
  };
}

// Not strict: strict mode needs every property required, which the tools' schemas aren't.
// A call that doesn't fit its schema goes to the repair round.
function toFunctionTool(tool: ModelTool): FunctionTool {
  return {
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  };
}

function toInputItems(message: ModelMessage): ResponseInputItem[] {
  switch (message.role) {
    case 'user':
      return [{ role: 'user', content: message.text }];
    case 'assistant':
      return message.parts.flatMap(toAssistantItems);
    case 'toolResult':
      return [{ type: 'function_call_output', call_id: message.callId, output: message.content }];
  }
}

function toAssistantItems(part: ModelReplyPart): ResponseInputItem[] {
  switch (part.type) {
    case 'text':
      return [{ role: 'assistant', content: part.text }];
    case 'reasoning':
      return isOpenAiReasoning(part.providerState) ? [part.providerState] : [];
    case 'toolCall':
      return [
        {
          type: 'function_call',
          call_id: part.callId,
          name: part.name,
          arguments: typeof part.args === 'string' ? part.args : JSON.stringify(part.args),
        },
      ];
  }
}

/** Reasoning OpenAI sent; another provider's, in a conversation that switched, isn't sent. */
function isOpenAiReasoning(state: unknown): state is ResponseReasoningItem {
  return (
    isRecord(state) && state.type === 'reasoning' && typeof state.encrypted_content === 'string'
  );
}

async function* readResponseEvents(
  events: AsyncIterable<ResponseStreamEvent>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  let reasoningStartedAt = 0;
  for await (const event of events) {
    switch (event.type) {
      case 'response.output_text.delta':
      case 'response.refusal.delta':
        yield { type: 'textDelta', text: event.delta };
        break;
      case 'response.output_item.added':
        if (event.item.type === 'reasoning') {
          reasoningStartedAt = now();
          yield { type: 'reasoningStart' };
        }
        break;
      // Whole items, so a call's arguments arrive complete rather than in deltas.
      case 'response.output_item.done':
        if (event.item.type === 'reasoning') {
          const durationMs = now() - reasoningStartedAt;
          yield { type: 'reasoningEnd', durationMs, providerState: event.item };
        }
        if (event.item.type === 'function_call') yield toToolCall(event.item);
        break;
      case 'response.completed':
        yield { type: 'finish', reason: 'complete', usage: readUsage(event.response.usage) };
        return;
      case 'response.incomplete':
        yield readIncompleteResponse(event.response);
        return;
      case 'response.failed':
        yield { type: 'error', error: describeFailedResponse(event.response) };
        return;
    }
  }
  throw new Error('OpenAI stopped before the reply was finished');
}

function toToolCall(call: ResponseFunctionToolCall): ModelStreamEvent {
  return {
    type: 'toolCall',
    callId: call.call_id,
    name: call.name,
    args: parseToolArguments(call.arguments),
  };
}

function readUsage(usage: ResponseUsage | undefined): ModelUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
  };
}

function readIncompleteResponse(response: OpenAiResponse): ModelStreamEvent {
  const reason = response.incomplete_details?.reason;
  if (reason === 'content_filter') return { type: 'error', error: { reason: 'contentBlocked' } };
  return { type: 'finish', reason: 'outputLimit', usage: readUsage(response.usage) };
}

function describeFailedResponse(response: OpenAiResponse): ModelProviderError {
  const message = response.error?.message ?? 'OpenAI couldn’t finish the reply';
  return sortError({ code: response.error?.code, message });
}

/** The SDK's errors: the network, an error status, or an `error` event midway. */
function describeOpenAiError(error: unknown): ModelProviderError {
  if (error instanceof APIConnectionError) {
    const message = error.cause ? describeNetworkError(error.cause) : error.message;
    return { reason: 'unreachable', message };
  }
  if (error instanceof APIError) {
    return sortError({
      code: error.code,
      httpStatus: error.status,
      // OpenAI's own words; the SDK's message starts with the status.
      message: readBodyMessage(error.error) ?? error.message,
      headers: error.headers,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return { reason: 'failed', message };
}

function readBodyMessage(body: unknown): string | undefined {
  return isRecord(body) && typeof body.message === 'string' ? body.message : undefined;
}

interface OpenAiErrorFacts {
  code?: string | null;
  httpStatus?: number;
  message: string;
  headers?: Headers;
}

function sortError({ code, httpStatus, message, headers }: OpenAiErrorFacts): ModelProviderError {
  const reason =
    (code ? REASON_BY_CODE[code] : undefined) ??
    (httpStatus === undefined ? undefined : REASON_BY_STATUS[httpStatus]);
  if (reason === 'rateLimited' && headers) {
    return { ...readRateLimit(headers), message, httpStatus };
  }
  if (reason) return { reason, message, httpStatus };
  return { reason: 'failed', message, httpStatus };
}
