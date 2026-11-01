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
  const rendererKb = await app.evaluate(({ app, BrowserWindow }) => {
    const pid = BrowserWindow.getAllWindows()[0].webContents.getOSProcessId();
    return app.getAppMetrics().find((metric) => metric.pid === pid)?.memory.workingSetSize ?? 0;
  });
  return {
    heapMb: Math.round(usedSize / 1024 / 1024),
    rendererMb: Math.round(rendererKb / 1024),
    domNodes: nodes,
  };
}

/** Runs a stage and reads what the page did during it, then what it holds after. */
async function measureStage(
  { app, page, session }: { app: ElectronApplication; page: Page; session: CDPSession },
  name: string,
  stage: () => Promise<void>
): Promise<ResultRow> {
  await readPageLog(page);
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

/** Fast wheel turns through what is loaded, as a hand would. */
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
      ...(await measureStage(watch, 'reopened', () => page.waitForTimeout(0))),
      ms: reloadMs,
    },
    await measureStage(watch, 'wheel up', () => wheelThrough(page, -1)),
    await measureStage(watch, 'back to the first message', () => scrollBackToTheStart(page)),
    await measureStage(watch, 'wheel down', () => wheelThrough(page, 1)),
  ];

  reportAgainstLastRun(rows, COLUMNS, RESULTS, 'stage');
  const reachedStart = await conversationOf(page).getByText('What stands out in part 1?').count();
  console.log(reachedStart ? 'Reached the first message.' : 'Never reached the first message.');
});
