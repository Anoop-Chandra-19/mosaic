import fs from 'node:fs';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { openWith, saveInto } from './dialogs';
import { test, withApp } from './launch';

const mosaic = withApp();

async function setName(page: Page, current: string, next: string) {
  await page.getByRole('complementary').getByText(current, { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(next);
  await page.getByPlaceholder('Your name').press('Enter');
}

/** Hold every owned exit in the mutation microtask, before its first frame. */
async function holdExits(box: Locator) {
  return box.evaluateHandle((element) => {
    const exits: Animation[] = [];
    const observer = new MutationObserver(() => {
      for (const animation of element.getAnimations({ subtree: true })) {
        if (animation.id !== 'presence-exit' || exits.includes(animation)) continue;
        animation.pause();
        animation.currentTime = 0;
        exits.push(animation);
      }
    });
    observer.observe(element, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    return { exits, observer };
  });
}

async function expectPresence(box: Locator, isOpen: boolean) {
  await expect(box).toHaveAttribute('data-state', isOpen ? 'open' : 'closed');
  expect(await box.evaluate((element) => element.hasAttribute('inert'))).toBe(!isOpen);
  if (isOpen) await expect(box).not.toHaveAttribute('aria-hidden', 'true');
  else await expect(box).toHaveAttribute('aria-hidden', 'true');
  if (isOpen) await expect(box).toBeVisible();
}

test('earlier revisions retain all exits, cancel on reopen, and skip reduced-motion exits', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Maren Vale');
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill('Dispatch role');
  await page.getByRole('button', { name: /^(Save|Name) v\d/ }).click();
  await expect(page.getByText('Named “Dispatch role”')).toBeVisible();
  for (const [index, name] of ['Maren R. Vale', 'Maren Rowan Vale'].entries()) {
    await setName(page, index === 0 ? 'Maren Vale' : 'Maren R. Vale', name);
    await page.keyboard.press('Control+s');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Add to v2/ }).click();
    await dialog.getByRole('button', { name: `Save v2.${index + 1}` }).click();
    await expect(page.getByText(`Named “Dispatch role” as v2.${index + 1}`)).toBeVisible();
  }
  // Prepare a dirty draft before opening history; a clean draft only renames its head.
  await setName(page, 'Maren Rowan Vale', 'Maren R. Vale');
  await page.getByRole('tab', { name: 'Templates' }).click();
  const toggle = page.getByRole('button', { name: /^\d+ earlier$/ });
  const group = page.locator('li[data-state]:has(> ol[data-presence-list])');
  await expect(toggle).toHaveAccessibleName('2 earlier');
  await toggle.click();
  await expectPresence(group, true);
  await expect(group.getByRole('listitem')).toHaveCount(2);
  const mountedGroup = await group.elementHandle();
  await page.keyboard.press('Control+s');
  const naming = page.getByRole('dialog', { name: 'Name this version' });
  await naming.getByRole('radio', { name: /Add to v2\.2/ }).click();
  await naming.getByLabel('Version name').fill('Dispatch role, final');
  await naming.getByRole('button', { name: 'Save v2.3' }).click();
  await expect(page.getByText('Named “Dispatch role, final” as v2.3')).toBeVisible();
  await expect(naming).toHaveCount(0);
  await expect(toggle).toHaveAccessibleName('3 earlier');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expectPresence(group, true);
  await expect(group).toHaveCount(1);
  expect(await group.evaluate((element, mounted) => element === mounted, mountedGroup!)).toBe(true);
  expect(await mountedGroup!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(group.getByRole('listitem')).toHaveCount(3);
  const rows = page.locator('li[data-version-id]');
  await expect(rows).toHaveCount(5);
  for (const label of ['v1', 'v2', 'v2.1', 'v2.2', 'v2.3']) {
    await expect(rows.filter({ has: page.getByText(label, { exact: true }) })).toHaveCount(1);
  }
  const held = await holdExits(group);
  await toggle.click();
  await expectPresence(group, false);
  await expect(group.locator('ol[data-presence-list] > li')).toHaveCount(3);
  await expect(group.getByRole('listitem')).toHaveCount(0);
  await expect.poll(() => held.evaluate(({ exits }) => exits.length)).toBeGreaterThan(1);
  const exitCount = await held.evaluate(({ exits }) => exits.length);
  await toggle.click();
  await expectPresence(group, true);
  await expect(group.getByRole('listitem')).toHaveCount(3);
  await expect
    .poll(() => held.evaluate(({ exits }) => exits.every((exit) => exit.playState === 'idle')))
    .toBe(true);
  await toggle.click();
  await expectPresence(group, false);
  await expect.poll(() => held.evaluate(({ exits }) => exits.length)).toBe(exitCount * 2);
  // One unfinished animation must retain the group, even after every other exit finishes.
  await held.evaluate(async ({ exits }) => {
    const pending = exits.filter((exit) => exit.playState !== 'idle');
    for (const exit of pending.slice(0, -1)) exit.finish();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
  await expectPresence(group, false);
  await held.evaluate(({ exits, observer }) => {
    observer.disconnect();
    exits.at(-1)!.finish();
  });
  await expect(group).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.click();
  await expectPresence(group, true);
  const hasMotion = await group.evaluate((element) =>
    element.getAnimations({ subtree: true }).some(({ id }) => id.startsWith('presence-'))
  );
  expect(hasMotion).toBe(false);
  const reduced = await holdExits(group);
  await toggle.click();
  await expect(group).toHaveCount(0);
  expect(await reduced.evaluate(({ exits }) => exits.length)).toBe(0);
  await reduced.evaluate(({ observer }) => observer.disconnect());
  expect(errors).toEqual([]);
});

test('the PDF warning retains its content through exit and reverses on a quick format change', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Maren Ł Vale');
  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const exporting = page.getByRole('dialog', { name: 'Export', exact: true });
  const warning = exporting.locator('div[role="status"]');
  await expectPresence(warning, true);
  await expect(warning).toContainText('The PDF can’t show Ł.');
  const mounted = await warning.elementHandle();
  const held = await holdExits(warning);

  await exporting.getByRole('radio', { name: /^Word/ }).click();
  await expectPresence(warning, false);
  await expect(exporting.getByRole('status')).toHaveCount(0);
  await expect(warning).toContainText('The PDF can’t show Ł.');
  await expect.poll(() => held.evaluate(({ exits }) => exits.length)).toBeGreaterThan(0);
  await exporting.getByRole('radio', { name: /^PDF/ }).click();
  await expectPresence(warning, true);
  expect(await warning.evaluate((element, previous) => element === previous, mounted!)).toBe(true);
  await expect
    .poll(() => held.evaluate(({ exits }) => exits.every((exit) => exit.playState === 'idle')))
    .toBe(true);

  await exporting.getByRole('radio', { name: /^Markdown/ }).click();
  await expectPresence(warning, false);
  await expect(warning).toContainText('The PDF can’t show Ł.');
  await held.evaluate(({ exits, observer }) => {
    observer.disconnect();
    exits.filter((exit) => exit.playState !== 'idle').forEach((exit) => exit.finish());
  });
  await expect(warning).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await exporting.getByRole('radio', { name: /^PDF/ }).click();
  await expectPresence(warning, true);
  expect(
    await warning.evaluate((element) =>
      element.getAnimations().some(({ id }) => id.startsWith('presence-'))
    )
  ).toBe(false);
  const reduced = await holdExits(warning);
  await exporting.getByRole('radio', { name: /^Word/ }).click();
  await expect(warning).toHaveCount(0);
  expect(await reduced.evaluate(({ exits }) => exits.length)).toBe(0);
  await reduced.evaluate(({ observer }) => observer.disconnect());
  expect(errors).toEqual([]);
});

test('the backup replacement warning stays hidden through exit and reverses rapid changes', async () => {
  const { app, page, userDataDir, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await saveInto(app, userDataDir);
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'Import & export' }).click();
  await settings.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/^Backed up to/)).toBeVisible();
  const file = fs.readdirSync(userDataDir).find((name) => name.startsWith('mosaic-backup-'))!;
  await openWith(app, path.join(userDataDir, file));
  await settings.getByRole('button', { name: 'Restore…' }).click();
  const restore = page.getByRole('dialog', { name: 'Restore a backup' });
  const replace = restore.getByRole('radio', { name: /Replace everything/ });
  const add = restore.getByRole('radio', { name: /Add as new templates/ });
  const warning = restore.locator('div[data-state]', { hasText: 'Replacing can’t be undone.' });
  await replace.click();
  await expectPresence(warning, true);
  await expect(warning.locator(':scope > svg')).toHaveCount(1);
  const held = await holdExits(warning);
  await add.click();
  await expectPresence(warning, false);
  await expect(warning).toContainText('Back up first');

  await expect.poll(() => held.evaluate(({ exits }) => exits.length)).toBeGreaterThan(0);
  await replace.click();
  await expectPresence(warning, true);
  await expect
    .poll(() => held.evaluate(({ exits }) => exits.every((exit) => exit.playState === 'idle')))
    .toBe(true);
  await add.click();
  await expectPresence(warning, false);
  await expect
    .poll(() => held.evaluate(({ exits }) => exits.some((exit) => exit.playState === 'paused')))
    .toBe(true);
  await held.evaluate(({ exits, observer }) => {
    observer.disconnect();
    exits.filter((exit) => exit.playState !== 'idle').forEach((exit) => exit.finish());
  });
  await expect(warning).toHaveCount(0);
  await replace.click();
  await expectPresence(warning, true);
  expect(errors).toEqual([]);
});
