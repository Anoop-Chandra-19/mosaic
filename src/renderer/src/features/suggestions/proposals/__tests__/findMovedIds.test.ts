import { describe, expect, it } from 'vitest';
import { findMovedIds } from '../findMovedIds';

describe('findMovedIds', () => {
  it('names what was moved, not what only shifted around it', () => {
    expect(findMovedIds(['a', 'b', 'c', 'd'], ['a', 'd', 'b', 'c'])).toEqual(['d']);
    expect(findMovedIds(['a', 'b', 'c'], ['b', 'c', 'a'])).toEqual(['a']);
    // A swap: the one that came up is the one moved.
    expect(findMovedIds(['a', 'b'], ['b', 'a'])).toEqual(['b']);
    expect(findMovedIds(['a', 'b', 'c'], ['b', 'a', 'c'])).toEqual(['b']);
    expect(findMovedIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
  });
});
