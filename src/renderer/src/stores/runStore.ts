import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AgentRunEnvelope } from '@shared/types/agentBridge';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import type { ModelProviderError } from '@shared/types/modelReply';
import type { RunPart } from '@/types/agentRunView';

/*
 * The run under way, as its events tell it, kept apart from `conversationStore` so
 * streaming never re-renders the transcript. When the run ends and the stored log has it,
 * the live copy is dropped. Also each run's staged suggestions, in memory until the
 * agent's tables keep them.
 */

export interface RunRetry {
  /** The retries so far, from 1. */
  attempt: number;
  waitMs: number;
  error: ModelProviderError;
  /** When the wait began, in ms since the epoch. */
  since: number;
  /** The call the run got to, when a call is the last thing it did. */
  newestCall: Extract<RunPart, { type: 'toolCall' }> | null;
}

export interface LiveRun {
  conversationId: number;
  runId: number;
  startedAt: number;
  /** When it last said anything: how long a wait for the model has gone on. */
  lastEventAt: number;
  /** The step under way, from 1; 0 before the first. */
  step: number;
  parts: RunPart[];
  /** Where this step's parts begin, so a retry can drop what it streamed. */
  stepStart: number;
  retrying: RunRetry | null;
  hasEnded: boolean;
  /** When it ended, and whether anything stopped it before the model finished. */
  endedAt: number | null;
  wasStopped: boolean;
  /** The user's Stop, rather than anything else that ended it early. */
  wasCancelled: boolean;
}

interface RunState {
  live: LiveRun | null;
  followRunEvent: (envelope: AgentRunEnvelope) => void;
  /** Once the transcript holds the run as stored. */
  dropLiveRun: (runId: number) => void;
  /** What each run left staged, by run id. */
  stagedIdsByRun: Record<number, string[]>;
  keepStagedIds: (runId: number, suggestionIds: string[]) => void;
  /** Runs the user stopped and has said what to do with what they staged. */
  decidedStopRunIds: number[];
  noteStopDecided: (runId: number) => void;
}

const startLiveRun = ({ conversationId, runId }: AgentRunEnvelope): LiveRun => ({
  conversationId,
  runId,
  startedAt: Date.now(),
  lastEventAt: Date.now(),
  step: 0,
  parts: [],
  stepStart: 0,
  retrying: null,
  hasEnded: false,
  endedAt: null,
  wasStopped: false,
  wasCancelled: false,
});

const findToolCall = (run: LiveRun, callId: string) =>
  run.parts.find((part) => part.type === 'toolCall' && part.callId === callId);

/**
 * What the step streamed goes, since the retry writes it again. Its calls were never run, so
 * their rows wait in place until the retry answers.
 */
function holdStepForRetry(run: LiveRun): void {
  const calls = run.parts.splice(run.stepStart).filter((part) => part.type === 'toolCall');
  for (const call of calls) call.status = 'waiting';
  run.parts.push(...calls);
}

/** A retry lasts until the request sent again says anything, or the run ends. */
function endRetry(run: LiveRun): void {
  if (run.retrying) run.parts.splice(run.stepStart);
  run.retrying = null;
}

/** Applies one event to the run, in place: the store's draft is `immer`'s. */
function applyRunEvent(run: LiveRun, event: AgentRunEvent): void {
  if (event.type !== 'stepRetrying') endRetry(run);
  const last = run.parts.length > run.stepStart ? run.parts.at(-1) : undefined;
  run.lastEventAt = Date.now();
  switch (event.type) {
    case 'stepStarted':
      run.step = event.step;
      run.stepStart = run.parts.length;
      return;
    case 'stepRetrying': {
      holdStepForRetry(run);
      const newest = run.parts.at(-1);
      run.retrying = {
        attempt: event.attempt,
        waitMs: event.waitMs,
        error: event.error,
        since: Date.now(),
        newestCall: newest?.type === 'toolCall' ? newest : null,
      };
      return;
    }
    case 'textDelta':
      if (last?.type === 'text') last.text += event.text;
      else run.parts.push({ type: 'text', text: event.text });
      return;
    case 'reasoningStart':
      run.parts.push({ type: 'reasoning', durationMs: null, startedAt: Date.now() });
      return;
    case 'reasoningEnd':
      if (last?.type === 'reasoning') last.durationMs = event.durationMs;
      return;
    case 'toolCall':
      if (findToolCall(run, event.callId)) return;
      run.parts.push({
        type: 'toolCall',
        callId: event.callId,
        name: event.name,
        status: 'running',
        startedAt: Date.now(),
      });
      return;
    case 'toolResult': {
      const call = findToolCall(run, event.callId);
      if (call?.type !== 'toolCall') return;
      call.status = event.isError ? 'refused' : 'done';
      if (event.target) call.target = event.target;
      if (event.durationMs !== undefined) call.durationMs = event.durationMs;
      if (event.startedAt !== undefined) call.startedAt = event.startedAt;
      return;
    }
    case 'runEnded':
      run.hasEnded = true;
      run.endedAt = Date.now();
      run.wasStopped = event.stopReason !== undefined;
      run.wasCancelled = event.stopReason === 'cancelled';
  }
}

export const useRunStore = create<RunState>()(
  immer((set) => ({
    live: null,

    followRunEvent: (envelope) =>
      set((state) => {
        if (state.live?.runId !== envelope.runId) state.live = startLiveRun(envelope);
        applyRunEvent(state.live, envelope.event);
      }),

    dropLiveRun: (runId) =>
      set((state) => {
        if (state.live?.runId === runId) state.live = null;
      }),

    stagedIdsByRun: {},

    keepStagedIds: (runId, suggestionIds) =>
      set((state) => {
        state.stagedIdsByRun[runId] = suggestionIds;
      }),

    decidedStopRunIds: [],

    noteStopDecided: (runId) =>
      set((state) => {
        if (!state.decidedStopRunIds.includes(runId)) state.decidedStopRunIds.push(runId);
      }),
  }))
);
