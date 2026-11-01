import { describe, expect, it } from 'vitest';
import type { RunPart, RunStepRequest } from '@/types/agentRunView';
import { listRunTimeline } from '../../run-view/runTimeline';
import { countFlaggedSteps } from '../traceFlags';

type Call = Extract<RunPart, { type: 'toolCall' }>;

const step = (callId: string, status: Call['status'], extra: Partial<Call> = {}): RunPart => ({
  type: 'toolCall',
  callId,
  name: 'read_document',
  status,
  ...extra,
});

const FINISHED = { isRunning: false, isStopped: false, isCancelled: false };

const count = (parts: RunPart[], outcomes?: Parameters<typeof countFlaggedSteps>[1]) =>
  countFlaggedSteps(listRunTimeline(parts, FINISHED), outcomes);

const RETRIED: RunStepRequest = {
  retries: [{ error: { reason: 'rateLimited' }, waitMs: 500 }],
  callCount: 1,
};

describe('what the Trace flags', () => {
  it('leaves a plain step, thinking and words alone', () => {
    const parts: RunPart[] = [
      { type: 'reasoning', durationMs: 900 },
      step('c1', 'done'),
      { type: 'text', text: 'Done.' },
    ];
    expect(count(parts)).toBe(0);
  });

  it('counts a refused step, one never run, and one that took more than one try', () => {
    expect(count([step('c1', 'refused')])).toBe(1);
    expect(count([step('c1', 'notRun')])).toBe(1);
    expect(count([step('c1', 'done', { request: RETRIED })])).toBe(1);
  });

  it('counts a read that no longer holds, across the run’s lines', () => {
    const parts: RunPart[] = [
      step('c1', 'done'),
      { type: 'text', text: 'Looking.' },
      step('c2', 'done'),
    ];
    expect(count(parts, { c1: 'edited', c2: 'askedAgain' })).toBe(2);
  });
});
