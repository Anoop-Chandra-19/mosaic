import { expect, type Locator, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

const BULLETS = [
  'Kept the dispatch queue under a second at peak, across every region the company ran in and through every holiday rush.',
  'Cut the nightly batch from four hours to forty minutes by moving it onto the event stream the rest of the platform used.',
  'Wrote the runbook the on-call rotation still uses, and paired with each new engineer through their first incident.',
];

async function importResume(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  const lines = ['Ada Lovelace', '', 'Experience'];
  for (let i = 1; i <= 6; i++)
    lines.push(`Analyst ${i}, Engine Works`, ...BULLETS.map((b) => `- ${b}`));
  await importing.getByLabel('Or paste the text').fill(lines.join('\n'));
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

async function nameVersion(page: Page, name: string) {
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Long, then Short: each entry's first bullet gone and the rest cut to five words, so every
 * line sits higher.
 */
async function startWithTwoLengths(page: Page) {
  await importResume(page);
  await nameVersion(page, 'Long');
  const sidebar = page.getByRole('complementary');
  // Not a deleted one fading out, which is inert.
  const firstBullets = sidebar.locator('.group\\/bullet:not([inert], [inert] *)', {
    hasText: BULLETS[0],
  });
  for (let left = await firstBullets.count(); left > 0; left--) {
    await firstBullets.first().hover();
    await firstBullets.first().getByRole('button', { name: 'Bullet actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete bullet' }).click();
    await expect(firstBullets).toHaveCount(left - 1);
  }
  for (const bullet of BULLETS.slice(1)) {
    const rows = sidebar.locator('[data-bullet-text]', { hasText: bullet });
    while ((await rows.count()) > 0) {
      await rows.first().click();
      const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
      await text.fill(bullet.split(' ').slice(0, 5).join(' ') + '.');
      await text.press('Enter');
    }
  }
  await nameVersion(page, 'Short');
  await page.keyboard.press('Control+Shift+H');
  const view = page.getByRole('region', { name: /^History of/ });
  await expect(view).toBeVisible();
  return view;
}

/** The pane's scrolling body, and the drawn page in it. */
const bodyOf = (reading: Locator) => reading.locator('div.overflow-auto:has([data-preview-stack])');

const zoomReadout = (reading: Locator) => reading.getByRole('button', { name: 'Reset zoom' });

test('the history keeps its own zoom, apart from the live preview, through each step', async () => {
  const { page, errors } = mosaic();
  const view = await startWithTwoLengths(page);
  const reading = view.getByRole('complementary');
  await view.getByRole('button', { name: 'Hide the index' }).click();
  await expect(zoomReadout(reading)).toHaveText('100%');

  await reading.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomReadout(reading)).toHaveText('115%');
  await view.locator('li[data-version-id]').filter({ hasText: 'Short' }).click();
  await expect(reading.getByRole('heading', { name: 'Short', exact: true })).toBeVisible();
  await expect(zoomReadout(reading)).toHaveText('115%');

  // The live preview's zoom is its own.
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);
  await expect(zoomReadout(page.getByRole('main'))).toHaveText('100%');

  // A new opening starts at fit again.
  await page.keyboard.press('Control+Shift+H');
  await expect(zoomReadout(view.getByRole('complementary'))).toHaveText('100%');
  expect(errors).toEqual([]);
});

/**
 * Long's clean page at 150%, so Short still runs far enough below any line to scroll it up,
 * read from its `index`th bullet: the first line showing at the top of the pane. Gives how
 * far below the pane's top that bullet, and its entry's heading, sit.
 */
async function readLongFromBullet(view: Locator, index: number) {
  const reading = view.getByRole('complementary');
  await view.getByRole('button', { name: 'Hide the index' }).click();
  await expect(reading.getByRole('heading', { name: 'Long', exact: true })).toBeVisible();
  await reading.getByRole('button', { name: 'Hide the change marks' }).click();
  for (const zoom of ['115%', '130%', '150%']) {
    await reading.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoomReadout(reading)).toHaveText(zoom);
  }
  const body = bodyOf(reading);
  const [bulletSelector, headingSelector] = await body.evaluate((scroller, bulletIndex) => {
    const bullets = scroller.querySelectorAll<HTMLElement>(
      '[data-preview-stack] [data-preview-bullet-id]'
    );
    const target = bullets[bulletIndex];
    const heading = target
      .closest('[data-preview-entry-key]')!
      .querySelector<HTMLElement>('[data-preview-entry-heading-key]')!;
    scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    return [
      `[data-preview-bullet-id="${target.dataset.previewBulletId}"]`,
      `[data-preview-entry-heading-key="${heading.dataset.previewEntryHeadingKey}"]`,
    ];
  }, index);
  const offsetOf = (selector: string) => () =>
    body.evaluate((scroller, lineSelector) => {
      const line = scroller.querySelector(`[data-preview-stack] ${lineSelector}`);
      return line ? line.getBoundingClientRect().top - scroller.getBoundingClientRect().top : null;
    }, selector);
  return {
    reading,
    bulletOffset: offsetOf(bulletSelector),
    headingOffset: offsetOf(headingSelector),
  };
}

async function stepToShort(view: Locator, reading: Locator) {
  await view.locator('li[data-version-id]').filter({ hasText: 'Short' }).click();
  await expect(reading.getByRole('heading', { name: 'Short', exact: true })).toBeVisible();
}

test('stepping to another version keeps the line being read where it was', async () => {
  const { page, errors } = mosaic();
  const view = await startWithTwoLengths(page);
  // Analyst 3's second bullet, which Short has too.
  const { reading, bulletOffset } = await readLongFromBullet(view, 7);
  await expect.poll(bulletOffset).toBeCloseTo(0, 0);

  await stepToShort(view, reading);
  await expect.poll(bulletOffset).toBeCloseTo(0, 0);
  expect(errors).toEqual([]);
});

test('a line gone in the next version leaves its entry heading in its place', async () => {
  const { page, errors } = mosaic();
  const view = await startWithTwoLengths(page);
  // Analyst 3's first bullet, which Short doesn't have.
  const { reading, bulletOffset, headingOffset } = await readLongFromBullet(view, 6);
  await expect.poll(bulletOffset).toBeCloseTo(0, 0);

  await stepToShort(view, reading);
  await expect.poll(bulletOffset).toBeNull();
  await expect.poll(headingOffset).toBeCloseTo(0, 0);
  expect(errors).toEqual([]);
});

test('zooming in from the text read shows the printed page', async () => {
  const { app, page, errors } = mosaic();
  const view = await startWithTwoLengths(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 800));
  const reading = view.getByRole('complementary');
  await expect(reading.getByText('Reading it as text instead.', { exact: false })).toBeVisible();
  await expect(zoomReadout(reading)).toHaveText('Text');
  await expect(reading.getByRole('button', { name: 'Zoom out' })).toBeDisabled();

  await reading.getByRole('button', { name: 'Zoom in' }).click();
  await expect(reading.locator('[data-preview-stack]')).toBeVisible();
  await expect(zoomReadout(reading)).toHaveText('115%');

  // Text goes back to the text read, at fit.
  await reading.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(reading.getByText('Reading it as text instead.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
