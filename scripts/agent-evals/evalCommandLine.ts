import fs from 'node:fs';
import path from 'node:path';

export const EVALS_DIR = import.meta.dirname;
export const RESULTS_DIR = path.join(EVALS_DIR, 'results');

export interface EvalOptions {
  /** `provider[:model]` specs; each runs in parallel with the others. */
  models: string[];
  think: boolean;
  /** Flags without a value (`--literal`), and `--name value` pairs. */
  flags: Set<string>;
  values: Map<string, string>;
}

/** Keys live in a gitignored `.env` beside the scripts; the environment wins when both set one. */
export function loadEvalKeys() {
  const envFile = path.join(EVALS_DIR, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

export function readEvalOptions(argv: string[], valueFlags: string[]): EvalOptions {
  const models: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) models.push(arg);
    else if (valueFlags.includes(arg)) values.set(arg, argv[++i] ?? '');
    else flags.add(arg);
  }
  if (models.length === 0)
    throw new Error('Name at least one model, e.g. ollama or openai:gpt-6-luna');
  return { models, think: flags.has('--think'), flags, values };
}

export function writeEvalResults(fileName: string, rows: unknown[]) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, fileName);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return file;
}

export const medianOf = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
