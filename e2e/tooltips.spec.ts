import { expect } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

test('hints are the app’s own tooltips, never the native square box', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // Electron draws any `title` itself, where no style can reach it, so none may be left.
  await expect(page.locator('[title]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Toggle theme' }).hover();
  await expect(page.getByRole('tooltip')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('a hint never covers what is under it, and goes the moment the pointer leaves', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  await page.getByRole('button', { name: 'Toggle theme' }).hover();
  await expect(page.getByRole('tooltip')).not.toBeEmpty();
  const hint = page.getByRole('tooltip', { name: await page.getByRole('tooltip').innerText() });
  const box = (await page.locator('[data-radix-popper-content-wrapper]').boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // The pointer reaches through it to the page below.
  const isUnderPointerTheHint = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[data-radix-popper-content-wrapper]') !== null,
    center
  );
  expect(isUnderPointerTheHint).toBe(false);

  // Moving onto where it is drawn is leaving the button: nothing holds it open. Whatever
  // is under that spot may show its own hint.
  await page.mouse.move(center.x, center.y);
  await expect(hint).toHaveCount(0, { timeout: 250 });
  expect(errors).toEqual([]);
});

test('a resize handle’s hint stays level with the pointer', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const handle = page.locator('aside .cursor-col-resize');
  const hint = page.locator('[data-radix-popper-content-wrapper]');
  const top = (await handle.boundingBox())!.y;

  for (const y of [120, 480]) {
    await handle.hover({ position: { x: 2, y } });
    await expect(page.getByRole('tooltip')).not.toBeEmpty();
    await expect(async () => {
      const box = (await hint.boundingBox())!;
      expect(Math.abs(box.y + box.height / 2 - (top + y))).toBeLessThan(4);
    }).toPass({ timeout: 2000 });
  }
  expect(errors).toEqual([]);
});

test('text says it can be edited, and gives way to a button inside it', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  const text = page
    .getByRole('checkbox', { name: 'Toggle bullet visibility' })
    .first()
    .locator('xpath=following-sibling::div[contains(@class, "cursor-text")][1]');

  await text.hover({ position: { x: 12, y: 6 } });
  await expect(page.getByRole('tooltip', { name: 'Click to edit' })).toBeAttached();

  // Its ⋯, shown on hover, has a hint of its own, and only that one shows.
  await text.getByRole('button', { name: 'Bullet actions' }).hover();
  await expect(page.getByRole('tooltip', { name: 'Bullet actions' })).toBeAttached();
  await expect(page.getByRole('tooltip', { name: 'Click to edit' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an icon button says what it is, and its menu does not bring the hint back', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const options = page.getByRole('button', { name: 'Header options' });

  // No title of its own: the icon's name is the hint, as every ⋯ in the design has one.
  await options.hover();
  await expect(page.getByRole('tooltip', { name: 'Header options' })).toBeAttached();

  // Used with the mouse, the closing menu hands focus back to the button. That is not a
  // request for its hint, so none shows once the pointer has gone.
  await options.click();
  await page.getByRole('menuitem', { name: 'Add a line' }).click();
  await page.mouse.move(700, 500, { steps: 4 });
  await expect(options).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  expect(errors).toEqual([]);
});
