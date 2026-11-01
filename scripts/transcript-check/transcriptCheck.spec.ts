/**
 * How the assistant's pane holds up under a conversation of 2,000 messages, in the built app:
 * reopening it, scrolling back to its first message, and scrolling through. Prints a table,
 * and compares it with the last run's, kept in `out/transcript-check/last.json`.
 */
import path from 'node:path';
import { expect, type CDPSession, type ElectronApplication, type Page } from '@playwright/test';
import { runDevTool } from '../../e2e/harness/devTools';
import { test, withApp } from '../../e2e/harness/launch';
import { reportAgainstLastRun, type ResultColumn, type ResultRow } from '../compared-results';
import { readPssKb } from '../read-pss';

const MESSAGES = 2000;
const WHEEL_NOTCHES = 60;
const WHEEL_PX = 240;
const WHEEL_DELAY_MS = 16;
/** Past this, a 60-a-second frame was missed. */
const LATE_FRAME_MS = 25;
/** With no more older messages for this long, the scroll back is as far as it goes. */
const NOTHING_NEW_MS = 2500;
const RESULTS = path.resolve(import.meta.dirname, '../../out/transcript-check/last.json');

const mosaic = withApp();

interface PageLog {
  longTasks: number[];
  frameGaps: number[];
}

const COLUMNS: ResultColumn[] = [
  { key: 'ms', label: 'time' },
  { key: 'runsShown', label: 'runs shown' },
  { key: 'longTasks', label: 'long tasks' },
  { key: 'longestTaskMs', label: 'longest' },
  { key: 'lateFrames', label: 'late frames' },
  { key: 'heapMb', label: 'heap MB' },
  { key: 'rendererMb', label: 'renderer MB' },
  { key: 'allProcessesMb', label: 'all MB' },
  { key: 'sharedOnceMb', label: 'shared once' },
  { key: 'domNodes', label: 'DOM nodes' },
];

const startPageLog = (page: Page) =>
  page.evaluate(() => {
    const log: PageLog = { longTasks: [], frameGaps: [] };
    (window as unknown as { pageLog: PageLog }).pageLog = log;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) log.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
    let lastFrameAt = performance.now();
    const noteFrame = (now: number) => {
      log.frameGaps.push(now - lastFrameAt);
      lastFrameAt = now;
      requestAnimationFrame(noteFrame);
    };
    requestAnimationFrame(noteFrame);
  });

const readPageLog = (page: Page) =>
  page.evaluate(() => {
    const { pageLog } = window as unknown as { pageLog: PageLog };
    const log = { longTasks: [...pageLog.longTasks], frameGaps: [...pageLog.frameGaps] };
    pageLog.longTasks.length = 0;
    pageLog.frameGaps.length = 0;
    return log;
  });

const conversationOf = (page: Page) => page.getByRole('region', { name: 'Conversation' });

const countRunsShown = (page: Page) =>
  conversationOf(page).getByText('What stands out in part').count();

async function readMemory(app: ElectronApplication, session: CDPSession) {
  await session.send('HeapProfiler.collectGarbage');
  await session.send('HeapProfiler.collectGarbage');
  const { usedSize } = await session.send('Runtime.getHeapUsage');
  const { nodes } = await session.send('Memory.getDOMCounters');
  const { rendererPid, processes } = await app.evaluate(({ app, BrowserWindow }) => ({
    rendererPid: BrowserWindow.getAllWindows()[0].webContents.getOSProcessId(),
    processes: app.getAppMetrics().map(({ pid, memory }) => ({ pid, kb: memory.workingSetSize })),
  }));
  const rendererKb = processes.find(({ pid }) => pid === rendererPid)?.kb ?? 0;
  const pssKb = processes.map(({ pid }) => readPssKb(pid));
  return {
    heapMb: Math.round(usedSize / 1024 / 1024),
    rendererMb: Math.round(rendererKb / 1024),
    allProcessesMb: Math.round(processes.reduce((sum, { kb }) => sum + kb, 0) / 1024),
    // Each process's own count holds Chromium's libraries, which they share: this counts them once.
    sharedOnceMb: pssKb.includes(null)
      ? null
      : Math.round(pssKb.reduce((sum: number, kb) => sum + kb!, 0) / 1024),
    domNodes: nodes,
  };
}

/** Runs a stage and reads what the page did during it, then what it holds after. */
async function measureStage(
  { app, page, session }: { app: ElectronApplication; page: Page; session: CDPSession },
  name: string,
  stage: () => Promise<void>,
  { countsWhatCameBefore = false } = {}
): Promise<ResultRow> {
  if (!countsWhatCameBefore) await readPageLog(page);
  const startedAt = Date.now();
  await stage();
  const ms = Date.now() - startedAt;
  const { longTasks, frameGaps } = await readPageLog(page);
  return {
    name,
    ms,
    runsShown: await countRunsShown(page),
    longTasks: longTasks.length,
    longestTaskMs: Math.round(Math.max(0, ...longTasks)),
    lateFrames: frameGaps.filter((gap) => gap > LATE_FRAME_MS).length,
    ...(await readMemory(app, session)),
  };
}

