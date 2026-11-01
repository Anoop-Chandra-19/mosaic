import { describe, expect, it } from 'vitest';
import {
  describeCheck,
  describeRetry,
  formatSharedTokens,
  formatThinkingLength,
  formatTokens,
  formatToolAnswer,
  formatToolArguments,
  formatTraceTime,
} from '../traceWords';

describe('traceWords', () => {
  it('keeps a time’s precision', () => {
    expect(formatTraceTime(340)).toBe('340 ms');
    expect(formatTraceTime(1420)).toBe('1.42 s');
  });

  it('says tokens whole, what the cache served, and who shares them', () => {
    const usage = { inputTokens: 1204, outputTokens: 80 };
    expect(formatTokens(usage)).toBe('1,204 in · 80 out');
    expect(formatTokens({ ...usage, cachedInputTokens: 1000 })).toBe(
      '1,204 in (1,000 cached) · 80 out'
    );
    expect(formatSharedTokens(usage, 1)).toBe('1,204 in · 80 out');
    expect(formatSharedTokens(usage, 3)).toBe('1,204 in · 80 out, shared by 3 calls');
    expect(formatThinkingLength(1234)).toBe('1,234 characters · stored, not shown');
  });

  it('words a failed request with what the provider said', () => {
    const slow = { reason: 'rateLimited', httpStatus: 429, message: 'Slow down.' } as const;
    expect(describeRetry({ error: slow, waitMs: 2000 })).toBe(
      'Asked to slow down · 429 · Slow down. · waited 2.00 s'
    );
    expect(describeRetry({ error: { reason: 'unreachable' }, waitMs: 500 })).toBe(
      'Lost the connection · waited 500 ms'
    );
  });

  it('explains a check it knows, and says nothing of one it doesn’t', () => {
    expect(describeCheck('timeout')).toMatch(/didn’t answer in time/);
    expect(describeCheck('toString')).toBeNull();
    expect(describeCheck(undefined)).toBeNull();
  });

  it('sets out JSON, and leaves anything else as it came', () => {
    expect(formatToolArguments({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatToolArguments('{"broken')).toBe('{"broken');
    expect(formatToolAnswer('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatToolAnswer('No such bullet.')).toBe('No such bullet.');
  });
});
