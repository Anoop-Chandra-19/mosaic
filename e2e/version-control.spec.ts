import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { openWith, saveInto } from './dialogs';
import { test, withApp } from './launch';

const mosaic = withApp();
const DAY_MS = 86_400_000;

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

/** v1 Created (automatic), v2 First and v3 Second (named, v3 the newest). */
async function startWithThree(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await nameVersion(page, 'First');
  await setName(page, 'Ada Lovelace', 'Grace Hopper');
  await nameVersion(page, 'Second');
}

const row = (page: Page, label: string) =>
  page.locator('li[data-version-id]').filter({ has: page.getByText(label, { exact: true }) });

async function openRowMenu(page: Page, label: string) {
  await row(page, label).hover();
  await page.getByRole('button', { name: `Actions for ${label}` }).click();
}

test('any version can be named in its row, and Escape cancels without closing the view', async () => {
  const { page, errors } = mosaic();
  await startWithThree(page);
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  const view = page.getByRole('region', { name: /^History of/ });
  await expect(view).toBeVisible();

  // An automatic row is named in place: Enter keeps it, and the row is the receipt.
  await row(page, 'v1').hover();
  await view.getByRole('button', { name: 'Name v1' }).click();
  const field = view.getByRole('textbox', { name: 'Name v1' });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('placeholder', 'Named versions are kept for good');
  await field.fill('Starting point');
  await field.press('Enter');
  await expect(row(page, 'v1')).toContainText('Starting point');
  await expect(page.getByText(/^Named “/)).toHaveCount(0);
  await expect(view.getByRole('navigation', { name: 'History index' })).toContainText(
    'Starting point'
  );

  // Escape cancels the rename and leaves the view open.
  await openRowMenu(page, 'v2');
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const rename = view.getByRole('textbox', { name: 'Rename v2' });
  await expect(rename).toHaveValue('First');
  await rename.fill('Changed my mind');
  await rename.press('Escape');
  await expect(view).toBeVisible();
  await expect(row(page, 'v2')).toContainText('First');

  // Clicking away keeps what was typed.
  await openRowMenu(page, 'v2');
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await rename.fill('Sent to Acme');
  await view.getByRole('heading', { name: 'History' }).click();
  await expect(row(page, 'v2')).toContainText('Sent to Acme');
  expect(errors).toEqual([]);
});

test('deleting a version never renumbers the rest, and can be undone', async () => {
  const { page, errors } = mosaic();
  await startWithThree(page);
  await page.getByRole('tab', { name: 'Templates' }).click();
  const toast = page.getByRole('status');

  // An automatic snapshot goes in one click, with Undo.
  await openRowMenu(page, 'v1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(toast).toContainText('Deleted automatic snapshot v1');
  await expect(row(page, 'v1')).toHaveCount(0);
  await expect(row(page, 'v2')).toContainText('First');
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'v1')).toContainText('Created');

  // A named one asks in its row first, and Escape keeps it.
  await openRowMenu(page, 'v2');
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete “First”?' });
  await expect(confirm).toContainText('Only v2 is removed. Automatic snapshots around it stay.');
  await expect(confirm.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(row(page, 'v2')).toContainText('First');

  await openRowMenu(page, 'v2');
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(toast).toContainText('Deleted “First”');
  await expect(row(page, 'v2')).toHaveCount(0);
  await expect(row(page, 'v3')).toContainText('Second');

  // The newest stays: the draft is measured from it.
  await openRowMenu(page, 'v3');
  await expect(page.getByRole('menuitem', { name: /^Delete/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: /^Delete/ })).toContainText(
    'The newest version can’t be deleted.'
  );
  expect(errors).toEqual([]);
});

test('old automatic snapshots fold by month between named versions', async () => {
  const { app, page, userDataDir } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await nameVersion(page, 'Kept');

  // A backup, aged: Created two months back, and three automatic snapshots after it.
  await saveInto(app, userDataDir);
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'Import & export' }).click();
  await settings.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/^Backed up to/)).toBeVisible();
  const file = path.join(
    userDataDir,
    fs.readdirSync(userDataDir).find((name) => name.startsWith('mosaic-backup-'))!
  );
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  const [created, kept] = backup.templates[0].versions;
  const longAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
  const edits = [50, 49, 48].map((days, index) => ({
    ...created,
    id: `old-edit-${index}`,
    number: index + 2,
    parentId: null,
    source: 'edit',
    summary: `Edited a bullet, ${days} days ago`,
    createdAt: longAgo(days),
  }));
  backup.templates[0].versions = [
    { ...created, createdAt: longAgo(60) },
    ...edits,
    { ...kept, number: 5, parentId: null },
  ];
  fs.writeFileSync(file, JSON.stringify(backup));

  await openWith(app, file);
  await settings.getByRole('button', { name: 'Restore…' }).click();
  const restore = page.getByRole('dialog', { name: 'Restore a backup' });
  await restore.getByRole('radio', { name: /Replace everything/ }).click();
  await restore.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.getByText('Restored 1 template from the backup')).toBeVisible();

  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(
    page.getByRole('note').filter({ hasText: 'Older than 30 days: automatic snapshots fold' })
  ).toContainText('Nothing is deleted.');
  const fold = page.getByRole('button', { name: /4 automatic snapshots/ });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(fold).toContainText('v1 to v4');
  await expect(row(page, 'v5')).toContainText('Kept');
  await fold.click();
  await expect(row(page, 'v1')).toContainText('Created');

  // Never folds, and nothing went anywhere.
  await page.getByRole('button', { name: 'Open settings' }).click();
  await settings.getByRole('navigation').getByRole('button', { name: 'History' }).click();
  await settings.getByRole('combobox', { name: 'Fold old automatic snapshots' }).click();
  await page.getByRole('option', { name: 'Never' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /automatic snapshots$/ })).toHaveCount(0);
  await expect(row(page, 'v3')).toContainText('49 days ago');
});
