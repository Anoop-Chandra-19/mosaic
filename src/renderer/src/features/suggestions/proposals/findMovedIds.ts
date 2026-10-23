/**
 * What a reorder moves: the fewest items that, taken out and put back, turn `before` into
 * `after`. The rest keep their order and only shift around them, so moving Skills above
 * Experience moves Skills, not Experience and everything after it.
 */
export function findMovedIds(before: readonly string[], after: readonly string[]): string[] {
  // The longest run of items, in the new order, that already stood in that order. Ties go to
  // the latest items, so in a swap the item that came up is the one moved.
  const places = after.map((id) => before.indexOf(id));
  const runEndingAt: number[] = places.map(() => 1);
  const previousInRun: number[] = places.map(() => -1);
  for (let i = 0; i < places.length; i++) {
    for (let j = 0; j < i; j++) {
      if (places[j] < places[i] && runEndingAt[j] + 1 >= runEndingAt[i]) {
        runEndingAt[i] = runEndingAt[j] + 1;
        previousInRun[i] = j;
      }
    }
  }
  const stayed = new Set<string>();
  let at = runEndingAt.lastIndexOf(Math.max(0, ...runEndingAt));
  while (at !== -1) {
    stayed.add(after[at]);
    at = previousInRun[at];
  }
  return after.filter((id) => !stayed.has(id));
}
