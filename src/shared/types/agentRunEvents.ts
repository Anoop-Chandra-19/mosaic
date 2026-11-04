import type { RunStopReason, ToolTarget } from './agentConversation';
import type { ModelProviderError } from './modelReply';

/**
 * Live run events for subscribers such as the pane and evals. The stored log is
 * authoritative; events update subscribers between stored messages.
 */
export type AgentRunEvent =
  | { type: 'stepStarted'; step: number }
  /**
   * The request failed with `error` and will be retried after `waitMs`; discard this step's
   * streamed output. `attempt` counts retries from 1.
   */
  | { type: 'stepRetrying'; attempt: number; waitMs: number; error: ModelProviderError }
  | { type: 'textDelta'; text: string }
  | { type: 'reasoningStart' }
  | { type: 'reasoningEnd'; durationMs: number }
  /**
   * Emitted once when the tool call starts, if the provider reports it, and again when the
   * call is complete with `args`.
   */
  | { type: 'toolCall'; callId: string; name: string; args?: unknown }
  | {
      type: 'toolResult';
      callId: string;
      isError: boolean;
      target?: ToolTarget;
      durationMs?: number;
      startedAt?: number;
    }
  /** `stopReason` is absent when the model finished. */
  | { type: 'runEnded'; stopReason?: RunStopReason };
