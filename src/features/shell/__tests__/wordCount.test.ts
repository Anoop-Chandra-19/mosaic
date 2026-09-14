import { describe, expect, it } from 'vitest';
import { createDefaultResume, createEmptyResume } from '@/lib/resume/defaultResume';
import { countWords } from '../wordCount';

describe('countWords', () => {
  it('counts nothing on an empty resume', () => {
    expect(countWords(createEmptyResume())).toBe(0);
  });

  it('counts only what is on the page', () => {
    const doc = createDefaultResume();
    const all = countWords(doc);
    const entry = doc.sections.flatMap((s) => s.items).find((item) => item.bullets.length > 0)!;
    const bullet = entry.bullets[0];
    const bulletWords = bullet.text.split(/\s+/).filter(Boolean).length;

    bullet.selected = false;

    expect(all).toBeGreaterThan(100);
    expect(countWords(doc)).toBe(all - bulletWords);
  });

  it('does not count separators as words', () => {
    const doc = createEmptyResume();
    doc.contact.name = 'Ada Lovelace';
    doc.contact.email = 'ada@example.com';
    doc.contact.phone = '555 0100';
    // The contact line comes out as "555 0100 | ada@example.com": the bar is not a word.
    expect(countWords(doc)).toBe(5);
  });
});
