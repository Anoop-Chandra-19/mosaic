import { describe, expect, it } from 'vitest';
import { breakLinesLikeWord, breakRunsLikeWord } from '../breakLinesLikeWord';

// Every character a point wide, spaces included.
const measure = (text: string) => text.length;

describe('breakLinesLikeWord', () => {
  it('fills each line with whole words before starting the next', () => {
    expect(breakLinesLikeWord('Built the fare service with a queue', 14, measure)).toBe(
      'Built the fare\nservice with a\nqueue'
    );
  });

  it('lets a line end exactly at the width, and never counts the space after it', () => {
    expect(breakLinesLikeWord('abcd efgh ij', 9, measure)).toBe('abcd efgh\nij');
  });

  it('keeps a word longer than the line on a line of its own', () => {
    expect(breakLinesLikeWord('a reconciliation b', 5, measure)).toBe('a\nreconciliation\nb');
  });

  it('breaks after a hyphen inside a word, but not before a number', () => {
    expect(breakLinesLikeWord('ran the on-call rota', 10, measure)).toBe('ran the\non-call\nrota');
    expect(breakLinesLikeWord('ran the on-call rota', 12, measure)).toBe('ran the on-\ncall rota');
    expect(breakLinesLikeWord('fixed COVID-19 apps', 12, measure)).toBe('fixed\nCOVID-19\napps');
  });

  it('keeps line breaks already in the text and runs of spaces', () => {
    expect(breakLinesLikeWord('one  two\nthree four', 20, measure)).toBe('one  two\nthree four');
  });
});

describe('breakRunsLikeWord', () => {
  const header = [
    { text: '555-0100', href: 'tel:5550100' },
    { text: ' | ', href: undefined },
    { text: 'linkedin.com/in/someone', href: 'https://linkedin.com/in/someone' },
    { text: ' | ', href: undefined },
    { text: 'Leeds, UK', href: undefined },
  ];
  const shape = (runs: ReturnType<typeof breakRunsLikeWord<(typeof header)[number]>>) =>
    runs.map((run) => `${run.startsLine ? '⏎' : ''}${run.text}`);

  it('leaves a line that fits as it is', () => {
    expect(shape(breakRunsLikeWord(header, 60, measure))).toEqual([
      '555-0100',
      ' | ',
      'linkedin.com/in/someone',
      ' | ',
      'Leeds, UK',
    ]);
  });

  it('starts a new line at an item, dropping the space before it', () => {
    expect(shape(breakRunsLikeWord(header, 40, measure))).toEqual([
      '555-0100',
      ' | ',
      'linkedin.com/in/someone',
      ' |',
      '⏎Leeds, UK',
    ]);
  });

  it('cuts inside an item where it must, each piece keeping the link', () => {
    const site = [{ text: 'Work: portfolio site', href: 'https://example.com' }];
    expect(breakRunsLikeWord(site, 10, measure)).toEqual([
      { text: 'Work:', href: 'https://example.com', startsLine: false },
      { text: 'portfolio', href: 'https://example.com', startsLine: true },
      { text: 'site', href: 'https://example.com', startsLine: true },
    ]);
  });
});
