/** "1 entry", "3 entries". */
export const formatCount = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
