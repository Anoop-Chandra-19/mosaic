/**
 * How much memory the built app holds, process by process, as a fictional resume grows a
 * long history and every view is opened and closed again and again. Prints a table, and
 * compares it with the last run's, kept in `out/memory-check/last.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type CDPSession, type ElectronApplication, type Page } from '@playwright/test';
import type { DbResult } from '../../src/shared/types/db';
import { test, withApp } from '../../e2e/harness/launch';

const mosaic = withApp();

/** About seven A4 pages. */
const BULLETS = 130;
const VERSIONS = 200;
/** Versions stepped through in the full history. */
const STEPS = 40;
const CYCLES = 10;
const RESULTS = path.resolve(import.meta.dirname, '../../out/memory-check/last.json');

const bullet = (index: number) =>
  `- Wrote program ${index} for the analytical engine, checking every step of it by hand against the tables computed the long way, and wrote down whatever differed.`;

interface Measurement {
  stage: string;
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
}

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
  stage: string,
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
    stage,
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

async function importResume(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  const text = ['Ada Lovelace', 'ada@example.com', '', 'Experience', 'Analyst, Engine Works'];
  await importing
    .getByLabel('Or paste the text')
    .fill([...text, ...Array.from({ length: BULLETS }, (_, i) => bullet(i))].join('\n'));
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

/**
 * Edits one bullet per version straight through the database, every tenth one named, then
 * reloads so the app reads it all as it would at launch.
 */
async function growHistory(page: Page) {
  await page.evaluate(async (count) => {
    const db = window.mosaic.db;
    const unwrap = <T>(result: DbResult<T>): T => {
      if (!result.ok) throw new Error(result.message);
      return result.value;
    };
    const templateId = unwrap(await db.boot()).draft!.templateId;
    for (let i = 1; i <= count; i++) {
      const draft = unwrap(await db.drafts.get(templateId));
      const entry = draft.doc.sections
        .flatMap((section) => section.items)
        .find((item) => (item.bullets?.length ?? 0) > 0)!;
      const edited = entry.bullets[i % entry.bullets.length];
      edited.text = `${edited.text.replace(/ \(round \d+\)$/, '')} (round ${i})`;
      unwrap(await db.drafts.save(templateId, draft.doc, draft.rev));
      unwrap(
        await (i % 10 === 0
          ? db.versions.name(templateId, `Round ${i}`, 'new')
          : db.versions.snapshot(templateId, 'edit'))
      );
    }
  }, VERSIONS);
  await page.reload();
  await expect(page.locator('[data-preview-page-content]').first()).toBeVisible();
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

const COLUMNS: [keyof Measurement, string][] = [
  ['rendererHeapMb', 'page JS'],
  ['domNodes', 'DOM nodes'],
  ['listeners', 'listeners'],
  ['mainHeapMb', 'main JS'],
  ['rendererMb', 'renderer'],
  ['mainMb', 'main'],
  ['gpuMb', 'GPU'],
  ['otherMb', 'other'],
  ['totalMb', 'total'],
  ['totalPssMb', 'total (PSS)'],
];

function printTable(rows: Measurement[], previous: Measurement[] | null) {
  const stageWidth = Math.max(...rows.map((row) => row.stage.length));
  const cell = (row: Measurement, key: keyof Measurement) => {
    const was = previous?.find((old) => old.stage === row.stage)?.[key];
    const value = row[key];
    if (typeof value !== 'number') return '–'.padStart(13);
    const change = typeof was === 'number' ? value - was : null;
    const shown =
      change === null ? '' : ` (${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10})`;
    return `${value}${shown}`.padStart(13);
  };
  console.log(
    ['stage'.padEnd(stageWidth), ...COLUMNS.map(([, label]) => label.padStart(13))].join(' ')
  );
  for (const row of rows) {
    console.log(
      [row.stage.padEnd(stageWidth), ...COLUMNS.map(([key]) => cell(row, key))].join(' ')
    );
  }
  console.log('MB, except DOM nodes and listeners. In brackets: the change since the last run.');
}

/** What each open-and-close round left behind, from the 2nd round to the last. */
function printGrowth(cycles: Measurement[]) {
  const first = cycles[1];
  const last = cycles.at(-1)!;
  const rounds = cycles.length - 2;
  const perRound = (key: keyof Measurement) =>
    Math.round((((last[key] as number) - (first[key] as number)) / rounds) * 100) / 100;
  console.log(
    `Each round after the first left ${perRound('rendererHeapMb')} MB of page JS, ` +
      `${perRound('domNodes')} DOM nodes and ${perRound('listeners')} listeners behind.`
  );
}

test('memory through a long history and repeated views', async () => {
  const { app, page } = mosaic();
  const session = await page.context().newCDPSession(page);
  const rows: Measurement[] = [];
  const record = async (stage: string) => rows.push(await measure(stage, app, session));

  await expect(page.getByRole('button', { name: /Blank resume/ })).toBeVisible();
  await record('launched');
  await importResume(page);
  await record(`${BULLETS}-bullet resume`);
  await growHistory(page);
  await record(`${VERSIONS} versions, reloaded`);
  await readHistory(page);
  await record(`stepped through ${STEPS}`);

  const cycles: Measurement[] = [];
  for (let round = 1; round <= CYCLES; round++) {
    await openAndCloseEverything(page);
    const row = await measure(`views opened ×${round}`, app, session);
    cycles.push(row);
    if (round === 1 || round === CYCLES) rows.push(row);
  }

  const previous = fs.existsSync(RESULTS)
    ? (JSON.parse(fs.readFileSync(RESULTS, 'utf8')) as Measurement[])
    : null;
  printTable(rows, previous);
  printGrowth(cycles);
  fs.mkdirSync(path.dirname(RESULTS), { recursive: true });
  fs.writeFileSync(RESULTS, JSON.stringify(rows, null, 2));
});
