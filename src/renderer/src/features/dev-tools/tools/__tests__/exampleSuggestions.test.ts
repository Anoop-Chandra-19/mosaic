import { describe, expect, it } from 'vitest';
import { checkProposal } from '@/features/agent/proposals/checkProposal';
import { validateProposal } from '@/features/agent/proposals/validateProposal';
import { createExampleResume } from '../exampleResume';
import { createExampleSuggestions, EXAMPLE_REQUEST } from '../exampleSuggestions';

const EXAMPLE_SUGGESTIONS = createExampleSuggestions();

describe('the example suggestions', () => {
  it('all fit the example resume', () => {
    const doc = createExampleResume();

    const refused = EXAMPLE_SUGGESTIONS.map(({ change }) => validateProposal(doc, change));

    expect(refused).toEqual(EXAMPLE_SUGGESTIONS.map(() => null));
  });

  it('cover every kind and every check', () => {
    const kinds = new Set(EXAMPLE_SUGGESTIONS.map(({ change }) => change.kind));
    const flags = new Set(
      EXAMPLE_SUGGESTIONS.flatMap(({ change }) =>
        checkProposal(createExampleResume(), change, EXAMPLE_REQUEST).map((flag) => flag.kind)
      )
    );

    expect([...kinds].sort()).toEqual([
      'add',
      'entry',
      'merge',
      'rename',
      'reorder',
      'rewrite',
      'section',
      'select',
      'split',
    ]);
    expect([...flags].sort()).toEqual([
      'calculatedNumbers',
      'claimsMore',
      'doubledWords',
      'newNames',
      'newNumbers',
      'removedDetail',
      'unfilledGap',
    ]);
  });
});
