/**
 * Types into a bullet of a 1-, 3-, and 7-page resume in the built app, a key every 60ms,
 * and reports how the editor and the live preview kept up.
 */
import { expect, type ElectronApplication, type Page } from '@playwright/test';
import { test, withApp } from '../../e2e/harness/launch';
import { importLargeResume } from '../large-resume';

const mosaic = withApp();

/** Bullets that make a resume of about 1, 3, and 7 A4 pages. */
const RESUME_SIZES = [12, 40, 130];
const TYPED = ' and a few words more, typed quickly at the end';
const KEY_DELAY_MS = 60;
/** Past this, a key is late enough to feel. */
const KEY_BUDGET_MS = 50;

/** A fixed loop in the page: how fast this run's renderer is, to compare runs by. */
const timePageLoop = (page: Page) =>
  page.evaluate(() => {
    const start = performance.now();
    let sum = 0;
    for (let i = 0; i < 2e7; i++) sum += i;
    return Math.round(performance.now() - start) + (sum < 0 ? 1 : 0);
  });

const REPLY_PARAGRAPH =
  'Led the billing migration with **two teams**, and the numbers read well.\n\n- Cut invoice errors by a third\n- Moved `nightly` runs to one queue\n\nThe summary could say more about who you led, and the first bullet repeats the second.\n\n';
/** Enough to outlast the typing, and about 10,000 characters: a very long reply. */
const REPLY_REPEATS = 45;
const REPLY_PIECE_CHARS = 6;
const REPLY_PIECE_DELAY_MS = 8;
/** Past this, a 60-a-second frame was missed. */
const LATE_FRAME_MS = 25;

interface StreamLog {
  slowEvents: number[];
  replyChanges: number[];
  longTasks: number[];
  frameGaps: number[];
}

interface TypingLog {
  /** Key and input events slower than a frame: input to the next paint. */
  slowEvents: number[];
  previewChanges: number[];
}

/** A long reply from a fast model: the server answers in small pieces, close together. */
async function streamLongRepliesFromTheServer(app: ElectronApplication) {
  await app.evaluate(
    ({ net }, { paragraph, repeats, pieceChars, pieceDelayMs }) => {
      const words = paragraph.repeat(repeats);
      const sse = (delta: object, finish: string | null = null) =>
        `data: ${JSON.stringify({
          id: 'check',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'check',
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`;
      net.fetch = async (input) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.endsWith('/v1/models')) return Response.json({ data: [] });
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          async start(controller) {
            for (let at = 0; at < words.length; at += pieceChars) {
              const content = words.slice(at, at + pieceChars);
              controller.enqueue(encoder.encode(sse({ role: 'assistant', content })));
              await new Promise((resolve) => setTimeout(resolve, pieceDelayMs));
            }
            controller.enqueue(encoder.encode(`${sse({}, 'stop')}data: [DONE]\n\n`));
            controller.close();
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
      };
    },
    {
      paragraph: REPLY_PARAGRAPH,
      repeats: REPLY_REPEATS,
      pieceChars: REPLY_PIECE_CHARS,
      pieceDelayMs: REPLY_PIECE_DELAY_MS,
    }
  );
}

async function askTheServerAboutTheResume(page: Page) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Provider' }).click();
  await page.getByRole('menuitemradio', { name: /^OpenAI-compatible/ }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
  const box = page
    .getByRole('complementary', { name: 'Assistant' })
    .getByRole('textbox', { name: 'Message' });
  await box.fill('What stands out?');
  await box.press('Enter');
}

