import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

const FIRST = 'Kept the dispatch queue under a second at peak.';
const SECOND = 'Cut the nightly batch from four hours to forty minutes.';

const RESUME = [
  'Ada Lovelace',
  '',
  'Experience',
  'Analyst, Engine Works',
  `- ${FIRST}`,
  `- ${SECOND}`,
].join('\n');

async function importResume(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByLabel('Or paste the text').fill(RESUME);
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

async function openBulletMenu(page: Page, text: string) {
  const row = page.getByRole('complementary').locator('.group\\/bullet', { hasText: text });
  await row.hover();
  await row.getByRole('button', { name: 'Bullet actions' }).click();
}

function countRowMotions(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector('aside')!
        .getAnimations({ subtree: true })
        .filter((animation) => animation.id === 'row-motion').length
  );
}

test('a deleted bullet fades where it was, then goes; a moved one slides', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');

  await openBulletMenu(page, FIRST);
  await page.getByRole('menuitem', { name: 'Delete bullet' }).click();
  // A copy, out of reach, stays a moment where the bullet was.
  const leaving = sidebar.locator('[inert]', { hasText: FIRST });
  await expect(leaving).toHaveCount(1);
  await expect(leaving).toHaveCount(0);
  await expect(sidebar.getByText(FIRST)).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(sidebar.getByText(FIRST)).toBeVisible();
  await openBulletMenu(page, FIRST);
  await page.getByRole('menuitem', { name: 'Move down' }).click();
  expect(await countRowMotions(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('with reduced motion rows change places at once', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await importResume(page);
  const sidebar = page.getByRole('complementary');

  await openBulletMenu(page, FIRST);
  await page.getByRole('menuitem', { name: 'Move down' }).click();
  expect(await countRowMotions(page)).toBe(0);

  await openBulletMenu(page, FIRST);
  await page.getByRole('menuitem', { name: 'Delete bullet' }).click();
  expect(await sidebar.locator('[inert]', { hasText: FIRST }).count()).toBe(0);
  expect(errors).toEqual([]);
});
