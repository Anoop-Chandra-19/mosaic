import type { ModelReplyPart, ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelTool } from '@shared/types/modelTool';

export interface UserMessage {
  role: 'user';
  text: string;
}

export interface AssistantMessage {
  role: 'assistant';
  parts: ModelReplyPart[];
}

export interface ToolResultMessage {
  role: 'toolResult';
  callId: string;
  toolName: string;
  content: string;
  isError?: boolean;
}

export type ModelMessage = UserMessage | AssistantMessage | ToolResultMessage;

export interface ModelRequest {
  model: string;
  system: string;
  messages: ModelMessage[];
  tools: ModelTool[];
  /**
   * The same for every request in a conversation: a provider that routes its prompt cache
   * by a key sends them to the same cache.
   */
  cacheKey: string;
  signal: AbortSignal;
  /** Called as each piece of the stream arrives (`noteArrivals.ts`), whatever it holds. */
  onArrival?: () => void;
}

export interface ModelProvider {
  /** Never throws: a failure arrives as the `error` event. */
  streamReply(request: ModelRequest): AsyncIterable<ModelStreamEvent>;
}
