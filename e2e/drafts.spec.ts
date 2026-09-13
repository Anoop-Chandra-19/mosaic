import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { launchApp, withApp } from './launch';

async function startBlank(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await expect(page.getByRole('banner').getByText('Untitled resume')).toBeVisible();
}

async function typeName(page: Page, name: string) {
  await page.getByText('Your name', { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('Your name').press('Enter');
}

test('a draft survives quitting and relaunching', async () => {
  const first = await launchApp();
  const { userDataDir } = first;
  try {
    await startBlank(first.page);
    await typeName(first.page, 'Ada Lovelace');
    // Quit well inside the save delay: the close waits for the renderer to save.
    await first.app.close();

    const second = await launchApp(userDataDir);
    try {
      await expect(second.page.getByRole('heading', { name: /Start your/ })).toBeHidden();
      await expect(second.page.getByRole('banner').getByText('Untitled resume')).toBeVisible();
      await expect(second.page.getByText('Ada Lovelace').first()).toBeVisible();
      expect(second.errors).toEqual([]);
    } finally {
      await second.app.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

const mosaic = withApp();

test('naming a version makes the draft up to date', async () => {
  const { page } = mosaic();
  await startBlank(page);
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill('First draft');
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText('Named “First draft”')).toBeVisible();

  const banner = page.getByRole('banner');
  await expect(banner.getByText('up to date')).toBeVisible();
  await typeName(page, 'Grace Hopper');
  await expect(banner.getByText('edited')).toBeVisible();
});

test('the last template can be deleted, leaving nothing open', async () => {
  const { page } = mosaic();
  await startBlank(page);

  await page.getByRole('button', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Options for Untitled resume' }).click();
  await page.getByRole('menuitem', { name: 'Delete template…' }).click();
  const confirm = page.getByRole('dialog');
  await expect(
    confirm.getByText(/your last one, so Mosaic will be left with nothing open/)
  ).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete template' }).click();

  // No Start panel mid-session: the app just has nothing open.
  await expect(page.getByRole('heading', { name: /Start your/ })).toBeHidden();
  await expect(page.getByRole('banner').getByText('No resume open')).toBeVisible();
  await expect(page.getByText('No templates', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Start a resume' }).click();
  await expect(page.getByRole('banner').getByText('Untitled resume')).toBeVisible();
});
