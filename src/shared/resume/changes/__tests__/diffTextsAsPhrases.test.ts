import { describe, expect, it } from 'vitest';
import { checkPhrases } from '../changePhrases';
import { diffTextsAsPhrases } from '../diffTextsAsPhrases';
import { createChange } from './changeFixtures';

describe('diffTextsAsPhrases', () => {
  it('keeps what both share and swaps the words that differ', () => {
    expect(diffTextsAsPhrases('Wrote the first program.', 'Wrote the second program.')).toEqual([
      { k: 'keep', t: 'Wrote the ' },
      { k: 'edit', id: 'w0', del: 'first', ins: 'second' },
      { k: 'keep', t: ' program.' },
    ]);
  });

  it('joins two edits a lone space apart into one swap', () => {
    expect(diffTextsAsPhrases('a b c d', 'a x y d', 'p')).toEqual([
      { k: 'keep', t: 'a ' },
      { k: 'edit', id: 'p0', del: 'b c', ins: 'x y' },
      { k: 'keep', t: ' d' },
    ]);
  });

  it('is one keep for the same text, and one edit for none in common', () => {
    expect(diffTextsAsPhrases('Same words.', 'Same words.')).toEqual([
      { k: 'keep', t: 'Same words.' },
    ]);
    expect(diffTextsAsPhrases('', 'New')).toEqual([{ k: 'edit', id: 'w0', del: '', ins: 'New' }]);
  });

  it('always rebuilds both texts exactly', () => {
    const words = ['the', 'engine', 'ran', 'tables', 'by', 'hand', ',', 'again'];
    const spaces = [' ', '  ', '\n'];
    const random = (seed: number) => {
      let text = '';
      for (let i = 0; i < (seed % 9) + 1; i++) {
        text += words[(seed * (i + 3)) % words.length] + spaces[(seed + i) % spaces.length];
      }
      return text;
    };
    for (let seed = 0; seed < 300; seed++) {
      const before = random(seed);
      const after = random(seed * 7 + 1);
      const change = createChange({ phrases: diffTextsAsPhrases(before, after) });
      expect(checkPhrases(change, before, after)).toBe(true);
    }
  });
});
