import type { RunStopReason, ToolTarget } from './agentConversation';
import type { ModelProviderError } from './modelReply';

/**
 * What a run says as it goes, for whatever follows it live (the pane, the eval). The log
 * is the truth; these only let a view keep up between the messages it stores.
 */
export type AgentRunEvent =
  | { type: 'stepStarted'; step: number }
  /**
   * The request failed with `error` and is sent again after `waitMs`; drop what this step
   * streamed. `attempt` counts the retries, from 1.
   */
  | { type: 'stepRetrying'; attempt: number; waitMs: number; error: ModelProviderError }
  | { type: 'textDelta'; text: string }
  | { type: 'reasoningStart' }
  | { type: 'reasoningEnd'; durationMs: number }
  | { type: 'toolCall'; callId: string; name: string }
  | { type: 'toolResult'; callId: string; isError: boolean; target?: ToolTarget }
  /** `stopReason` is absent when the model finished. */
  | { type: 'runEnded'; stopReason?: RunStopReason };
