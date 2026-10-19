/**
 * How the built app holds up under the worst it should ever see: a resume with every section
 * full (past the ten pages the preview draws), 3,000 versions that really differ, and 50
 * templates with histories of their own; then input faster than it can keep up with, such
 * as a held arrow key. For each flow: how long it took to land, the long tasks (when the
 * page can't answer input), the slowest input, and the frames that came late. Prints a
 * table, and compares it with the last run's, kept in `out/speed-check/last.json`.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import { openWith, saveInto } from '../../e2e/harness/dialogs';
import { test, withApp } from '../../e2e/harness/launch';
import { reportAgainstLastRun, type ResultColumn } from '../compared-results';
import { createFlowProfiler, type FlowProfiler } from './cpuProfile';
import { growHistory, WORST_CASE_BULLETS, worstCaseResumeText } from '../large-resume';

const mosaic = withApp();

const VERSIONS = 3000;
const OTHER_TEMPLATES = 49;
const VERSIONS_PER_OTHER_TEMPLATE = 60;
/** The pages the preview draws at most (`MAX_PREVIEW_PAGES`). */
const PREVIEW_PAGES = 10;
/** Versions stepped through in the full history, a couple of frames apart. */
const STEPS = 20;
/** Versions passed by holding the arrow key: about the repeat rate of a held key. */
const HELD_STEPS = 60;
const KEY_REPEAT_MS = 33;
const TYPED = ' and then some words typed quickly at the end of it';
const TYPING_DELAY_MS = 30;
const SIDEBAR_FLIPS = 10;
const SWITCH_ROUND_TRIPS = 5;
/** A frame this long missed at least one at 60 Hz. */
const LATE_FRAME_MS = 25;
const RESULTS = path.resolve(import.meta.dirname, '../../out/speed-check/last.json');
/** Set by `--profile` (`run-under-load.ts`): a CPU profile of every flow, kept here. */
const IS_PROFILING = process.env.MOSAIC_CHECK_PROFILE === '1';
const PROFILES = path.resolve(import.meta.dirname, '../../out/speed-check/profiles');

interface FlowLog {
  longTasks: number[];
  /** Input to the next paint, for each key or click slower than a frame. */
  inputs: number[];
  /** Gaps between frames longer than `LATE_FRAME_MS`; empty when frames weren't watched. */
  lateFrames: number[];
  isWatchingFrames: boolean;
}

type FlowResult = {
  name: string;
  ms: number;
  longTasks: number;
  blockedMs: number;
  longestTaskMs: number;
  slowestInputMs: number;
  lateFrames: number | null;
  longestFrameMs: number | null;
};

type RecordingWindow = Window & { speedRecording?: { stop: () => FlowLog } };

/**
 * Starts watching the page. `isSinceLoad` also takes what happened since it loaded, which
 * the browser kept, though not the frames: nothing watched them then.
 */
function startRecording(page: Page, isSinceLoad = false) {
  return page.evaluate(
    ({ isSinceLoad, lateFrameMs }) => {
      const log: FlowLog = {
        longTasks: [],
        inputs: [],
        lateFrames: [],
        isWatchingFrames: !isSinceLoad,
      };
      const tasks = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) log.longTasks.push(entry.duration);
      });
      tasks.observe({ type: 'longtask', buffered: isSinceLoad });
      const inputs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEventTiming[]) {
          if (entry.interactionId) log.inputs.push(entry.duration);
        }
      });
      inputs.observe({
        type: 'event',
        durationThreshold: 16,
        buffered: isSinceLoad,
      } as PerformanceObserverInit);
      let isRunning = true;
      let last = performance.now();
      const watchFrame = (now: number) => {
        if (!isRunning) return;
        if (now - last > lateFrameMs) log.lateFrames.push(now - last);
        last = now;
        requestAnimationFrame(watchFrame);
      };
      if (log.isWatchingFrames) requestAnimationFrame(watchFrame);
      (window as RecordingWindow).speedRecording = {
        stop: () => {
          isRunning = false;
          tasks.disconnect();
          inputs.disconnect();
          return log;
        },
      };
    },
    { isSinceLoad, lateFrameMs: LATE_FRAME_MS }
  );
}

const stopRecording = (page: Page) =>
  page.evaluate(() => (window as RecordingWindow).speedRecording!.stop());

const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );

/**
 * Once the view transition running now, if any, has finished. A transition holds back the
 * next change until it ends, so a flow started during one would time the one before it.
 */
const settle = (page: Page) =>
  page.evaluate(async () => {
    const running = (document as Document & { activeViewTransition?: ViewTransition | null })
      .activeViewTransition;
    await running?.finished.catch(() => undefined);
  });

