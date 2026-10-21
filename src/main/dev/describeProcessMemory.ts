import type { ProcessMetric } from 'electron';
import type { ProcessMemory } from '@shared/types/devTools';

/** What a page's process shows: the app's window, or DevTools open beside it. */
export type PageProcess = 'window' | 'devTools';

const PAGE_NAMES: Record<PageProcess, string> = { window: 'Window', devTools: 'DevTools' };
const TYPE_NAMES: Partial<Record<ProcessMetric['type'], string>> = { Browser: 'Main', GPU: 'GPU' };
/** Main, the window and the GPU first, as the memory check lists them; the rest after. */
const ORDER = ['Main', 'Window', 'DevTools', 'GPU'];

function nameProcess(metric: ProcessMetric, page: PageProcess | undefined): string {
  if (metric.type === 'Tab') return page ? PAGE_NAMES[page] : 'Page';
  if (metric.type === 'Utility') return metric.name || metric.serviceName || 'Utility';
  return TYPE_NAMES[metric.type] ?? metric.type;
}

const rank = (name: string) => {
  const index = ORDER.indexOf(name);
  return index < 0 ? ORDER.length : index;
};

/**
 * `app.getAppMetrics()` as the memory check reads it: one row a process, named for what it
 * is, given which page each page process shows.
 */
export function describeProcessMemory(
  metrics: readonly ProcessMetric[],
  findPage: (pid: number) => PageProcess | undefined
): ProcessMemory[] {
  return metrics
    .map((metric) => ({
      name: nameProcess(metric, findPage(metric.pid)),
      isUtility: metric.type === 'Utility',
      kilobytes: metric.memory.workingSetSize,
    }))
    .sort((a, b) => rank(a.name) - rank(b.name));
}
