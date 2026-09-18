import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** AI is turned on and off in one place only: Settings. */
async function setAiEnabled(page: Page, on: boolean) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  const toggle = settings.getByRole('switch', { name: 'Enable AI assistant' });
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
}

test('the assistant pane appears on the right only while AI is on', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  // AI is off by default, and then nothing in the window points at it.
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI Tools' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle assistant' })).toHaveCount(0);
  await expect(page.getByText(/\bAI\b/)).toHaveCount(0);

  await setAiEnabled(page, true);
  await expect(pane).toBeVisible();
  await expect(pane.getByText('Not built yet.')).toBeVisible();
  await expect(pane.getByText('OpenAI · gpt-5.6-terra')).toBeVisible();

  // It sits right of the preview.
  const previewBox = await page.getByRole('main').boundingBox();
  const paneBox = await pane.boundingBox();
  expect(paneBox!.x).toBeGreaterThanOrEqual(previewBox!.x + previewBox!.width - 1);

  // Closed and reopened: the ✕, the shortcut, and the status bar's toggle.
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
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle assistant' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('on a narrow window the assistant lies over the preview instead of squeezing it', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setAiEnabled(page, true);
  const pane = page.getByRole('complementary', { name: 'Assistant' });

  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(pane).toHaveCSS('position', 'relative');

  await page.setViewportSize({ width: 800, height: 700 });
  await expect(pane).toHaveCSS('position', 'absolute');
  // The preview keeps the room the sidebar leaves it.
  const previewBox = await page.getByRole('main').boundingBox();
  expect(previewBox!.width).toBeGreaterThan(400);
});
