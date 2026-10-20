import { expect } from '@playwright/test';
import { expectViewAt, goToView, runDevTool } from '../harness/devTools';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

test('the developer tools open over the full history, run from the keyboard, and repeat from Recent', async () => {
  const { app, page, errors } = mosaic();
  await expect(page).toHaveTitle('Mosaic DEV');
  await runDevTool(page, 'exampleResume');
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  const history = page.getByRole('region', { name: /^History of/ });
  await expect(history).toBeVisible();

  // Over the full history, which covers the top bar and its wrench.
  await page.keyboard.press('Control+Shift+D');
  const tools = page.getByRole('dialog', { name: 'Developer tools' });
  await expect(tools).toBeVisible();
  await page.keyboard.type('stage');
  await expect(tools.getByRole('option', { selected: true })).toContainText(
    'Stage one of each suggestion'
  );
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Staged 12 example suggestions/)).toBeVisible();
  await expect(tools).toBeHidden();
  await expect(history).toBeVisible();

  // Develop › Developer tools… opens on Recent, the last tool first.
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('developer-tools');
    item?.click(undefined, BrowserWindow.getAllWindows()[0]);
  });
  await expect(tools).toBeVisible();
  await expect(tools.getByRole('group', { name: 'Recent' })).toContainText(
    'Stage one of each suggestion'
  );
  await expect(tools.getByRole('option', { selected: true })).toContainText(
    'Runs again with the same choices.'
  );
  await page.keyboard.press('Escape');
  await expect(tools).toBeHidden();
  await expect(history).toBeVisible();
  expect(errors).toEqual([]);
});

test('views are reached by their address: by steps, pasted, from a test, and copied from Help', async () => {
  const { app, page, errors } = mosaic();
  await runDevTool(page, 'exampleResume');
  const tools = page.getByRole('dialog', { name: 'Developer tools' });

  // Steps, each a chip; Ctrl+Enter takes the defaults until one has none.
  await page.keyboard.press('Control+Shift+D');
  await page.keyboard.type('full history');
  await page.keyboard.press('Enter');
  await expect(tools.getByPlaceholder('Which template')).toBeVisible();
  await page.keyboard.press('Control+Enter');
  await expect(tools.getByPlaceholder('Compare with')).toBeVisible();
  await expect(tools.getByText('history / Rowan Vale (example) / v1 vs …')).toBeVisible();
  await page.keyboard.type('draft');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(tools).toBeHidden();
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  await expectViewAt(page, 'history / Rowan Vale (example) / v1 vs draft / page');

  // Pasted: one row that goes there, or one that says why it can't.
  await page.keyboard.press('Control+Shift+D');
  await expect(
    tools.getByText('history / Rowan Vale (example) / v1 vs draft / page')
  ).toBeVisible();
  await page.keyboard.insertText('history / Northwind / v3');
  await expect(tools.getByText('No template named “Northwind”.')).toBeVisible();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('settings / history');
  await page.keyboard.press('Enter');
  await expectViewAt(page, 'settings / history');

  // From a test, then copied from the menu bar's Help, as a bug report would.
  await goToView(page, 'editor / Rowan Vale (example) + export');
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible();
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('copyViewAddress');
    item?.click(undefined, BrowserWindow.getAllWindows()[0]);
  });
  await expect(
    page.getByText('Copied the view address: editor / Rowan Vale (example) + export')
  ).toBeVisible();
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(
    'editor / Rowan Vale (example) + export'
  );
  expect(errors).toEqual([]);
});
