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
    bridge: (window as Window & { mosaic?: { platform?: string } }).mosaic?.platform ?? null,
    node: 'require' in globalThis || 'process' in globalThis,
    // The Content-Security-Policy admits no remote hosts, so resume data can't leave.
    network: await fetch('https://example.com/').then(
      () => 'reached',
      () => 'blocked'
    ),
  }));

  expect(renderer).toEqual({ bridge: process.platform, node: false, network: 'blocked' });
});
