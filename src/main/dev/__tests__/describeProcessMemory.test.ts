import type { ProcessMetric } from 'electron';
import { describe, expect, it } from 'vitest';
import { describeProcessMemory } from '../describeProcessMemory';

function metric(pid: number, type: ProcessMetric['type'], kilobytes: number, name?: string) {
  return { pid, type, name, memory: { workingSetSize: kilobytes } } as ProcessMetric;
}

describe('describeProcessMemory', () => {
  it('names each process for what it is, main, the window and the GPU first', () => {
    const rows = describeProcessMemory(
      [
        metric(4, 'Utility', 24_576, 'Network Service'),
        metric(3, 'GPU', 143_360),
        metric(5, 'Tab', 90_000),
        metric(2, 'Tab', 584_704),
        metric(1, 'Browser', 186_368),
        metric(6, 'Zygote', 1_000),
      ],
      (pid) => ({ 2: 'window' as const, 5: 'devTools' as const })[pid]
    );
    expect(rows).toEqual([
      { name: 'Main', isUtility: false, kilobytes: 186_368 },
      { name: 'Window', isUtility: false, kilobytes: 584_704 },
      { name: 'DevTools', isUtility: false, kilobytes: 90_000 },
      { name: 'GPU', isUtility: false, kilobytes: 143_360 },
      { name: 'Network Service', isUtility: true, kilobytes: 24_576 },
      { name: 'Zygote', isUtility: false, kilobytes: 1_000 },
    ]);
  });
});
