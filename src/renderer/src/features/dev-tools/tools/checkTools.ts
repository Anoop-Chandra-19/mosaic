import type { DevTool } from '../devTool';
import { MemoryCheckReport } from '../memory-check/MemoryCheckReport';
import { formatMemoryCheckText, runMemoryCheck } from '../memory-check/runMemoryCheck';

export const CHECK_TOOLS: DevTool[] = [
  {
    id: 'memoryCheck',
    group: 'Checks',
    label: 'Memory check',
    description: 'What each process holds right now.',
    report: MemoryCheckReport,
    run: async () => formatMemoryCheckText(await runMemoryCheck()),
  },
];
