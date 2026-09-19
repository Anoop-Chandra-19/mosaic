import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** Replace the contact name, whatever it is now. */
async function setName(page: Page, current: string, next: string) {
  await page.getByRole('complementary').getByText(current, { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(next);
  await page.getByPlaceholder('Your name').press('Enter');
}

async function nameVersion(page: Page, name: string) {
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
}

test('a version can be read in the sheet, then restored', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await nameVersion(page, 'Sent to Striped');
  await setName(page, 'Ada Lovelace', 'Grace Hopper');

  await page.getByRole('tab', { name: 'Templates' }).click();
  // The open template's history is showing: its creation, and the named version on top.
  await expect(page.getByText('Working draft · saved as you type.')).toBeVisible();
  const named = page.getByRole('listitem').filter({ hasText: 'Sent to Striped' });
  await expect(named).toContainText('named');

  // Row actions show on hover, as they do for a pointer.
  await named.hover();
  await named.getByRole('button', { name: 'Preview v2' }).click();
  const sheet = page.getByRole('main');
  await expect(sheet.getByText('Previewing v2')).toBeVisible();
  await expect(sheet.getByText('1 line differs from your draft')).toBeVisible();
  await expect(sheet.getByText('Ada Lovelace').first()).toBeVisible();

  await sheet.getByRole('button', { name: 'Restore this version' }).click();
  await expect(page.getByText('Restored “Sent to Striped”')).toBeVisible();
  await expect(sheet.getByText('Live Preview')).toBeVisible();
  await expect(page.getByText('Restored "Sent to Striped"', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Content' }).click();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();
});

test('a version can be duplicated as its own template', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await nameVersion(page, 'First');

  await page.getByRole('tab', { name: 'Templates' }).click();
  const named = page.getByRole('listitem').filter({ hasText: 'First' });
  await named.hover();
  await named.getByRole('button', { name: 'Duplicate v2 as a new template' }).click();

  await expect(page.getByText('Duplicated as “Untitled resume (copy)”')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
});

test('templates can be found by name', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  await page.getByLabel('Find a template').fill('backend');
  await expect(page.getByText('No template is named like “backend”.')).toBeVisible();
  await page.getByLabel('Find a template').fill('untitled');
  await expect(page.getByRole('button', { name: 'Options for Untitled resume' })).toBeVisible();
});
