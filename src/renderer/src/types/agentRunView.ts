import type { RunModel, RunStoppedMessageBody } from '@shared/types/agentConversation';

/** A tool call's state: waiting for its result, done, or refused by the tool. */
export type RunToolStatus = 'running' | 'done' | 'refused';

/**
 * One thing a run did, in order, as the pane shows it. The same shape comes from the
 * stored log (`buildRunView`) and live from the run's events (`runStore`).
 */
export type RunPart =
  | { type: 'text'; text: string }
  /** `durationMs` is null while the model is still thinking. */
  | { type: 'reasoning'; durationMs: number | null }
  /** `args` once the call is stored; events carry the name only. */
  | { type: 'toolCall'; callId: string; name: string; args?: unknown; status: RunToolStatus };

/** One run of the transcript: what was asked, what the run did, and how it ended. */
export interface RunView {
  runId: number;
  /** Null for the live run until its first message is read. */
  model: RunModel | null;
  /** When its first message was stored, in ms since the epoch. */
  startedAt: number;
  /** What the user sent; null for Send again, which carries on with no message. */
  ask: string | null;
  /** The resume the run moved to, when it was another one than the run before. */
  switchedTo: { templateId: string; label: string } | null;
  parts: RunPart[];
  /** Why it stopped before the model finished; null when it finished or is still going. */
  stop: RunStoppedMessageBody | null;
  stoppedAt: number | null;
}