const longest = (values: number[]) => Math.round(Math.max(0, ...values));

function summarize(name: string, ms: number, log: FlowLog): FlowResult {
  return {
    name,
    ms,
    longTasks: log.longTasks.length,
    blockedMs: Math.round(log.longTasks.reduce((sum, task) => sum + task, 0)),
    longestTaskMs: longest(log.longTasks),
    slowestInputMs: longest(log.inputs),
    lateFrames: log.isWatchingFrames ? log.lateFrames.length : null,
    longestFrameMs: log.isWatchingFrames ? longest(log.lateFrames) : null,
  };
}

/** The page being timed, and its profiler when the check runs with `--profile`. */
interface Watch {
  page: Page;
  profiler: FlowProfiler | null;
}

/**
 * Runs `flow` from a settled page while watching it, until it has landed: its transition
 * finished and the next frame drawn.
 */
async function timeFlow({ page, profiler }: Watch, name: string, flow: () => Promise<void>) {
  await settle(page);
  await startRecording(page);
  await profiler?.start();
  const startedAt = Date.now();
  await flow();
  await settle(page);
  await nextFrames(page);
  const ms = Date.now() - startedAt;
  await profiler?.stop(name);
  return summarize(name, ms, await stopRecording(page));
}

/** A reload loses what watched the page, so this one reads what the browser kept instead. */
async function timeReload({ page, profiler }: Watch, name: string) {
  await profiler?.start();
  const startedAt = Date.now();
  await page.reload();
  await page.locator('[data-preview-page-content]').first().waitFor();
  await nextFrames(page);
  const ms = Date.now() - startedAt;
  await profiler?.stop(name);
  await startRecording(page, true);
  return summarize(name, ms, await stopRecording(page));
}

const COLUMNS: ResultColumn[] = [
  { key: 'ms', label: 'time' },
  { key: 'longTasks', label: 'long tasks' },
  { key: 'blockedMs', label: 'blocked' },
  { key: 'longestTaskMs', label: 'longest task' },
  { key: 'slowestInputMs', label: 'slowest input' },
  { key: 'lateFrames', label: 'late frames' },
  { key: 'longestFrameMs', label: 'longest frame' },
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The open template's name, as the top bar shows it. */
const readOpenTemplateName = (page: Page) =>
  page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    const { templates, draft } = boot.value;
    return templates.find((template) => template.id === draft!.templateId)!.name;
  });

