import { describe, expect, it } from 'vitest';
import { diffTextsAsPhrases } from '../diffTextsAsPhrases';
import { joinPhrases } from './changeFixtures';

describe('diffTextsAsPhrases', () => {
  it('keeps what both share and swaps the words that differ', () => {
    expect(diffTextsAsPhrases('Wrote the first program.', 'Wrote the second program.')).toEqual([
      { k: 'keep', t: 'Wrote the ' },
      { k: 'edit', del: 'first', ins: 'second' },
      { k: 'keep', t: ' program.' },
    ]);
  });

  it('joins two edits a lone space apart into one swap', () => {
    expect(diffTextsAsPhrases('a b c d', 'a x y d')).toEqual([
      { k: 'keep', t: 'a ' },
      { k: 'edit', del: 'b c', ins: 'x y' },
      { k: 'keep', t: ' d' },
    ]);
  });

  it('reads one kept word between two edits as part of one swap', () => {
    expect(diffTextsAsPhrases('made the old system', 'rebuilt the new system')).toEqual([
      { k: 'edit', del: 'made the old', ins: 'rebuilt the new' },
      { k: 'keep', t: ' system' },
    ]);
  });

  it('keeps two kept words between edits apart', () => {
    expect(diffTextsAsPhrases('made the old system', 'rebuilt the old service')).toEqual([
      { k: 'edit', del: 'made', ins: 'rebuilt' },
      { k: 'keep', t: ' the old ' },
      { k: 'edit', del: 'system', ins: 'service' },
    ]);
  });

  it('leaves the space both sides of an edit end with out of the edit', () => {
    expect(diffTextsAsPhrases('Assisted in migrating billing', 'Led migrating billing')).toEqual([
      { k: 'edit', del: 'Assisted in', ins: 'Led' },
      { k: 'keep', t: ' migrating billing' },
    ]);
  });

  it('is one keep for the same text, and one edit for none in common', () => {
    expect(diffTextsAsPhrases('Same words.', 'Same words.')).toEqual([
      { k: 'keep', t: 'Same words.' },
    ]);
    expect(diffTextsAsPhrases('', 'New')).toEqual([{ k: 'edit', del: '', ins: 'New' }]);
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
      const phrases = diffTextsAsPhrases(before, after);
      expect(joinPhrases(phrases, 'before')).toBe(before);
      expect(joinPhrases(phrases, 'after')).toBe(after);
    }
  });
});
