import fs from 'node:fs';
import { expect } from '@playwright/test';
import { expectViewAt, goToView, makeHistory, runDevTool } from '../harness/devTools';
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

test('a made history reads as asked, and a profile replaces it only on Ctrl+Enter', async () => {
  const { page, errors } = mosaic();
  await makeHistory(page, {
    template: 'Kept apart',
    versions: [{ name: 'First' }, { name: 'Second', contactName: 'Rowan Hale' }],
  });
  await goToView(page, 'history / Kept apart / v3 vs v2 / page');
  const history = page.getByRole('region', { name: /^History of/ });
  await expect(history.getByRole('heading', { name: 'Second', exact: true })).toBeVisible();

  const tools = page.getByRole('dialog', { name: 'Developer tools' });
  await page.keyboard.press('Control+Shift+D');
  await page.keyboard.type('profile');
  await page.keyboard.press('Enter');
  await page.keyboard.type('everyday');
  await page.keyboard.press('Enter');
  await expect(
    tools.getByRole('heading', { name: 'Replace all development data with Everyday?' })
  ).toBeVisible();
  await expect(tools).toContainText('Deletes the 1 template and 3 versions in this build’s data.');
  await page.keyboard.press('Enter');
  await expect(tools).toBeVisible();

  await page.keyboard.press('Control+Enter');
  await expect(tools).toBeHidden();
  await expect(
    page.getByText(/^Loaded Everyday in [\d.]+s\. 3 templates, 48 versions on Base resume\.$/)
  ).toBeVisible();
  await expectViewAt(page, 'editor / Base resume');
  await expect(page).toHaveTitle('Mosaic DEV');
  await expect(goToView(page, 'editor / Kept apart')).rejects.toThrow('No template named');
  await goToView(page, 'history / Tailored for Kestrel / v1 vs draft / page');
  await expect(history).toBeVisible();
  expect(errors).toEqual([]);
});

test('switches stay on across launches, named in the title, and the memory check reads each process', async ({
  launchApp,
}) => {
  const first = await launchApp();
  const { userDataDir } = first;
  try {
    const { page } = first;
    await runDevTool(page, 'exampleResume');
    const tools = page.getByRole('dialog', { name: 'Developer tools' });
    await page.keyboard.press('Control+Shift+D');
    await page.keyboard.type('memory');
    await page.keyboard.press('Enter');
    const memory = tools.getByRole('region', { name: 'Memory check' });
    await expect(memory.getByRole('row').first()).toHaveText(/^Main\d+ MB$/);
    await expect(memory.getByRole('row').nth(1)).toHaveText(/^Window\d+ MB$/);
    await page.keyboard.press('Enter');
    await expect(memory).toContainText('change since');
    await expect(memory.getByRole('row').last()).toHaveText(
      /^All of Mosaic\d+ MB(same|[+−]\d+ MB)$/
    );

    // A switch flips in place, with the palette open.
    await page.keyboard.press('Escape');
    await page.keyboard.type('reopen');
    await page.keyboard.press('Enter');
    await expect(tools.getByRole('option', { selected: true })).toContainText('On');
    await expect(page).toHaveTitle('Mosaic DEV · Reopens this view');
    await page.keyboard.press('Escape');
    await runDevTool(page, 'slowMotion', { isOn: true });
    await runDevTool(page, 'reducedMotion', { isOn: true });
    await goToView(page, 'settings / history');
    await first.app.close();

    const second = await launchApp(userDataDir);
    try {
      await expect(second.page).toHaveTitle(
        'Mosaic DEV · Slow motion ×10 · Reduced motion · Reopens this view'
      );
      await expectViewAt(second.page, 'settings / history');
      // Under Settings, which hides the rest of the window from the accessibility tree.
      await expect(
        second.page.getByRole('button', { name: /a switch is on/, includeHidden: true })
      ).toBeAttached();
      expect(
        await second.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
      ).toBe(true);
      const { playbackRate } = await second.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.debugger.sendCommand(
          'Animation.getPlaybackRate'
        )
      );
      expect(playbackRate).toBe(0.1);
      expect(second.errors).toEqual([]);
    } finally {
      await second.app.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
