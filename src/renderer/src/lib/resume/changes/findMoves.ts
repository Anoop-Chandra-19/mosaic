import { measureCommonRuns } from './measureCommonRuns';

/** Positions count from 1, among the ids both lists have. */
export interface Move {
  id: string;
  position: number;
  positionBefore: number;
}

/** The ids both lists keep in the same order; on a tie, the one that came forward is moved. */
function findIdsInPlace(before: string[], after: string[]): Set<string> {
  const runFrom = measureCommonRuns(before, after);
  const inPlace = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      inPlace.add(before[i]);
      i++;
      j++;
    } else if (runFrom(i + 1, j) > runFrom(i, j + 1)) {
      i++;
    } else {
      j++;
    }
  }
  return inPlace;
}

/** What moved: the ids in both lists that are off the longest run both keep in order. */
export function findMoves(beforeIds: string[], afterIds: string[]): Move[] {
  const inBefore = new Set(beforeIds);
  const inAfter = new Set(afterIds);
  const before = beforeIds.filter((id) => inAfter.has(id));
  const after = afterIds.filter((id) => inBefore.has(id));
  const inPlace = findIdsInPlace(before, after);
  return after.flatMap((id, index) =>
    inPlace.has(id) ? [] : { id, position: index + 1, positionBefore: before.indexOf(id) + 1 }
  );
}