// Timed flows wait with `waitFor`, which watches the page as it changes. `expect` retries
// after 100, 250 and 500 ms, and a flow's time would be that schedule instead of the app's.
test('the worst the app should see, and input faster than it keeps up', async () => {
  const { app, page, userDataDir } = mosaic();
  await saveInto(app, userDataDir);
  const watch: Watch = {
    page,
    profiler: IS_PROFILING ? await createFlowProfiler(page, PROFILES) : null,
  };
  const rows: FlowResult[] = [];
  const sidebar = page.getByRole('complementary');
  const history = page.getByRole('region', { name: /^History of / });
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const sheets = page.locator('[data-preview-page-content]');

  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByLabel('Or paste the text').fill(worstCaseResumeText());
  rows.push(
    await timeFlow(watch, `read ${WORST_CASE_BULLETS} pasted bullets`, async () => {
      await importing.getByRole('button', { name: 'Read pasted text' }).click();
      await importing
        .getByRole('button', { name: /^Import/ })
        .last()
        .waitFor();
    })
  );
  rows.push(
    await timeFlow(watch, `import them, ${PREVIEW_PAGES} pages drawn`, async () => {
      await importing
        .getByRole('button', { name: /^Import/ })
        .last()
        .click();
      await sheets.nth(PREVIEW_PAGES - 1).waitFor();
    })
  );

  await growHistory(page, {
    versions: VERSIONS,
    otherTemplates: OTHER_TEMPLATES,
    versionsPerOtherTemplate: VERSIONS_PER_OTHER_TEMPLATE,
  });
  rows.push(await timeReload(watch, `reload: ${OTHER_TEMPLATES + 1} templates`));

  rows.push(
    await timeFlow(watch, `open a history of ${VERSIONS}`, async () => {
      await page.keyboard.press('Control+Shift+H');
      await history.getByText(`Round ${VERSIONS}`).first().waitFor();
    })
  );
  rows.push(
    await timeFlow(watch, `step through ${STEPS} versions`, async () => {
      for (let i = 0; i < STEPS; i++) {
        await page.keyboard.press('ArrowDown');
        await nextFrames(page);
      }
    })
  );
  rows.push(
    await timeFlow(watch, `hold ↓ past ${HELD_STEPS} versions`, async () => {
      for (let i = 0; i < HELD_STEPS; i++) {
        await page.keyboard.press('ArrowDown');
        await pause(KEY_REPEAT_MS);
      }
    })
  );
  rows.push(
    await timeFlow(watch, 'close the full history', async () => {
      await page.keyboard.press('Control+Shift+H');
      await history.waitFor({ state: 'detached' });
    })
  );

  // The history's edits rewrote bullets, so whichever comes first.
  await sidebar.locator('[data-bullet-text]').first().click();
  const bulletText = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await bulletText.press('End');
  rows.push(
    await timeFlow(watch, `type ${TYPED.length} keys fast`, async () => {
      await bulletText.pressSequentially(TYPED, { delay: TYPING_DELAY_MS });
      await sheets.filter({ hasText: TYPED.trim() }).waitFor();
    })
  );
  await page.keyboard.press('Escape');

  rows.push(
    await timeFlow(watch, 'hide the sidebar', async () => {
      await page.keyboard.press('Control+b');
      await sidebar.waitFor({ state: 'detached' });
    })
  );
  rows.push(
    await timeFlow(watch, 'show the sidebar', async () => {
      await page.keyboard.press('Control+b');
      await sidebar.waitFor();
    })
  );
  rows.push(
    await timeFlow(watch, `flip the sidebar ${SIDEBAR_FLIPS} times`, async () => {
      for (let i = 0; i < SIDEBAR_FLIPS; i++) {
        await page.keyboard.press('Control+b');
        await pause(KEY_REPEAT_MS);
      }
      await sidebar.waitFor();
    })
  );

  const largeName = await readOpenTemplateName(page);
  const otherName = `Tailored for company ${Math.ceil(OTHER_TEMPLATES / 2)}`;
  const search = sidebar.getByRole('textbox', { name: 'Find a template' });
  const topBar = page.getByRole('banner');
  const openFromList = async (name: string) => {
    await search.fill(name);
    await sidebar.getByRole('button', { name: 'Open', exact: true }).click();
    await topBar.getByText(name, { exact: true }).waitFor();
  };
  rows.push(
    await timeFlow(watch, `open a list of ${OTHER_TEMPLATES + 1} templates`, async () => {
      await page.getByRole('tab', { name: 'Templates' }).click();
      await sidebar
        .getByRole('button', { name: `Options for Tailored for company ${OTHER_TEMPLATES}` })
        .waitFor({ state: 'attached' });
    })
  );
  rows.push(await timeFlow(watch, 'find one and open it', () => openFromList(otherName)));
  rows.push(
    await timeFlow(watch, `switch back and forth ×${SWITCH_ROUND_TRIPS}`, async () => {
      for (let i = 0; i < SWITCH_ROUND_TRIPS; i++) {
        await openFromList(largeName);
        await openFromList(otherName);
      }
    })
  );
  await openFromList(largeName);
  await search.fill('');
  await page.getByRole('tab', { name: 'Content' }).click();

  rows.push(
    await timeFlow(watch, 'open and close Settings', async () => {
      await page.getByRole('button', { name: 'Open settings' }).click();
      await settings.waitFor();
      await page.keyboard.press('Escape');
      await settings.waitFor({ state: 'detached' });
    })
  );

  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const exporting = page.getByRole('dialog', { name: 'Export' });
  await exporting.getByRole('radio', { name: /^PDF/ }).click();
  rows.push(
    await timeFlow(watch, `save the PDF of ${WORST_CASE_BULLETS} bullets`, async () => {
      await exporting.getByRole('button', { name: 'Save PDF' }).click();
      await page.getByText(/^Saved .*\.pdf$/).waitFor();
    })
  );

  // The PDF just saved, read back: every bullet, laid out as Mosaic prints it.
  const savedName = (await page.getByText(/^Saved .*\.pdf$/).textContent())!.slice('Saved '.length);
  await openWith(app, path.join(userDataDir, savedName));
  await page.getByRole('button', { name: 'Import resume' }).click();
  rows.push(
    await timeFlow(watch, `read the saved PDF of ${WORST_CASE_BULLETS} bullets`, async () => {
      await importing.getByRole('button', { name: 'Choose a file…' }).click();
      await importing
        .getByRole('button', { name: /^Import/ })
        .last()
        .waitFor();
    })
  );

  reportAgainstLastRun(rows, COLUMNS, RESULTS, 'flow');
  console.log(
    `Times in ms. Long tasks ran over 50 ms, blocking input; late frames came over ` +
      `${LATE_FRAME_MS} ms after the one before.`
  );
});
