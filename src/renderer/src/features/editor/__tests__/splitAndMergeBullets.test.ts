import { describe, expect, it } from 'vitest';
import {
  canSplitAt,
  canSplitText,
  describeSplitRefusal,
  findSentenceBreakNearMiddle,
  findSplitStart,
  joinBulletTexts,
  moveSeamWithEdit,
} from '../splitAndMergeBullets';

const twoSentences =
  'Rebuilt the billing export for the finance team. Cut its run from hours to minutes.';

describe('finding where to split', () => {
  it('starts at the sentence break nearest the middle', () => {
    const at = findSplitStart(twoSentences);
    expect(twoSentences.slice(at)).toBe('Cut its run from hours to minutes.');
  });

  it('counts a semicolon as a break, and prefers the one nearer the middle', () => {
    const text =
      'Ran the pilot for a month; wrote up the results. Shipped it to all three regions.';
    expect(text.slice(findSentenceBreakNearMiddle(text))).toBe('Shipped it to all three regions.');
  });

  it('ignores a break that would leave a scrap at either end', () => {
    expect(
      findSentenceBreakNearMiddle('Led it. Then rebuilt the whole billing export pipeline.')
    ).toBe(-1);
  });

  it('falls back to the word nearest the middle', () => {
    const text = 'Rebuilt the billing export pipeline';
    expect(text.slice(findSplitStart(text))).toBe('export pipeline');
  });

  it('puts one word at its end, where nothing splits it', () => {
    expect(findSplitStart('Rebuilt')).toBe('Rebuilt'.length);
  });
});

describe('what can be split', () => {
  it('needs text on both sides of the point', () => {
    expect(canSplitAt(twoSentences, 10)).toBe(true);
    expect(canSplitAt(twoSentences, 0)).toBe(false);
    expect(canSplitAt(twoSentences, twoSentences.length)).toBe(false);
    expect(canSplitAt('  Rebuilt it', 2)).toBe(false);
  });

  it('needs two words', () => {
    expect([canSplitText('Rebuilt it'), canSplitText(' Rebuilt '), canSplitText('')]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('says why a split is refused, and nothing when it is not', () => {
    expect(describeSplitRefusal(twoSentences, 10)).toBeNull();
    expect(describeSplitRefusal('   ', 1)).toBe(
      'The bullet is empty, so there is nothing to split.'
    );
    expect(describeSplitRefusal(twoSentences, 0)).toMatch(/^The cursor is at the start\./);
    expect(describeSplitRefusal(twoSentences, twoSentences.length)).toMatch(
      /^The cursor is at the end\./
    );
  });
});

describe('joining two bullets', () => {
  it('joins with one space and marks where the second begins', () => {
    expect(joinBulletTexts(' Built the tool. ', 'Used it daily.')).toEqual({
      text: 'Built the tool. Used it daily.',
      seam: 'Built the tool.'.length,
    });
  });

  it('takes the other text whole when one is empty', () => {
    expect(joinBulletTexts('', 'Used it daily.')).toEqual({ text: 'Used it daily.', seam: 0 });
    expect(joinBulletTexts('Built it.', ' ')).toEqual({ text: 'Built it.', seam: 9 });
  });

  it('moves the seam with an edit before it, and not after it', () => {
    const before = 'Built the tool. Used it daily.';
    const seam = 15;
    // Typed ", fast" at 14, before the full stop.
    expect(moveSeamWithEdit(seam, before, 'Built the tool, fast. Used it daily.', 20)).toBe(21);
    // Deleted the full stop at 14.
    expect(moveSeamWithEdit(seam, before, 'Built the tool Used it daily.', 14)).toBe(14);
    // Typed after the seam.
    expect(moveSeamWithEdit(seam, before, 'Built the tool. Used it every day.', 33)).toBe(15);
  });
});
