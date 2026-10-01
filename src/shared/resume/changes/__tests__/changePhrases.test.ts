import { describe, expect, it } from 'vitest';
import {
  canTogglePhrases,
  checkPhrases,
  joinPhrasesAfter,
  joinPhrasesBefore,
  keepLandedPhrases,
} from '../changePhrases';
import { createChange } from './changeFixtures';

const proposed = createChange({
  origin: 'assistant',
  phrases: [
    { k: 'keep', t: 'Showed ' },
    { k: 'edit', id: 'q1', del: 'a group of leads', ins: 'six leads' },
    { k: 'keep', t: ' which method to build on, scoring each against ' },
    { k: 'edit', id: 'q2', del: 'real data.', ins: '40,000 real records.' },
  ],
});

describe('change phrases', () => {
  it('rebuild the text before, and after with some phrases dropped', () => {
    expect(joinPhrasesBefore(proposed)).toBe(
      'Showed a group of leads which method to build on, scoring each against real data.'
    );
    expect(joinPhrasesAfter(proposed, { q2: false })).toBe(
      'Showed six leads which method to build on, scoring each against real data.'
    );
  });

  it('fail the check when the source was paraphrased', () => {
    expect(checkPhrases(proposed, joinPhrasesBefore(proposed))).toBe(true);
    expect(checkPhrases(proposed, 'Showed a group of leads which method to build on.')).toBe(false);
    expect(checkPhrases(proposed, joinPhrasesBefore(proposed), 'Something else.')).toBe(false);
  });

  it('keep only what landed, with dropped phrases folded into the text around them', () => {
    expect(keepLandedPhrases(proposed, { q2: false })).toEqual([
      { k: 'keep', t: 'Showed ' },
      { k: 'edit', id: 'q1', del: 'a group of leads', ins: 'six leads' },
      { k: 'keep', t: ' which method to build on, scoring each against real data.' },
    ]);
  });

  it('can be toggled phrase by phrase only when the assistant wrote them', () => {
    expect(canTogglePhrases(proposed)).toBe(true);
    expect(canTogglePhrases({ ...proposed, origin: 'diff' })).toBe(false);
  });
});
