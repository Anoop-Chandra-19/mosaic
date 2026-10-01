/**
 * Types into a bullet of a 1-, 3-, and 7-page resume in the built app, a key every 60ms,
 * and reports how the editor and the live preview kept up.
 */
import { expect, type Page } from '@playwright/test';
import { test, withApp } from '../../e2e/launch';

const mosaic = withApp();

/** Bullets that make a resume of about 1, 3, and 7 A4 pages. */
const RESUME_SIZES = [12, 40, 130];
const TYPED = ' and a few words more, typed quickly at the end';
const KEY_DELAY_MS = 60;
/** Past this, a key is late enough to feel. */
const KEY_BUDGET_MS = 50;

const bullet = (index: number) =>
  `- Wrote program ${index} for the analytical engine, checking every step of it by hand against the tables computed the long way, and wrote down whatever differed.`;

async function importResume(page: Page, bullets: number) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  const text = ['Ada Lovelace', 'ada@example.com', '', 'Experience', 'Analyst, Engine Works'];
  await importing
    .getByLabel('Or paste the text')
    .fill([...text, ...Array.from({ length: bullets }, (_, i) => bullet(i))].join('\n'));
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

/** A fixed loop in the page: how fast this run's renderer is, to compare runs by. */
const timePageLoop = (page: Page) =>
  page.evaluate(() => {
    const start = performance.now();
    let sum = 0;
    for (let i = 0; i < 2e7; i++) sum += i;
    return Math.round(performance.now() - start) + (sum < 0 ? 1 : 0);
  });

interface TypingLog {
  /** Key and input events slower than a frame: input to the next paint. */
  slowEvents: number[];
  previewChanges: number[];
}

for (const bullets of RESUME_SIZES) {
  test(`typing into a ${bullets}-bullet resume`, async () => {
    const { page } = mosaic();
    await importResume(page, bullets);
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
