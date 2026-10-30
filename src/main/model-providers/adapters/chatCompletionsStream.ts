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
import { describeNetworkError } from '../describeNetworkError';
import type { ModelMessage, ModelRequest } from '../modelProvider';
import { parseToolArguments } from '../parseToolArguments';

/*
 * OpenAI's Chat Completions, streamed through the `openai` SDK, for the adapters that
 * speak it (OpenRouter's, and OpenAI-compatible servers'). The request body from our messages and tools; the stream's
 * chunks as our events, with calls assembled by index and usage from the last chunk; and
 * the SDK's errors. What a server adds (how it sends reasoning, its own request fields,
 * how it sorts an error status) comes from its adapter.
 */

export type ChatDelta = ChatCompletionChunk.Choice.Delta;

/**
 * How a server sends reasoning in a stream, and what of it goes back with the reply.
 * `Piece` is whatever it sends beside the text (OpenRouter's reasoning details).
 */
export interface ReasoningDialect<Piece> {
  /** This delta's reasoning; null when it has none. */
  read(delta: ChatDelta): { text: string; pieces: Piece[] } | null;
  /** Adds a piece to those so far. */
  addPiece(pieces: Piece[], piece: Piece): void;
  /** What the stored reasoning part keeps to send back; undefined when nothing goes back. */
  toProviderState(pieces: Piece[]): unknown;
}

export interface ChatStreamDialect<Piece> {
  /** For the error when a stream ends before its finish reason. */
  serverName: string;
  reasoning: ReasoningDialect<Piece>;
}

/** Fields a server takes on an assistant message beyond Chat Completions', from the reply. */
export type ExtendAssistantMessage = (
  message: ChatCompletionAssistantMessageParam,
  parts: ModelReplyPart[]
) => ChatCompletionAssistantMessageParam;

export function buildChatCompletionsBody(
  request: ModelRequest,
  extendAssistantMessage: ExtendAssistantMessage = (message) => message
): ChatCompletionCreateParamsStreaming {
  return {
    model: request.model,
    messages: [
      { role: 'system', content: request.system },
      ...request.messages.map((message) => toChatMessage(message, extendAssistantMessage)),
    ],
    tools: request.tools.map(toFunctionTool),
    stream: true,
  };
}

function toFunctionTool(tool: ModelTool): ChatCompletionTool {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  };
}

function toChatMessage(
  message: ModelMessage,
  extendAssistantMessage: ExtendAssistantMessage
): ChatCompletionMessageParam {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text };
    case 'assistant':
      return extendAssistantMessage(toAssistantMessage(message.parts), message.parts);
    case 'toolResult':
      return { role: 'tool', tool_call_id: message.callId, content: message.content };
  }
}

/** A reply's parts as one message: its text and its calls. */
function toAssistantMessage(parts: ModelReplyPart[]): ChatCompletionAssistantMessageParam {
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
  const toolCalls = parts.flatMap((part) => (part.type === 'toolCall' ? [toToolCall(part)] : []));
  const message: ChatCompletionAssistantMessageParam = { role: 'assistant', content: text };
  if (toolCalls.length > 0) {
    // Calls alone have no content, rather than an empty one some providers refuse.
    message.content = text || null;
    message.tool_calls = toolCalls;
  }
  return message;
}

function toToolCall(
  part: Extract<ModelReplyPart, { type: 'toolCall' }>
): ChatCompletionMessageToolCall {
  const args = typeof part.args === 'string' ? part.args : JSON.stringify(part.args);
  return { id: part.callId, type: 'function', function: { name: part.name, arguments: args } };
}

/** Reasoning under way: from its first piece until the reply moves on to text or a call. */
interface ReasoningUnderWay<Piece> {
  startedAt: number;
  text: string;
  pieces: Piece[];
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
export async function* readChatCompletionsStream<Piece>(
  chunks: AsyncIterable<ChatCompletionChunk>,
  dialect: ChatStreamDialect<Piece>,
  now: () => number
): AsyncGenerator<ModelStreamEvent> {
  let reasoning: ReasoningUnderWay<Piece> | null = null;
  const calls = new Map<number, CallUnderWay>();
  let finishReason: string | null = null;
  let usage: CompletionUsage | undefined;
  for await (const chunk of chunks) {
    usage = chunk.usage ?? usage;
    const choice = chunk.choices[0];
    if (!choice) continue;
    const { delta } = choice;
    const reasoningPiece = dialect.reasoning.read(delta);
    if (reasoningPiece) {
      if (!reasoning) {
        reasoning = { startedAt: now(), text: '', pieces: [] };
        yield { type: 'reasoningStart' };
      }
      reasoning.text += reasoningPiece.text;
      for (const piece of reasoningPiece.pieces)
        dialect.reasoning.addPiece(reasoning.pieces, piece);
    } else if (reasoning && (delta.content || delta.tool_calls)) {
      yield endReasoning(reasoning, dialect.reasoning, now);
      reasoning = null;
    }
    if (delta.content) yield { type: 'textDelta', text: delta.content };
    for (const piece of delta.tool_calls ?? []) addCallPiece(calls, piece);
    finishReason = choice.finish_reason ?? finishReason;
  }
  if (reasoning) yield endReasoning(reasoning, dialect.reasoning, now);
  if (!finishReason) throw new Error(`${dialect.serverName} stopped before the reply was finished`);
  for (const index of [...calls.keys()].sort((a, b) => a - b)) {
    const { callId, name, args } = calls.get(index)!;
    yield { type: 'toolCall', callId, name, args: parseToolArguments(args) };
  }
  yield finishEvent(finishReason, usage);
}

function endReasoning<Piece>(
  reasoning: ReasoningUnderWay<Piece>,
  dialect: ReasoningDialect<Piece>,
  now: () => number
): ModelStreamEvent {
  return {
    type: 'reasoningEnd',
    text: reasoning.text || undefined,
    durationMs: now() - reasoning.startedAt,
    providerState: dialect.toProviderState(reasoning.pieces),
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

/** An error status, with the error body the server sent beside it (`{}` when none). */
export type SortApiError = (error: APIError, body: Record<string, unknown>) => ModelProviderError;

/** The SDK's errors: the network, an error status (sorted by the server's adapter), or anything else. */
export function describeChatCompletionsError(
  error: unknown,
  sortApiError: SortApiError
): ModelProviderError {
  if (error instanceof APIConnectionError) {
    const message = error.cause ? describeNetworkError(error.cause) : error.message;
    return { reason: 'unreachable', message };
  }
  if (error instanceof APIError)
    return sortApiError(error, isRecord(error.error) ? error.error : {});
  const message = error instanceof Error ? error.message : String(error);
  return { reason: 'failed', message };
}
