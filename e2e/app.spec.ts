import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

test('opens the editor and renders the resume preview', async () => {
  const { page, errors } = mosaic();

  await expect(page).toHaveTitle('Mosaic');
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  // The seed resume's name appears in both the contact editor and the paper preview.
  await expect(page.getByText('Your Name').first()).toBeVisible();
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
