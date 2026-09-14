import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

test('the status bar keeps autosave, history, and the page apart', async () => {
  const { page, errors } = mosaic();
  const bar = page.getByRole('contentinfo');
  await expect(bar.getByText('No resume open')).toBeVisible();

  await page.getByRole('button', { name: /Blank resume/ }).click();
  await expect(bar.getByText(/^Autosaved · just now$/)).toBeVisible();
  await expect(bar.getByText('Matches v1')).toBeVisible();
  await expect(bar.getByText('0 words')).toBeVisible();
  await expect(bar.getByText('1 page · A4')).toBeVisible();

  // An edit: the words follow the page, and the draft no longer matches v1.
  await page.getByText('Your name', { exact: true }).click();
  await page.getByPlaceholder('Your name').fill('Ada Lovelace');
  await page.getByPlaceholder('Your name').press('Enter');
  await expect(bar.getByText('2 words')).toBeVisible();
  await expect(bar.getByText('Edited since v1')).toBeVisible();

  await page.getByRole('button', { name: 'Switch paper size to US Letter' }).click();
  await expect(bar.getByText('1 page · Letter')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the sidebar hides and comes back from the status bar or Ctrl+B', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const contentTab = page.getByRole('button', { name: 'Content' });
  const toggle = page.getByRole('button', { name: 'Toggle sidebar' });

  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(contentTab).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Control+b');
  await expect(contentTab).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect(contentTab).toHaveCount(0);
  await toggle.click();
  await expect(contentTab).toBeVisible();
});
