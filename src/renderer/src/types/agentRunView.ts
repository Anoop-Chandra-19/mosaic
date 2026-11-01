import type { RunModel, RunStoppedMessageBody, ToolTarget } from '@shared/types/agentConversation';

/**
 * A tool call's state: waiting for its result, done, refused by the tool, or never run.
 * `waiting` is only live: the model was writing it when the request failed, and a retry is coming.
 */
export type RunToolStatus = 'running' | 'waiting' | 'done' | 'refused' | 'notRun';

/**
 * One thing a run did, in order, as the pane shows it. The same shape comes from the
 * stored log (`buildRunView`) and live from the run's events (`runStore`).
 */
export type RunPart =
  | { type: 'text'; text: string }
  /** `durationMs` is null while the model is still thinking; `startedAt` is only known live. */
  | { type: 'reasoning'; durationMs: number | null; startedAt?: number }
  /**
   * `args` once the call is stored, since events carry the name only; `target` once it is
   * answered. `startedAt` is when the page heard of it until it is answered, then when it began;
   * absent on calls stored before steps were timed.
   */
  | {
      type: 'toolCall';
      callId: string;
      name: string;
      args?: unknown;
      status: RunToolStatus;
      target?: ToolTarget;
      startedAt?: number;
      /** Once it is answered; absent on calls stored before steps were timed. */
      durationMs?: number;
    };

/** One run of the transcript: what was asked, what the run did, and how it ended. */
export interface RunView {
  runId: number;
  /** Null for the live run until its first message is read. */
  model: RunModel | null;
  /** When its first message was stored, in ms since the epoch. */
  startedAt: number;
  /** When its last message was stored: how long it took, with `startedAt`. */
  lastAt: number;
  /** What the user sent; null for Send again, which carries on with no message. */
  ask: string | null;
  /** The resume the run moved to, when it was another one than the run before. */
  switchedTo: { templateId: string; label: string } | null;
  parts: RunPart[];
  /** Why it stopped before the model finished; null when it finished or is still going. */
  stop: RunStoppedMessageBody | null;
  stoppedAt: number | null;
}
