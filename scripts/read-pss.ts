import fs from 'node:fs';

/**
 * A process's proportional set size, from the kernel: its memory with what it shares (Chromium's
 * libraries) split between the processes sharing it. Null off Linux or once it's gone.
 */
export function readPssKb(pid: number): number | null {
  try {
    const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    return Number(/^Pss:\s+(\d+) kB$/m.exec(rollup)?.[1] ?? NaN) || null;
  } catch {
    return null;
  }
}
