import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProcessMemory } from '@shared/types/devTools';
import { formatMemoryChange, formatMemoryCheckText, runMemoryCheck } from '../runMemoryCheck';

const MB = 1024;

function reportMemory(processes: ProcessMemory[]) {
  vi.stubGlobal('window', { mosaic: { dev: { readMemory: async () => processes } } });
}

afterEach(() => vi.unstubAllGlobals());

describe('runMemoryCheck', () => {
  it('compares each process with the check before, by name', async () => {
    reportMemory([
      { name: 'Main', isUtility: false, kilobytes: 178 * MB },
      { name: 'Window', isUtility: false, kilobytes: 512 * MB },
    ]);
    const first = await runMemoryCheck();
    expect(first.since).toBeNull();
    expect(first.rows.map((row) => row.change)).toEqual([null, null]);

    reportMemory([
      { name: 'Main', isUtility: false, kilobytes: 182 * MB },
      { name: 'Window', isUtility: false, kilobytes: 571 * MB },
      { name: 'Network Service', isUtility: true, kilobytes: 12 * MB },
      { name: 'Network Service', isUtility: true, kilobytes: 12 * MB },
    ]);
    const second = await runMemoryCheck();
    expect(second.since).toEqual(first.takenAt);
    expect(second.rows).toEqual([
      { name: 'Main', isUtility: false, megabytes: 182, change: 4 },
      { name: 'Window', isUtility: false, megabytes: 571, change: 59 },
      { name: 'Network Service', isUtility: true, megabytes: 24, change: null },
    ]);
    expect(second.total).toMatchObject({ megabytes: 777, change: 87 });

    const lines = formatMemoryCheckText(second).split('\n');
    expect(lines[0]).toMatch(/^Memory check, per process: .+, change since .+$/);
    expect(lines.slice(1)).toEqual([
      'Main                182 MB      +4 MB',
      'Window              571 MB     +59 MB',
      'Network Service      24 MB',
      'All of Mosaic       777 MB     +87 MB',
    ]);
  });

  it('writes a change as more, fewer or the same', () => {
    expect([4, -3, 0, null].map(formatMemoryChange)).toEqual(['+4 MB', '−3 MB', 'same', '']);
  });
});
