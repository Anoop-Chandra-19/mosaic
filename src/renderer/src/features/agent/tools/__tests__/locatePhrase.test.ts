import { describe, expect, it } from 'vitest';
import { locateEveryWholeWord, locatePhrase } from '../locatePhrase';

describe('locatePhrase', () => {
  it('finds a phrase once, exactly or loosely, and says when it is missing or repeated', () => {
    expect(locatePhrase('Led the move to Postgres', 'Postgres')).toEqual({
      start: 16,
      end: 24,
      isLoose: false,
    });
    expect(locatePhrase('Wrote the “on-call” guide', 'the "on-call"')).toMatchObject({
      isLoose: true,
    });
    expect(locatePhrase('Wrote the guide', 'runbook')).toBe('none');
    expect(locatePhrase('Cut AWS costs by leaving AWS', 'AWS')).toBe('many');
  });
});

describe('locateEveryWholeWord', () => {
  const starts = (text: string, find: string) =>
    locateEveryWholeWord(text, find).map(({ start }) => start);

  it('finds every use of a term, and none inside a longer word', () => {
    expect(starts('Cut AWS costs by leaving AWS', 'AWS')).toEqual([4, 25]);
    expect(starts('Moved search from Google Cloud', 'Go')).toEqual([]);
    expect(starts('Wrote JSON schemas', 'JS')).toEqual([]);
    expect(starts('Upgraded PostgreSQL', 'Postgres')).toEqual([]);
    expect(starts('Go services, not Google', 'Go')).toEqual([0]);
    expect(starts('Moved C++ code to Rust', 'C++')).toEqual([6]);
  });

  it('falls back to loose matches only when there is no exact one', () => {
    expect(locateEveryWholeWord('Wrote the “on-call” guide', '"on-call"')).toEqual([
      { start: 10, end: 19, isLoose: true },
    ]);
  });
});
