/** Numbers in [0, 1) that come out the same for the same seed, so generated data does too. */
export type SeededRandom = () => number;

/** Mulberry32: small and fast, and plenty for made-up data. */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A place in a list `length` long. */
export function pickIndex(random: SeededRandom, length: number): number {
  return Math.floor(random() * length);
}

export function pickFrom<T>(random: SeededRandom, items: readonly T[]): T {
  return items[pickIndex(random, items.length)];
}

/** A whole number from `min` to `max`, both included. */
export function pickBetween(random: SeededRandom, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
