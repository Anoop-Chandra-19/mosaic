/**
 * A CPU profile of the page's main thread for one flow, through the DevTools protocol: kept
 * as a `.cpuprofile` file (Chrome's DevTools opens it in the Performance panel) and summed up
 * as the functions that spent the most time themselves.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
}

interface CpuProfile {
  nodes: ProfileNode[];
  samples: number[];
  /** Microseconds since the sample before. */
  timeDeltas: number[];
}

export interface FlowProfiler {
  start: () => Promise<void>;
  /** Stops, keeps the profile, and prints what took the time. */
  stop: (flow: string) => Promise<void>;
}

/** Fine enough to catch a function of a fraction of a millisecond. */
const SAMPLING_INTERVAL_US = 100;
const TOP_FUNCTIONS = 10;

const toFileName = (flow: string) =>
  flow
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function describeFrame({ functionName, url, lineNumber }: ProfileNode['callFrame']): string {
  const where = url ? ` ${path.basename(url)}:${lineNumber + 1}` : '';
  return `${functionName || '(anonymous)'}${where}`;
}

/** Milliseconds each function spent itself, not in what it called; idle left out. */
function sumOwnTime(profile: CpuProfile): Map<string, number> {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const ownMs = new Map<string, number>();
  profile.samples.forEach((id, index) => {
    const frame = nodes.get(id)!.callFrame;
    if (frame.functionName === '(idle)') return;
    const key = describeFrame(frame);
    ownMs.set(key, (ownMs.get(key) ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000);
  });
  return ownMs;
}

function printTopFunctions(flow: string, profile: CpuProfile, file: string) {
  const ownMs = sumOwnTime(profile);
  const busyMs = [...ownMs.values()].reduce((sum, ms) => sum + ms, 0);
  const top = [...ownMs].sort(([, a], [, b]) => b - a).slice(0, TOP_FUNCTIONS);
  console.log(`\n${flow}: ${Math.round(busyMs)} ms busy (${path.relative(process.cwd(), file)})`);
  for (const [frame, ms] of top) console.log(`  ${ms.toFixed(1).padStart(7)} ms  ${frame}`);
}

/** Profiles the page in `page`, keeping each flow's profile in `folder`. */
export async function createFlowProfiler(page: Page, folder: string): Promise<FlowProfiler> {
  const session = await page.context().newCDPSession(page);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US });
  fs.mkdirSync(folder, { recursive: true });
  return {
    start: async () => {
      await session.send('Profiler.start');
    },
    stop: async (flow) => {
      const { profile } = await session.send('Profiler.stop');
      const file = path.join(folder, `${toFileName(flow)}.cpuprofile`);
      fs.writeFileSync(file, JSON.stringify(profile));
      printTopFunctions(flow, profile as CpuProfile, file);
    },
  };
}
