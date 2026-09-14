import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

test('the assistant pane appears on the right only while AI is on', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  // AI is off by default: no pane, no AI tab — only where to turn it on.
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI Tools' })).toHaveCount(0);
  await expect(page.getByText('AI features are off')).toBeVisible();

  await page.getByRole('button', { name: 'AI off' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('heading', { name: 'AI assistant' })).toBeVisible();
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();

  await expect(pane).toBeVisible();
  await expect(pane.getByText('Not built yet.')).toBeVisible();
  await expect(pane.getByText('OpenAI · gpt-5.6-terra')).toBeVisible();
  await expect(page.getByText('AI features are off')).toHaveCount(0);

  // It sits right of the preview.
  const previewBox = await page.getByRole('main').boundingBox();
  const paneBox = await pane.boundingBox();
  expect(paneBox!.x).toBeGreaterThanOrEqual(previewBox!.x + previewBox!.width - 1);

  // Closed and reopened: the ✕, the shortcut, and the top bar's toggle.
  await pane.getByRole('button', { name: 'Close assistant' }).click();
  await expect(pane).toHaveCount(0);
  await page.keyboard.press('Control+Backslash');
  await expect(pane).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Toggle assistant' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(pane).toHaveCount(0);
  await toggle.click();
  await expect(pane).toBeVisible();

  // The footer's link goes to the AI settings; turning AI off there takes the pane away.
  await pane.getByRole('button', { name: 'change' }).click();
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI off' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('on a narrow window the assistant lies over the preview instead of squeezing it', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'AI off' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(pane).toHaveCSS('position', 'relative');

  await page.setViewportSize({ width: 800, height: 700 });
  await expect(pane).toHaveCSS('position', 'absolute');
  // The preview keeps the room the sidebar leaves it.
  const previewBox = await page.getByRole('main').boundingBox();
  expect(previewBox!.width).toBeGreaterThan(400);
});
