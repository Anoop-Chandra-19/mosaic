import { expect, test, type Page } from '@playwright/test';
import { launchApp, withApp } from './launch';

const mosaic = withApp({ showTour: true });

const TITLES = [
  'Welcome to Mosaic',
  'Edit content, not a document',
  'The page you will actually send',
  'History keeps itself',
  'Name version',
  'One template per story you tell',
  'Take it anywhere',
];
const TARGETS = [null, 'content', 'preview', 'history', 'name-version', 'templates', 'export'];

const card = (page: Page, title: string) =>
  page.getByRole('dialog', { name: new RegExp(`^${title}`) });

async function startSample(page: Page) {
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
}

/** The spotlight stands 4px off every side of its target, once it has moved there. */
async function expectSpotlightOn(page: Page, target: string) {
  await expect
    .poll(() =>
      page.evaluate((name) => {
        const box = document.querySelector(`[data-tour="${name}"]`)?.getBoundingClientRect();
        const spot = document.querySelector('[data-tour-spot]')?.getBoundingClientRect();
        // Drawn a frame after the step changes.
        if (!box || !spot) return Infinity;
        return Math.max(
          Math.abs(spot.left - (box.left - 4)),
          Math.abs(spot.top - (box.top - 4)),
          Math.abs(spot.width - (box.width + 8)),
          Math.abs(spot.height - (box.height + 8))
        );
      }, target)
    )
    .toBeLessThan(1);
}

test('starts once the first resume is in the editor, and walks every step', async () => {
  const { page, errors } = mosaic();
  // Over the Start panel there is nothing to point at yet.
  await expect(page.getByRole('button', { name: /Start from a sample/ })).toBeVisible();
  await expect(card(page, TITLES[0])).toBeHidden();

  await startSample(page);
  await expect(card(page, TITLES[0])).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip the tour' })).toBeVisible();

  for (let index = 1; index < TITLES.length; index++) {
    await page.keyboard.press('ArrowRight');
    // History is on the Templates tab: the card waits while the tour leads there.
    if (index === 3) await expect(card(page, TITLES[index])).toBeHidden();
    await expect(card(page, TITLES[index])).toBeVisible();
    await expectSpotlightOn(page, TARGETS[index]!);
  }

  await page.keyboard.press('ArrowLeft');
  await expect(card(page, TITLES[5])).toBeVisible();
  await page.getByRole('button', { name: `Step 3: ${TITLES[2]}` }).click();
  await expect(card(page, TITLES[2])).toBeVisible();
  await page.getByRole('button', { name: `Step 7: ${TITLES[6]}` }).click();

  // Focus sits on the card's own button, so Enter presses it.
  await page.keyboard.press('Enter');
  await expect(card(page, TITLES[6])).toBeHidden();
  await expect(
    page.getByText('Tour finished. Replay it any time from Settings › About.')
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('pressing on while it leads to another tab skips the way there, not the step', async () => {
  const { page, errors } = mosaic();
  await startSample(page);
  await page.getByRole('button', { name: `Step 3: ${TITLES[2]}` }).click();
  await expect(card(page, TITLES[2])).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(card(page, TITLES[3])).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Templates' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expectSpotlightOn(page, 'history');
  expect(errors).toEqual([]);
});

test('Esc ends it for good, and About replays it', async () => {
  const { app, page, userDataDir, errors } = mosaic();
  await startSample(page);
  await expect(card(page, TITLES[0])).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page, TITLES[0])).toBeHidden();
  expect(errors).toEqual([]);
  await app.close();

  const again = await launchApp(userDataDir, { showTour: true });
  try {
    await expect(again.page.getByRole('button', { name: 'Name version…' })).toBeVisible();
    await expect(card(again.page, TITLES[0])).toBeHidden();

    await again.page.keyboard.press('Control+,');
    await again.page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('navigation')
      .getByRole('button', { name: 'About' })
      .click();
    await again.page.getByRole('button', { name: 'Replay' }).click();
    await expect(card(again.page, TITLES[0])).toBeVisible();
    expect(again.errors).toEqual([]);
  } finally {
    await again.app.close();
  }
});

test('waits under a dialog, and leaves typing alone', async () => {
  const { page, errors } = mosaic();
  await startSample(page);
  await page.keyboard.press('ArrowRight');
  await expect(card(page, TITLES[1])).toBeVisible();

  await page.keyboard.press('Control+,');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(card(page, TITLES[1])).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(card(page, TITLES[1])).toBeVisible();

  // The spotlit editor still edits: arrows in a field move the caret, not the tour.
  await page.getByRole('complementary').getByText('Your Name').first().click();
  await page.getByPlaceholder('Your name').press('ArrowLeft');
  await expect(card(page, TITLES[1])).toBeVisible();
  expect(errors).toEqual([]);
});
