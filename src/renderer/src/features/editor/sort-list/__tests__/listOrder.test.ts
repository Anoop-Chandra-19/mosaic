import { describe, expect, it } from 'vitest';
import { moveToSlot, swapNeighbours } from '../listOrder';

const rows = ['a', 'b', 'c', 'd'];

describe('swapNeighbours', () => {
  it('swaps a row with the one above or below it', () => {
    expect(swapNeighbours(rows, 1, -1)).toEqual(['b', 'a', 'c', 'd']);
    expect(swapNeighbours(rows, 1, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('does nothing past either end', () => {
    expect(swapNeighbours(rows, 0, -1)).toBeNull();
    expect(swapNeighbours(rows, 3, 1)).toBeNull();
  });

  it('leaves the list it was given alone', () => {
    swapNeighbours(rows, 1, 1);
    expect(rows).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('moveToSlot', () => {
  it('moves a row down, counting slots with it still in the list', () => {
    // Before "d": past "c", which is slot 3 while "a" is still at slot 0.
    expect(moveToSlot(rows, 'a', 3)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a row up', () => {
    expect(moveToSlot(rows, 'c', 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves a row past the last one', () => {
    expect(moveToSlot(rows, 'b', rows.length)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('reads its own slot and the one after it as staying put', () => {
    expect(moveToSlot(rows, 'b', 1)).toBeNull();
    expect(moveToSlot(rows, 'b', 2)).toBeNull();
    expect(moveToSlot(rows, 'd', rows.length)).toBeNull();
  });

  it('ignores a row that is not in the list', () => {
    expect(moveToSlot(rows, 'z', 0)).toBeNull();
  });
});
