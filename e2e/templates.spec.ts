import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { launchApp, withApp } from './launch';

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
  await page.getByRole('button', { name: 'What the working draft is doing' }).hover();
  await expect(
    page.getByRole('tooltip', { name: /^Working draft · saved as you type\./ })
  ).toBeAttached();
  await page.keyboard.press('Escape');
  const named = page.getByRole('listitem').filter({ hasText: 'Sent to Striped' });
  await expect(named).toContainText('v2');

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

test('editing alone is kept in history when another template takes the editor', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');

  // Nothing was named, and undo does not survive the switch, so the draft is kept for them.
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  const kept = page
    .getByRole('listitem')
    .filter({ hasText: 'Where you left it before switching templates' });
  await expect(kept).toContainText('left off');
  await expect(kept).toContainText('current');
  await expect(page.getByRole('contentinfo').getByText('Matches v2')).toBeVisible();
  await page.getByRole('tab', { name: 'Content' }).click();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();
});

test('editing alone is kept in history when the window closes', async () => {
  const first = await launchApp();
  const { userDataDir } = first;
  try {
    await first.page.getByRole('button', { name: /Blank resume/ }).click();
    await setName(first.page, 'Your name', 'Ada Lovelace');
    await first.app.close();

    // Undo did not survive quitting; the version taken on the way out did.
    const second = await launchApp(userDataDir);
    try {
      await second.page.getByRole('tab', { name: 'Templates' }).click();
      await expect(
        second.page.getByRole('listitem').filter({ hasText: /^Where you left it/ })
      ).toContainText('left off');
      expect(second.errors).toEqual([]);
    } finally {
      await second.app.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('a long history can be narrowed to named versions, or searched', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  // Past eight versions the history grows its filter bar.
  const companies = [
    'Northwind',
    'Kestrel',
    'Vela',
    'Atlas',
    'Corvid',
    'Marlowe',
    'Quarry',
    'Fernbank',
  ];
  let current = 'Your name';
  for (const company of companies) {
    await setName(page, current, `Ada at ${company}`);
    current = `Ada at ${company}`;
    await nameVersion(page, `Sent to ${company}`);
  }

  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByText('Created', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Named' }).click();
  await expect(page.getByText('Created', { exact: true })).toBeHidden();
  await expect(page.getByRole('listitem')).toHaveCount(8);

  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('button', { name: 'Find a version by name' }).click();
  await page.keyboard.type('NORTH');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem')).toContainText('Sent to Northwind');
  await page.keyboard.type('zzz');
  await expect(page.getByText('Nothing matches “NORTHzzz”.', { exact: false })).toBeVisible();

  // Escape closes the search and brings every version back.
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Find a version', { exact: true })).toBeHidden();
  await expect(page.getByText('Created', { exact: true })).toBeVisible();
});

test('the full history reads a version beside the list, and restoring closes it', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await nameVersion(page, 'Sent to Northwind');
  await setName(page, 'Ada Lovelace', 'Grace Hopper');
  await nameVersion(page, 'Sent to Kestrel');

  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Options for Untitled resume' }).click();
  await page.getByRole('menuitem', { name: 'Open full history…' }).click();
  const view = page.getByRole('region', { name: 'History of Untitled resume' });
  await expect(view).toBeVisible();

  // The newest version reads first; it is the draft, so there is nothing to restore.
  const reading = view.getByRole('complementary');
  await expect(reading).toContainText('identical to your draft');
  await expect(reading.getByRole('button', { name: 'Restore' })).toBeDisabled();

  // The index goes to a named version, and the pane reads it.
  await view
    .getByRole('navigation', { name: 'History index' })
    .getByRole('button', { name: /Sent to Northwind/ })
    .click();
  await expect(reading.getByRole('heading', { name: 'Sent to Northwind' })).toBeVisible();
  await expect(reading).toContainText('1 printed line differs from your draft');
  await expect(reading).toContainText('Ada Lovelace');

  await reading.getByRole('button', { name: 'Restore' }).click();
  await expect(view).toHaveCount(0);
  await expect(page.getByText('Restored “Sent to Northwind”')).toBeVisible();
  await page.getByRole('tab', { name: 'Content' }).click();
  await expect(page.getByRole('complementary').getByText('Ada Lovelace')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the full history takes focus, holds back the editor’s keys, and closes on Escape', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'Options for Untitled resume' }).click();
  await page.getByRole('menuitem', { name: 'Open full history…' }).click();
  const view = page.getByRole('region', { name: 'History of Untitled resume' });
  await expect(view).toBeVisible();

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(view).toBeFocused();

  // Under the view the editor's keys are off, so the sidebar stays put.
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Templates' })).toBeVisible();
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
