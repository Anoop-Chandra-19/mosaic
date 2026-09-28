/*
 * The two ways a row in the editor changes place. Both hand back the whole new order, so
 * the store takes one reorder per gesture, whichever gesture it was.
 */

/** `ids` with the one at `index` swapped with its neighbour, or null at either end. */
export function swapNeighbours(ids: string[], index: number, direction: -1 | 1): string[] | null {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * `ids` with `id` moved to land before the row at `slot`, counting the rows with `id` still
 * among them, as a drag sees them; `ids.length` is past the last row. So its own slot and
 * the one after it both mean where it already is. Null when nothing would change.
 */
export function moveToSlot(ids: string[], id: string, slot: number): string[] | null {
  const from = ids.indexOf(id);
  if (from < 0) return null;
  const next = ids.filter((other) => other !== id);
  next.splice(slot > from ? slot - 1 : slot, 0, id);
  return next.some((other, i) => other !== ids[i]) ? next : null;
}
