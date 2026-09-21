import { expect, test } from '@playwright/test';
import { withApp } from './launch';

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
