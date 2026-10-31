import { describe, expect, it } from 'vitest';
import { findMoves } from '../findMoves';

const movedIds = (before: string[], after: string[]) =>
  findMoves(before, after).map(({ id }) => id);

describe('findMoves', () => {
  it('names what was moved, not what only shifted around it', () => {
    expect(movedIds(['a', 'b', 'c', 'd'], ['a', 'd', 'b', 'c'])).toEqual(['d']);
    expect(movedIds(['a', 'b', 'c'], ['b', 'c', 'a'])).toEqual(['a']);
    // A swap: the one that came up is the one moved.
    expect(movedIds(['a', 'b'], ['b', 'a'])).toEqual(['b']);
    expect(movedIds(['a', 'b', 'c'], ['b', 'a', 'c'])).toEqual(['b']);
    expect(movedIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
  });

  it('counts places from 1', () => {
    expect(findMoves(['a', 'b', 'c'], ['b', 'a', 'c'])).toEqual([
      { id: 'b', position: 1, positionBefore: 2 },
    ]);
  });
});
