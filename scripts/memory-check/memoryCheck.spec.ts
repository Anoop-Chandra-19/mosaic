/**
 * How much memory the built app holds, process by process, as a fictional resume grows a
 * long history and every view is opened and closed again and again. Prints a table, and
 * compares it with the last run's, kept in `out/memory-check/last.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type CDPSession, type ElectronApplication, type Page } from '@playwright/test';
import { test, withApp } from '../../e2e/harness/launch';
import { reportAgainstLastRun, type ResultColumn } from '../compared-results';
import { growHistory, importLargeResume } from '../large-resume';

const mosaic = withApp();

/** About seven A4 pages. */
const BULLETS = 130;
const VERSIONS = 200;
/** Versions stepped through in the full history. */
const STEPS = 40;
/**
 * Open-and-close rounds. Page JS climbs for about the first ten as caches fill and code is
 * compiled, then levels off: growth is measured over the rounds after those.
 */
const WARM_UP_ROUNDS = 10;
const MEASURED_ROUNDS = 10;
const RESULTS = path.resolve(import.meta.dirname, '../../out/memory-check/last.json');

type Measurement = {
  /** The stage measured after. */
  name: string;
  /** Live JavaScript in the page, after a collection. */
  rendererHeapMb: number;
  domNodes: number;
  listeners: number;
  /** Resident memory of each process, as the OS counts it. */
  rendererMb: number;
  mainMb: number;
  gpuMb: number;
  otherMb: number;
  totalMb: number;
  /**
   * Linux only: the total with memory the processes share (Chromium's libraries) counted
   * once, split between them, where `totalMb` counts it in every process.
   */
  totalPssMb: number | null;
  mainHeapMb: number;
};

/** A process's proportional set size, from the kernel; null off Linux or once it's gone. */
function readPssKb(pid: number): number | null {
  try {
    const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    return Number(/^Pss:\s+(\d+) kB$/m.exec(rollup)?.[1] ?? NaN) || null;
  } catch {
    return null;
  }
}

const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

async function measure(
  name: string,
  app: ElectronApplication,
  session: CDPSession
): Promise<Measurement> {
  // Twice: the first collection can leave work that only the second frees.
  await session.send('HeapProfiler.collectGarbage');
  await session.send('HeapProfiler.collectGarbage');
  const { usedSize } = await session.send('Runtime.getHeapUsage');
  const { nodes, jsEventListeners } = await session.send('Memory.getDOMCounters');
  const rendererPid = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getOSProcessId()
  );
  const { processes, mainHeap } = await app.evaluate(({ app }) => ({
    processes: app.getAppMetrics().map(({ pid, type, memory }) => ({
      pid,
      type,
      kb: memory.workingSetSize,
    })),
    mainHeap: process.memoryUsage().heapUsed,
  }));
  const kbOf = (match: (process: { pid: number; type: string }) => boolean) =>
    processes.filter(match).reduce((sum, process) => sum + process.kb, 0);
  const rendererKb = kbOf(({ pid }) => pid === rendererPid);
  const mainKb = kbOf(({ type }) => type === 'Browser');
  const gpuKb = kbOf(({ type }) => type === 'GPU');
  const totalKb = kbOf(() => true);
  const pssKb = processes.map(({ pid }) => readPssKb(pid));
  return {
    name,
    rendererHeapMb: mb(usedSize),
    domNodes: nodes,
    listeners: jsEventListeners,
    rendererMb: mb(rendererKb * 1024),
    mainMb: mb(mainKb * 1024),
    gpuMb: mb(gpuKb * 1024),
    otherMb: mb((totalKb - rendererKb - mainKb - gpuKb) * 1024),
    totalMb: mb(totalKb * 1024),
    totalPssMb: pssKb.includes(null)
      ? null
      : mb(pssKb.reduce((sum: number, kb) => sum + kb!, 0) * 1024),
    mainHeapMb: mb(mainHeap),
  };
}

const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

async function readHistory(page: Page) {
  const view = page.getByRole('region', { name: /^History of / });
  await page.keyboard.press('Control+Shift+H');
  await expect(view).toBeVisible();
  for (let i = 0; i < STEPS; i++) {
    await page.keyboard.press('ArrowDown');
    await nextFrames(page);
  }
  await page.keyboard.press('Control+Shift+H');
  await expect(view).toHaveCount(0);
}

/** Every view that comes and goes, once each. */
async function openAndCloseEverything(page: Page) {
  const view = page.getByRole('region', { name: /^History of / });
  await page.keyboard.press('Control+Shift+H');
  await expect(view).toBeVisible();
  await page.keyboard.press('Control+Shift+H');
  await expect(view).toHaveCount(0);

  for (const [opener, name] of [
    ['Open settings', 'Settings'],
    ['Open export dialog', 'Export'],
  ] as const) {
    await page.getByRole('button', { name: opener }).click();
    await expect(page.getByRole('dialog', { name })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
  }

  await page.keyboard.press('Control+/');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
}

const COLUMNS: ResultColumn[] = [
  { key: 'rendererHeapMb', label: 'page JS' },
  { key: 'domNodes', label: 'DOM nodes' },
  { key: 'listeners', label: 'listeners' },
  { key: 'mainHeapMb', label: 'main JS' },
  { key: 'rendererMb', label: 'renderer' },
  { key: 'mainMb', label: 'main' },
  { key: 'gpuMb', label: 'GPU' },
  { key: 'otherMb', label: 'other' },
  { key: 'totalMb', label: 'total' },
  { key: 'totalPssMb', label: 'total (PSS)' },
];

/** What each round left behind once warmed up: anything above about zero is a leak. */
function printGrowth(warmedUp: Measurement, last: Measurement) {
  const perRound = (key: 'rendererHeapMb' | 'domNodes' | 'listeners') =>
    Math.round(((last[key] - warmedUp[key]) / MEASURED_ROUNDS) * 100) / 100;
  console.log(
    `After ${WARM_UP_ROUNDS} rounds to warm up, each of the next ${MEASURED_ROUNDS} left ` +
      `${perRound('rendererHeapMb')} MB of page JS, ${perRound('domNodes')} DOM nodes and ` +
      `${perRound('listeners')} listeners behind.`
  );
}

test('memory through a long history and repeated views', async () => {
  const { app, page } = mosaic();
  const session = await page.context().newCDPSession(page);
  const rows: Measurement[] = [];
  const record = async (stage: string) => rows.push(await measure(stage, app, session));

  await expect(page.getByRole('button', { name: /Blank resume/ })).toBeVisible();
  await record('launched');
  await importLargeResume(page, BULLETS);
  await record(`${BULLETS}-bullet resume`);
  await growHistory(page, { versions: VERSIONS });
  await record(`${VERSIONS} versions, reloaded`);
  await readHistory(page);
  await record(`stepped through ${STEPS}`);

  const rounds = WARM_UP_ROUNDS + MEASURED_ROUNDS;
  for (let round = 1; round <= rounds; round++) {
    await openAndCloseEverything(page);
    if (round === 1 || round === WARM_UP_ROUNDS || round === rounds) {
      await record(`views opened ×${round}`);
    }
  }

  reportAgainstLastRun(rows, COLUMNS, RESULTS, 'stage');
  console.log('MB, except DOM nodes and listeners.');
  printGrowth(rows.at(-2)!, rows.at(-1)!);
});
