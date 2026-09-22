import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

const RESUME = [
  'Ada Lovelace',
  'ada@example.com',
  '',
  'Experience',
  'Analyst, Engine Works',
  '- First bullet about the engine',
  '- Second bullet about the engine',
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

test('Ctrl+/ opens the sheet, and keys pressed in its search say what they do', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.keyboard.press('Control+/');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();

  const search = sheet.getByRole('textbox', { name: 'Search shortcuts' });
  await search.fill('export');
  await expect(sheet.getByText('1 action')).toBeVisible();

  // A lookup, not a command: the Export dialog stays shut.
  await search.press('Control+e');
  const answer = sheet.getByRole('region', { name: 'You pressed' });
  await expect(answer).toContainText('is Export…');
  await expect(page.getByRole('dialog', { name: /^Export/ })).toHaveCount(0);
  await search.press('Control+Shift+j');
  await expect(answer).toContainText('isn’t bound to anything');
  expect(errors).toEqual([]);
});

test('the app’s own keys reach it: export, import, zoom and a new section', async () => {
  const { page, errors } = mosaic();
  await importResume(page);

  await page.keyboard.press('Control+e');
  await expect(page.getByRole('dialog', { name: /^Export/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /^Export/ })).toHaveCount(0);

  await page.keyboard.press('Control+o');
  await expect(page.getByRole('dialog', { name: 'Import' })).toBeVisible();
  await page.keyboard.press('Escape');

  const zoom = page.getByRole('button', { name: 'Reset zoom' });
  await expect(zoom).toHaveText('100%');
  await page.keyboard.press('Control+=');
  await expect(zoom).toHaveText('115%');
  await page.keyboard.press('Control+0');
  await expect(zoom).toHaveText('100%');

  await page.keyboard.press('Control+Shift+N');
  await expect(page.getByRole('menuitem', { name: /Projects/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a bullet moves with Alt+arrows and goes with Ctrl+Backspace', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = () => sidebar.getByText(/^(First|Second) bullet/).allTextContents();

  const second = sidebar
    .getByText('Second bullet about the engine')
    .locator('xpath=ancestor::div[contains(@class,"group/bullet")][1]');
  await second.getByRole('checkbox').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect
    .poll(bullets)
    .toEqual(['Second bullet about the engine', 'First bullet about the engine']);

  await second.getByRole('checkbox').focus();
  await page.keyboard.press('Control+Backspace');
  await expect.poll(bullets).toEqual(['First bullet about the engine']);
  expect(errors).toEqual([]);
});
