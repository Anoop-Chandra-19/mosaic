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
}

export interface LiveRun {
  conversationId: number;
  runId: number;
  startedAt: number;
  /** The step under way, from 1; 0 before the first. */
  step: number;
  parts: RunPart[];
  /** Where this step's parts begin, so a retry can drop what it streamed. */
  stepStart: number;
  retrying: RunRetry | null;
  hasEnded: boolean;
}

interface RunState {
  live: LiveRun | null;
  followRunEvent: (envelope: AgentRunEnvelope) => void;
  /** Once the transcript holds the run as stored. */
  dropLiveRun: (runId: number) => void;
  /** What each run left staged, by run id. */
  stagedIdsByRun: Record<number, string[]>;
  keepStagedIds: (runId: number, suggestionIds: string[]) => void;
}

const startLiveRun = ({ conversationId, runId }: AgentRunEnvelope): LiveRun => ({
  conversationId,
  runId,
  startedAt: Date.now(),
  step: 0,
  parts: [],
  stepStart: 0,
  retrying: null,
  hasEnded: false,
});

const findToolCall = (run: LiveRun, callId: string) =>
  run.parts.find((part) => part.type === 'toolCall' && part.callId === callId);

/**
 * Applies one event to the run, in place: the store's draft is `immer`'s. A retry lasts
 * until the request sent again says anything.
 */
function applyRunEvent(run: LiveRun, event: AgentRunEvent): void {
  const last = run.parts.length > run.stepStart ? run.parts.at(-1) : undefined;
  if (event.type !== 'stepRetrying') run.retrying = null;
  switch (event.type) {
    case 'stepStarted':
      run.step = event.step;
      run.stepStart = run.parts.length;
      return;
    case 'stepRetrying':
      run.parts.splice(run.stepStart);
      run.retrying = {
        attempt: event.attempt,
        waitMs: event.waitMs,
        error: event.error,
        since: Date.now(),
      };
      return;
    case 'textDelta':
      if (last?.type === 'text') last.text += event.text;
      else run.parts.push({ type: 'text', text: event.text });
      return;
    case 'reasoningStart':
      run.parts.push({ type: 'reasoning', durationMs: null });
      return;
    case 'reasoningEnd':
      if (last?.type === 'reasoning') last.durationMs = event.durationMs;
      return;
    case 'toolCall':
      run.parts.push({
        type: 'toolCall',
        callId: event.callId,
        name: event.name,
        status: 'running',
      });
      return;
    case 'toolResult': {
      const call = findToolCall(run, event.callId);
      if (call?.type === 'toolCall') call.status = event.isError ? 'refused' : 'done';
      return;
    }
    case 'runEnded':
      run.hasEnded = true;
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
  }))
);
