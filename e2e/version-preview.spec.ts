import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

async function nameVersion(page: Page, version: string) {
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(version);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${version}”`)).toBeVisible();
}

/** First, then a draft that leaves one bullet off and deletes another. */
async function startWithTrimmedDraft(page: Page) {
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  await nameVersion(page, 'First');
  await page.getByRole('checkbox', { name: 'Toggle bullet visibility' }).nth(1).click();
  const bullet = page
    .getByRole('complementary')
    .locator('.group\\/bullet', { hasText: 'Built REST APIs' });
  await bullet.hover();
  await bullet.getByRole('button', { name: 'Bullet actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete bullet' }).click();
}

/** The marks drawn on the sheet, not on the preview's offscreen copy. */
const pageMarks = (page: Page) =>
  page.getByRole('main').locator('[data-preview-stack] [data-change-id]');

test('a version read in the sheet is marked against the draft and stepped through', async () => {
  const { page, errors } = mosaic();
  await startWithTrimmedDraft(page);

  await page.getByRole('tab', { name: 'Templates' }).click();
  const first = page.getByRole('listitem').filter({ hasText: 'First' });
  await first.hover();
  await first.getByRole('button', { name: /^Read v\d+$/ }).click();
  const sheet = page.getByRole('main');
  await expect(
    sheet.getByText(/^Compared with your draft, it has 2 extra bullets in /)
  ).toBeVisible();
  await expect(first).toContainText('differs in 2 places');
  await expect(sheet).toContainText('2 places');
  await expect(pageMarks(page).first()).toBeVisible();

  // The bar in the margin says on hover what the line does.
  const bar = await sheet.locator('[data-preview-stack] .w-\\[2\\.5px\\]').first().boundingBox();
  if (!bar) throw new Error('No bar in the margin');
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await expect(page.getByRole('tooltip', { name: /in your draft/ })).toBeAttached();
  await page.mouse.move(0, 0);

  await sheet.getByRole('button', { name: 'Next place' }).click();
  await expect(sheet).toContainText('1 of 2');
  await sheet.getByRole('button', { name: 'Previous place' }).click();
  await expect(sheet).toContainText('2 of 2');

  // The clean page has no marks; stepping puts them back, since a place is shown by its mark.
  await sheet.getByRole('button', { name: 'Hide marks' }).click();
  await expect(pageMarks(page)).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Next place' }).click();
  await expect(sheet).toContainText('1 of 2');
  await expect(sheet.getByRole('button', { name: 'Hide marks' })).toBeVisible();
  await expect(pageMarks(page).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Full history opens on the version read, against the draft, without remembering it', async () => {
  const { page, errors } = mosaic();
  await startWithTrimmedDraft(page);
  await nameVersion(page, 'Second');

  await page.getByRole('tab', { name: 'Templates' }).click();
  const first = page.getByRole('listitem').filter({ hasText: 'First' });
  await first.hover();
  await first.getByRole('button', { name: /^Read v\d+$/ }).click();
  await page.getByRole('main').getByRole('button', { name: 'Full history' }).click();

  const view = page.getByRole('region', { name: /^History of/ });
  const reading = view.getByRole('complementary');
  await expect(reading.getByRole('heading', { name: 'First', exact: true })).toBeVisible();
  await expect(reading.getByRole('radio', { name: 'Against your draft' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);

  // Opened again on its own, the view compares as it was last left: with the version before.
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  await view.locator('li[data-version-id]').filter({ hasText: 'Second' }).click();
  await expect(
    view.getByRole('complementary').getByRole('radio', { name: /^Changes in v\d+$/ })
  ).toBeChecked();
  expect(errors).toEqual([]);
});
