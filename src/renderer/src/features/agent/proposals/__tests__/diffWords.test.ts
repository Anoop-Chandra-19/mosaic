import { describe, expect, it } from 'vitest';
import { diffWords } from '../diffWords';

const join = (parts: ReturnType<typeof diffWords>, side: 'before' | 'after') =>
  parts
    .filter(
      (part) => part.kind === 'same' || part.kind === (side === 'before' ? 'removed' : 'added')
    )
    .map((part) => part.text)
    .join('');

describe('diffWords', () => {
  it('gives back both texts, spaces kept', () => {
    const before = 'Reduced p99 latency  by 40%';
    const after = 'Cut p99 latency  by 45% in Q3';
    const parts = diffWords(before, after);
    expect(join(parts, 'before')).toBe(before);
    expect(join(parts, 'after')).toBe(after);
  });

  it('marks changed words, removed before added', () => {
    expect(diffWords('Assisted in migrating billing', 'Led migrating billing')).toEqual([
      { kind: 'removed', text: 'Assisted in' },
      { kind: 'added', text: 'Led' },
      { kind: 'same', text: ' migrating billing' },
    ]);
  });

  it('reads one kept word between two changes as part of one change', () => {
    const parts = diffWords('made the old system', 'rebuilt the new system');
    expect(parts.filter((part) => part.kind !== 'same')).toEqual([
      { kind: 'removed', text: 'made the old' },
      { kind: 'added', text: 'rebuilt the new' },
    ]);
  });

  it('keeps two kept words between changes apart', () => {
    const parts = diffWords('made the old system', 'rebuilt the old service');
    expect(parts.filter((part) => part.kind === 'added')).toHaveLength(2);
  });

  it('is all same for equal text, and all added from nothing', () => {
    expect(diffWords('same text', 'same text')).toEqual([{ kind: 'same', text: 'same text' }]);
    expect(diffWords('', 'new text')).toEqual([{ kind: 'added', text: 'new text' }]);
  });
});
