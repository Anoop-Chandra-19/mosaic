import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

test('a new install opens on the Start panel', async () => {
  const { page, errors } = mosaic();

  await expect(page).toHaveTitle('Mosaic');
  await expect(page.getByRole('heading', { name: 'Start your first resume' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Blank resume/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test('the Start panel is worked by keyboard or pointer, with one highlight for both', async () => {
  const { page, errors } = mosaic();
  const blank = page.getByRole('button', { name: /Blank resume/ });
  const sample = page.getByRole('button', { name: /Start from a sample/ });

  // The arrows move between the options, wrapping at either end.
  await expect(blank).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(sample).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(blank).toBeFocused();
  // Pointing at an option moves the highlight there too; the keys go on from it.
  const importing = page.getByRole('button', { name: /Import what you have/ });
  await importing.hover();
  await expect(importing).toBeFocused();
  await expect(blank).not.toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(sample).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Samples' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Example resume' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('Blank resume creates the first template and opens it', async () => {
  const { page, errors } = mosaic();

  await page.getByRole('button', { name: /Blank resume/ }).click();

  await expect(page.getByText('Created “Untitled resume”, your first template')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Start your first resume' })).toBeHidden();
  await expect(page.getByRole('banner').getByText('Untitled resume')).toBeVisible();
  // Three empty sections, and the rest offered while the resume is still empty.
  await expect(page.getByText('Add a section')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the renderer is sandboxed and cannot reach the network', async () => {
  const { page } = mosaic();

  const renderer = await page.evaluate(async () => ({
    bridge: window.mosaic.platform,
    node: 'require' in globalThis || 'process' in globalThis,
    // The Content-Security-Policy admits no remote hosts, so resume data can't leave.
    network: await fetch('https://example.com/').then(
      () => 'reached',
      () => 'blocked'
    ),
  }));

  expect(renderer).toEqual({ bridge: process.platform, node: false, network: 'blocked' });
});

test('the bridge reaches the database, and main checks what it is sent', async () => {
  const { page } = mosaic();

  const calls = await page.evaluate(async () => ({
    boot: await window.mosaic.db.boot(),
    refused: await window.mosaic.db.templates.rename('missing', ''),
  }));

  // A new install: nothing stored yet.
  expect(calls.boot).toEqual({ ok: true, value: { settings: {}, templates: [], draft: null } });
  expect(calls.refused).toMatchObject({ ok: false, code: 'invalid-argument' });
});
