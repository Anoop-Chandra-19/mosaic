import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openWith, saveInto } from './dialogs';
import { withApp } from './launch';

const mosaic = withApp();

async function openImportExport(page: Page) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'Import & export' }).click();
  return settings;
}

async function setName(page: Page, current: string, next: string) {
  await page.getByRole('complementary').getByText(current, { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(next);
  await page.getByPlaceholder('Your name').press('Enter');
}

test('a full backup restores every template with its history', async () => {
  const { app, page, userDataDir } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill('Sent to Acme');
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();

  await saveInto(app, userDataDir);
  const settings = await openImportExport(page);
  await settings.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/^Backed up to mosaic-backup-\d{4}-\d\d-\d\d\.json$/)).toBeVisible();
  await expect(settings.getByText(/Last backup: just now · 1 template, 2 versions/)).toBeVisible();

  // Readable JSON, with the whole history in it.
  const file = path.join(
    userDataDir,
    fs.readdirSync(userDataDir).find((name) => name.startsWith('mosaic-backup-'))!
  );
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(backup.bundleVersion).toBe(2);
  expect(backup.templates[0].versions.map((v: { summary: string }) => v.summary)).toEqual([
    'Created',
    'Sent to Acme',
  ]);

  // Work done after the backup is what a replacing restore gives up.
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await setName(page, 'Ada Lovelace', 'Grace Hopper');
  await openWith(app, file);
  await (await openImportExport(page)).getByRole('button', { name: 'Restore…' }).click();
  const restore = page.getByRole('dialog', { name: 'Restore a backup' });
  await expect(restore.getByText(path.basename(file))).toBeVisible();
  await expect(restore.getByText(/1 template, 2 versions/)).toBeVisible();
  await restore.getByRole('radio', { name: /Replace everything/ }).click();
  await restore.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.getByText('Restored 1 template from the backup')).toBeVisible();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();

  // Adding keeps what is here and puts the backup's templates beside it.
  await (await openImportExport(page)).getByRole('button', { name: 'Restore…' }).click();
  await restore.getByRole('button', { name: 'Add 1 template' }).click();
  await expect(page.getByText('Added 1 template from the backup')).toBeVisible();
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.getByRole('button', { name: 'Options for Untitled resume' })).toHaveCount(2);
});

test('a file that is not a backup is refused and changes nothing', async () => {
  const { app, page, userDataDir } = mosaic();
  const file = path.join(userDataDir, 'notes.json');
  fs.writeFileSync(file, '{"notes": []}');
  await page.getByRole('button', { name: /Blank resume/ }).click();

  await openWith(app, file);
  const settings = await openImportExport(page);
  await settings.getByRole('button', { name: 'Restore…' }).click();

  await expect(page.getByText('notes.json isn’t a Mosaic backup')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Restore a backup' })).toHaveCount(0);
});

test('a backup opened on the Start panel rebuilds the app', async () => {
  const { app, page, userDataDir } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await saveInto(app, userDataDir);
  await (await openImportExport(page)).getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/^Backed up to/)).toBeVisible();
  const file = path.join(
    userDataDir,
    fs.readdirSync(userDataDir).find((name) => name.startsWith('mosaic-backup-'))!
  );

  // Start over, as on a new machine: Mosaic opens empty, on the Start panel.
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'Privacy' }).click();
  await settings.getByRole('button', { name: 'Erase local data' }).click();
  await page
    .getByRole('dialog', { name: 'Erase local data' })
    .getByRole('button', { name: 'Erase everything' })
    .click();

  await page.getByRole('button', { name: /Import what you have/ }).click();
  await openWith(app, file);
  await page
    .getByRole('dialog', { name: 'Import' })
    .getByRole('button', { name: 'Choose a file…' })
    .click();
  const restore = page.getByRole('dialog', { name: 'Restore a backup' });
  await expect(restore.getByText('Mosaic has no templates', { exact: false })).toBeVisible();
  await restore.getByRole('button', { name: 'Restore' }).click();

  await expect(page.getByText('Restored 1 template from the backup')).toBeVisible();
  await expect(page.getByRole('button', { name: /Blank resume/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Content' }).click();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();
});

test('deleting a template can be undone', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');

  await page.getByRole('button', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Options for Untitled resume' }).click();
  await page.getByRole('menuitem', { name: 'Delete template…' }).click();
  await page
    .getByRole('dialog', { name: 'Delete template' })
    .getByRole('button', { name: 'Delete template' })
    .click();
  await expect(page.getByText('Deleted “Untitled resume” and its 1 version')).toBeVisible();
  await expect(page.getByRole('banner').getByText('No resume open')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Brought back “Untitled resume”')).toBeVisible();
  await page.getByRole('button', { name: 'Content' }).click();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();
});
