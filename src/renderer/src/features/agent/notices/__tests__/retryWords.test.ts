import { describe, expect, it } from 'vitest';
import type { RunRetry } from '@/stores/runStore';
import { describeRetry, formatRetryCountdown, readSecondsLeft } from '../retryWords';

const ADDRESSES = { ollama: 'http://localhost:11434', openaiCompatible: 'http://127.0.0.1:8080' };
const ANTHROPIC = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
const COMPATIBLE = { provider: 'openaiCompatible', model: 'local-model' };

const LOST: RunRetry = {
  attempt: 2,
  waitMs: 4000,
  since: 10_000,
  error: { reason: 'failed', httpStatus: 503, message: 'Internal server error' },
  newestCall: null,
};
const SLOW: RunRetry = {
  ...LOST,
  error: { reason: 'rateLimited', httpStatus: 429, message: 'Slow down' },
};

const call = (status: 'waiting' | 'done' | 'refused') =>
  ({ type: 'toolCall', callId: 'c1', name: 'propose_merge', status }) as const;

describe('describeRetry', () => {
  it('tells a dropped connection from a request to slow down', () => {
    expect(describeRetry(LOST, ANTHROPIC, ADDRESSES)).toMatchObject({
      tag: 'Retrying',
      sentence: 'Lost the connection to Anthropic.',
    });
    expect(describeRetry(SLOW, ANTHROPIC, ADDRESSES)).toMatchObject({
      tag: 'Waiting',
      sentence: 'Anthropic asked us to slow down.',
    });
  });

  it('calls a server the user runs "the server", wherever the sentence puts it', () => {
    expect(describeRetry(LOST, COMPATIBLE, ADDRESSES).sentence).toBe(
      'Lost the connection to the server.'
    );
    expect(describeRetry(SLOW, COMPATIBLE, ADDRESSES).sentence).toBe(
      'The server asked us to slow down.'
    );
  });

  it('quotes the provider, or your computer when the request never got there', () => {
    expect(describeRetry(LOST, ANTHROPIC, ADDRESSES).quoted).toEqual({
      label: 'Anthropic said',
      code: '503',
      text: 'Internal server error',
    });
    const unreachable: RunRetry = {
      ...LOST,
      error: { reason: 'unreachable', message: 'ECONNRESET' },
    };
    expect(describeRetry(unreachable, ANTHROPIC, ADDRESSES).quoted?.label).toBe(
      'Your computer said'
    );
  });

  it.each([
    ['nothing to say about a step', LOST, null],
    [
      'a step cut off as it was written',
      { ...LOST, newestCall: call('waiting') },
      'The step it was writing isn’t made yet. It starts that step again.',
    ],
    [
      'a finished step behind a lost connection',
      { ...LOST, newestCall: call('done') },
      'Joined two bullets is done and kept. It isn’t run again.',
    ],
    [
      'a finished step behind a rate limit',
      { ...SLOW, newestCall: call('done') },
      'Joined two bullets is done and kept.',
    ],
    ['a refused step, which kept nothing', { ...LOST, newestCall: call('refused') }, null],
  ])('notes %s', (_name, retry, note) => {
    expect(describeRetry(retry, ANTHROPIC, ADDRESSES).note).toBe(note);
  });
});

describe('the countdown', () => {
  it('rounds up, and counts a lost connection’s tries but not a rate limit’s', () => {
    expect(formatRetryCountdown(LOST, readSecondsLeft(LOST, 10_500))).toBe(
      'Trying again in 4 s (2 of 3).'
    );
    expect(formatRetryCountdown(SLOW, readSecondsLeft(SLOW, 13_500))).toBe('Trying again in 1 s.');
  });

  it('says now once the wait is over and the request is on its way', () => {
    expect(formatRetryCountdown(LOST, readSecondsLeft(LOST, 14_000))).toBe(
      'Trying again now (2 of 3).'
    );
    expect(formatRetryCountdown(SLOW, readSecondsLeft(SLOW, 20_000))).toBe('Trying again now.');
  });
});
