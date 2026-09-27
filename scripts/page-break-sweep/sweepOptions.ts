import path from 'node:path';

export const SWEEP_DIR = import.meta.dirname;
export const SWEEP_SEED = Number(process.env.SWEEP_SEED ?? 1);
export const SWEEP_COUNT = Number(process.env.SWEEP_COUNT ?? 200);

export const runDirectory = (seed: number) => path.join(SWEEP_DIR, 'results', `seed-${seed}`);
