/**
 * How long a run `a[i..]` and `b[j..]` share in order, for every `i` and `j`. Walking it
 * from (0, 0) toward the larger neighbour finds the longest run both keep.
 */
export function measureCommonRuns<T>(
  a: readonly T[],
  b: readonly T[]
): (i: number, j: number) => number {
  const width = b.length + 1;
  const runs = new Int32Array((a.length + 1) * width);
  const at = (i: number, j: number) => i * width + j;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      runs[at(i, j)] =
        a[i] === b[j]
          ? runs[at(i + 1, j + 1)] + 1
          : Math.max(runs[at(i + 1, j)], runs[at(i, j + 1)]);
    }
  }
  return (i, j) => runs[at(i, j)];
}