/** Goes to the top until it has found no older messages for a while. */
function scrollBackToTheStart(page: Page) {
  // In the page and asking only its first turn: searching all of it from here each time costs
  // more than the pages landing, and would be what this measures.
  return conversationOf(page).evaluate(
    (conversation, { firstAsk, nothingNewMs }) =>
      new Promise<void>((resolve) => {
        let lastHeight = -1;
        let lastGrewAt = performance.now();
        const step = () => {
          conversation.scrollTo({ top: 0 });
          const isAtStart = conversation.firstElementChild?.firstElementChild?.textContent;
          if (isAtStart?.includes(firstAsk)) return resolve();
          if (conversation.scrollHeight !== lastHeight) lastGrewAt = performance.now();
          lastHeight = conversation.scrollHeight;
          if (performance.now() - lastGrewAt > nothingNewMs) return resolve();
          requestAnimationFrame(step);
        };
        step();
      }),
    { firstAsk: 'What stands out in part 1?', nothingNewMs: NOTHING_NEW_MS }
  );
}

/** Goes to the end of what is held until that is the newest of the log. */
function scrollBackToTheEnd(page: Page) {
  return conversationOf(page).evaluate(
    (conversation, { lastAsk, nothingNewMs }) =>
      new Promise<void>((resolve) => {
        let lastHeight = -1;
        let lastGrewAt = performance.now();
        const step = () => {
          conversation.scrollTo({ top: conversation.scrollHeight });
          const turns = conversation.firstElementChild?.children;
          const newest = turns ? [...turns].slice(-3) : [];
          if (newest.some((turn) => turn.textContent?.includes(lastAsk))) return resolve();
          if (conversation.scrollHeight !== lastHeight) lastGrewAt = performance.now();
          lastHeight = conversation.scrollHeight;
          if (performance.now() - lastGrewAt > nothingNewMs) return resolve();
          requestAnimationFrame(step);
        };
        step();
      }),
    { lastAsk: `What stands out in part ${MESSAGES / 4}?`, nothingNewMs: NOTHING_NEW_MS }
  );
}

/** Fast wheel turns through what is held, as a hand would. */
async function wheelThrough(page: Page, direction: 1 | -1) {
  const box = await conversationOf(page).boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  for (let notch = 0; notch < WHEEL_NOTCHES; notch++) {
    await page.mouse.wheel(0, direction * WHEEL_PX);
    await page.waitForTimeout(WHEEL_DELAY_MS);
  }
}

test('a conversation of 2,000 messages', async () => {
  const { app, page } = mosaic();
  // With no resume open, the start screen covers the pane and takes the wheel.
  await runDevTool(page, 'exampleResume');
  await runDevTool(page, 'longConversation', { messages: MESSAGES });
  const lastAsk = `What stands out in part ${MESSAGES / 4}?`;
  await expect(conversationOf(page).getByText(lastAsk)).toBeVisible({ timeout: 60_000 });

  const session = await page.context().newCDPSession(page);
  await session.send('HeapProfiler.enable');
  const watch = { app, page, session };

  const reloadedAt = Date.now();
  await page.reload();
  await expect(conversationOf(page).getByText(lastAsk)).toBeVisible({ timeout: 60_000 });
  const reloadMs = Date.now() - reloadedAt;
  await startPageLog(page);
  await page.waitForTimeout(500);

  const rows: ResultRow[] = [
    {
      ...(await measureStage(watch, 'reopened', () => page.waitForTimeout(0), {
        countsWhatCameBefore: true,
      })),
      ms: reloadMs,
    },
    await measureStage(watch, 'wheel up', () => wheelThrough(page, -1)),
    await measureStage(watch, 'back to the first message', async () => {
      await scrollBackToTheStart(page);
      await expect(conversationOf(page).getByText('What stands out in part 1?')).toHaveCount(1);
    }),
    await measureStage(watch, 'wheel down', () => wheelThrough(page, 1)),
    await measureStage(watch, 'back to the newest', () => scrollBackToTheEnd(page)),
  ];
  const reachedEnd = await conversationOf(page).getByText(lastAsk).count();
  console.log(reachedEnd ? 'Came back to the newest message.' : 'Never came back to the newest.');

  await scrollBackToTheStart(page);
  await runDevTool(page, 'scriptedModel', { isOn: true });
  const box = page
    .getByRole('complementary', { name: 'Assistant' })
    .getByRole('textbox', { name: 'Message' });
  await box.fill('Tighten my bullets.');
  rows.push(
    await measureStage(watch, 'a send from the first message', async () => {
      await box.press('Enter');
      await expect(
        conversationOf(page).getByText('Done. They’re waiting for your review.')
      ).toBeInViewport({ timeout: 30_000 });
    })
  );

  reportAgainstLastRun(rows, COLUMNS, RESULTS, 'stage');
});
