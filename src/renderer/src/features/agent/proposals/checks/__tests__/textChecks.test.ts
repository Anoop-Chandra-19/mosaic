import { describe, expect, it } from 'vitest';
import { checkClaimsMore } from '../claimsMore';
import { checkDoubledWords } from '../doubledWords';
import { checkNewNumbers } from '../newNumbers';
import { readNumbers } from '../readNumbers';
import { checkRemovedDetail } from '../removedDetail';
import { checkUnfilledGap } from '../unfilledGap';

describe('readNumbers', () => {
  it('reads words and digits as the same number, and thousands without commas', () => {
    expect(readNumbers('three services, 1,200 users, 4.5x faster')).toEqual(
      new Set(['3', '1200', '4.5'])
    );
  });

  it('leaves names with digits alone', () => {
    expect(readNumbers('Moved e2e tests to S3 on K8s')).toEqual(new Set());
  });
});

describe('checkDoubledWords', () => {
  it('flags a word twice where the edit joined new text to old', () => {
    expect(checkDoubledWords('Lowered costs by 20%', 'Reduced reduce costs by 20%')).toEqual([
      { kind: 'doubledWords', words: ['Reduced reduce'] },
    ]);
    expect(checkDoubledWords('Shipped the API', 'Shipped the the API')).toEqual([
      { kind: 'doubledWords', words: ['the the'] },
    ]);
  });

  it('leaves a double the user wrote', () => {
    expect(checkDoubledWords('Said that that mattered', 'Said that that mattered a lot')).toEqual(
      []
    );
  });
});

describe('checkClaimsMore', () => {
  it('flags a supporting role made a leading one', () => {
    expect(checkClaimsMore('Assisted in migrating billing', 'Led the billing migration')).toEqual([
      { kind: 'claimsMore', words: ['Assisted', 'Led'] },
    ]);
  });

  it('is quiet when the role stays the same', () => {
    expect(checkClaimsMore('Led the migration', 'Led the billing migration')).toEqual([]);
    expect(checkClaimsMore('Helped migrate billing', 'Helped move billing to Postgres')).toEqual(
      []
    );
  });
});

describe('checkNewNumbers', () => {
  it('flags numbers with no source, but not ones the user gave', () => {
    expect(checkNewNumbers('Cut build times', 'Cut build times by 40%', '')).toEqual([
      { kind: 'newNumbers', words: ['40'] },
    ]);
    expect(checkNewNumbers('Cut build times', 'Cut build times by 40%', 'it was 40%')).toEqual([]);
  });

  it('flags a number worked out from the text apart, to check', () => {
    expect(
      checkNewNumbers('Reduced errors from 18% to 3%', 'Cut errors by 83%, from 18% to 3%', '')
    ).toEqual([{ kind: 'calculatedNumbers', words: ['83'] }]);
  });
});

describe('checkRemovedDetail', () => {
  it('flags names, acronyms and numbers the rewrite dropped', () => {
    expect(
      checkRemovedDetail(
        'Built tile caching for the Oslo office on AWS, serving 3 regions',
        'Built tile caching that served users'
      )
    ).toEqual([{ kind: 'removedDetail', words: ['Oslo', 'AWS', '3'] }]);
  });

  it('ignores the first word and a change of case', () => {
    expect(checkRemovedDetail('Shipped with postgres', 'Delivered with Postgres')).toEqual([]);
  });
});

describe('checkUnfilledGap', () => {
  it('flags the gap mark until it is filled', () => {
    expect(checkUnfilledGap('', 'Cut costs by {{?}}%')).toEqual([
      { kind: 'unfilledGap', words: ['{{?}}'] },
    ]);
    expect(checkUnfilledGap('', 'Cut costs by 12%')).toEqual([]);
  });
});