test('typing while a long reply streams', async () => {
  const { app, page } = mosaic();
  await streamLongRepliesFromTheServer(app);
  await importLargeResume(page, 40);
  await askTheServerAboutTheResume(page);
  const conversation = page.getByRole('region', { name: 'Conversation' });
  await expect(conversation.getByText('Led the billing', { exact: false }).first()).toBeVisible();
  await page.evaluate(() => {
    const log: StreamLog = { slowEvents: [], replyChanges: [], longTasks: [], frameGaps: [] };
    (window as unknown as { streamLog: StreamLog }).streamLog = log;
    let lastFrameAt = performance.now();
    const noteFrame = (now: number) => {
      log.frameGaps.push(now - lastFrameAt);
      lastFrameAt = now;
      requestAnimationFrame(noteFrame);
    };
    requestAnimationFrame(noteFrame);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (['keydown', 'keypress', 'input'].includes(entry.name)) {
          log.slowEvents.push(entry.duration);
        }
      }
    }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) log.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
    new MutationObserver(() => log.replyChanges.push(performance.now())).observe(
      document.querySelector('[aria-label="Conversation"]')!,
      { subtree: true, childList: true, characterData: true }
    );
  });

  const sidebar = page.getByRole('complementary').filter({ hasText: 'Wrote program 5 for' });
  await sidebar.getByText('Wrote program 5 for').click();
  const box = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await box.press('End');
  await box.pressSequentially(TYPED, { delay: KEY_DELAY_MS });
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0, { timeout: 60_000 });
  const log = await page.evaluate(() => (window as unknown as { streamLog: StreamLog }).streamLog);

  const slowest = Math.round(Math.max(0, ...log.slowEvents));
  const seconds = (log.replyChanges.at(-1)! - log.replyChanges[0]) / 1000;
  console.log(
    [
      'while streaming',
      `slowest key ${slowest}ms${slowest > KEY_BUDGET_MS ? ' (over budget)' : ''}`,
      `reply redrew ${Math.round(log.replyChanges.length / seconds)} times a second`,
      `${log.frameGaps.filter((gap) => gap > LATE_FRAME_MS).length} of ${log.frameGaps.length} frames late`,
      `${log.longTasks.length} long tasks, ${Math.round(log.longTasks.reduce((sum, ms) => sum + ms, 0))}ms in all`,
    ].join(' · ')
  );
});

for (const bullets of RESUME_SIZES) {
  test(`typing into a ${bullets}-bullet resume`, async () => {
    const { page } = mosaic();
    await importLargeResume(page, bullets);
    const sheets = page.locator('[data-preview-page-content]');
    const pages = await sheets.count();

    const sidebar = page.getByRole('complementary');
    await sidebar.getByText('Wrote program 5 for').click();
    const box = sidebar.getByRole('textbox', { name: 'Bullet text' });
    await box.press('End');
    await page.evaluate(() => {
      const log: TypingLog = { slowEvents: [], previewChanges: [] };
      (window as unknown as { typingLog: TypingLog }).typingLog = log;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (['keydown', 'keypress', 'input'].includes(entry.name)) {
            log.slowEvents.push(entry.duration);
          }
        }
      }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
      new MutationObserver(() => log.previewChanges.push(performance.now())).observe(
        document.querySelector('[data-preview-stack]')!,
        { subtree: true, childList: true, characterData: true }
      );
    });

    await box.pressSequentially(TYPED, { delay: KEY_DELAY_MS });
    const lastKeyAt = await page.evaluate(() => performance.now());
    await expect(sheets.filter({ hasText: TYPED.trim() })).toHaveCount(1);
    await page.waitForTimeout(300);
    const log = await page.evaluate(
      () => (window as unknown as { typingLog: TypingLog }).typingLog
    );
    // Last: under heavy load a long task in the page has frozen its renderer, in Mosaic
    // builds from before the live preview too.
    const loopMs = await timePageLoop(page);

    const slowest = Math.round(Math.max(0, ...log.slowEvents));
    // Changes within 10ms of each other are one update.
    const updates = new Set(log.previewChanges.map((at) => Math.round(at / 10))).size;
    const caughtUp = Math.max(0, Math.round((log.previewChanges.at(-1) ?? lastKeyAt) - lastKeyAt));
    console.log(
      [
        `${pages} page${pages === 1 ? '' : 's'}`,
        `page loop ${loopMs}ms`,
        `slowest key ${slowest}ms${slowest > KEY_BUDGET_MS ? ' (over budget)' : ''}`,
        `preview updated ${updates} times for ${TYPED.length} keys`,
        `caught up ${caughtUp}ms after the last key`,
      ].join(' · ')
    );
  });
}
