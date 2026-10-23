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
  signal: AbortSignal;
}

export interface ModelProvider {
  /** Never throws: a failure arrives as the `error` event. */
  streamReply(request: ModelRequest): AsyncIterable<ModelStreamEvent>;
}
