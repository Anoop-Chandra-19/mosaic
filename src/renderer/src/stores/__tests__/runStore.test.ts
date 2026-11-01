import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRunEvent } from '@shared/types/agentRunEvents';
import { useRunStore } from '../runStore';

beforeEach(() => useRunStore.setState({ live: null, stagedIdsByRun: {} }));

function follow(runId: number, events: AgentRunEvent[]): void {
  events.forEach((event, i) =>
    useRunStore.getState().followRunEvent({ conversationId: 1, runId, seq: i + 1, event })
  );
}

describe('the live run', () => {
  it('builds the run’s parts from its events', () => {
    follow(4, [
      { type: 'stepStarted', step: 1 },
      { type: 'reasoningStart' },
      { type: 'reasoningEnd', durationMs: 3400 },
      { type: 'textDelta', text: 'Reading ' },
      { type: 'textDelta', text: 'it first.' },
      { type: 'toolCall', callId: 'c1', name: 'read_document' },
      { type: 'toolCall', callId: 'c2', name: 'propose_rewrite' },
      { type: 'toolResult', callId: 'c1', isError: false },
      { type: 'toolResult', callId: 'c2', isError: true },
      { type: 'stepStarted', step: 2 },
      { type: 'reasoningStart' },
    ]);

    expect(useRunStore.getState().live).toMatchObject({
      runId: 4,
      step: 2,
      hasEnded: false,
      parts: [
        { type: 'reasoning', durationMs: 3400 },
        { type: 'text', text: 'Reading it first.' },
        { type: 'toolCall', callId: 'c1', name: 'read_document', status: 'done' },
        { type: 'toolCall', callId: 'c2', name: 'propose_rewrite', status: 'refused' },
        { type: 'reasoning', durationMs: null },
      ],
    });
  });

  it('keeps one row for a call told of as it begins and again once whole', () => {
    const begun = { type: 'toolCall', callId: 'c1', name: 'read_document' } as const;
    follow(4, [{ type: 'stepStarted', step: 1 }, begun, begun]);
    expect(useRunStore.getState().live?.parts).toHaveLength(1);
  });

  it('drops what a step streamed when it is retried, until the request says anything', () => {
    const error = { reason: 'unreachable' } as const;
    follow(4, [
      { type: 'stepStarted', step: 1 },
      { type: 'textDelta', text: 'Kept.' },
      { type: 'stepStarted', step: 2 },
      { type: 'textDelta', text: 'Cut off' },
      { type: 'stepRetrying', attempt: 1, waitMs: 1000, error },
    ]);
    expect(useRunStore.getState().live).toMatchObject({
      parts: [{ type: 'text', text: 'Kept.' }],
      retrying: { attempt: 1, waitMs: 1000, error },
    });

    follow(4, [{ type: 'textDelta', text: 'Again.' }]);
    expect(useRunStore.getState().live).toMatchObject({
      parts: [
        { type: 'text', text: 'Kept.' },
        { type: 'text', text: 'Again.' },
      ],
      retrying: null,
    });
  });

  it('keeps a call cut off mid-step waiting in place, until the retry says anything', () => {
    const error = { reason: 'unreachable' } as const;
    const call = { type: 'toolCall', callId: 'c1', name: 'propose_rewrite' } as const;
    follow(4, [
      { type: 'stepStarted', step: 1 },
      { type: 'textDelta', text: 'Rewriting.' },
      call,
      { type: 'stepRetrying', attempt: 1, waitMs: 1000, error },
    ]);
    const waiting = { type: 'toolCall', callId: 'c1', status: 'waiting' };
    expect(useRunStore.getState().live).toMatchObject({
      parts: [waiting],
      retrying: { newestCall: waiting },
    });

    follow(4, [{ type: 'stepRetrying', attempt: 2, waitMs: 4000, error }]);
    expect(useRunStore.getState().live?.parts).toMatchObject([waiting]);

    follow(4, [{ type: 'toolCall', callId: 'c2', name: 'propose_rewrite' }]);
    expect(useRunStore.getState().live?.parts).toMatchObject([{ callId: 'c2', status: 'running' }]);
  });

  it('drops a call still waiting when the run ends instead', () => {
    follow(4, [
      { type: 'stepStarted', step: 1 },
      { type: 'toolCall', callId: 'c1', name: 'propose_rewrite' },
      { type: 'stepRetrying', attempt: 1, waitMs: 1000, error: { reason: 'unreachable' } },
      { type: 'runEnded', stopReason: 'cancelled' },
    ]);
    expect(useRunStore.getState().live).toMatchObject({ parts: [], retrying: null });
  });

  it('notes when the run last said anything, which a wait for the model counts from', () => {
    vi.useFakeTimers({ now: 1000 });
    follow(4, [{ type: 'stepStarted', step: 1 }]);
    vi.setSystemTime(5000);
    follow(4, [{ type: 'toolResult', callId: 'c1', isError: false }]);
    expect(useRunStore.getState().live).toMatchObject({ startedAt: 1000, lastEventAt: 5000 });
    vi.useRealTimers();
  });

  it('starts again for the next run', () => {
    follow(4, [{ type: 'textDelta', text: 'First run.' }, { type: 'runEnded' }]);
    expect(useRunStore.getState().live?.hasEnded).toBe(true);

    follow(5, [{ type: 'stepStarted', step: 1 }]);
    expect(useRunStore.getState().live).toMatchObject({ runId: 5, parts: [], hasEnded: false });
  });
});
