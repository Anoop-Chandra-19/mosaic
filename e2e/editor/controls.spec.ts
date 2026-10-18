import { expect, type Page } from '@playwright/test';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

const RESUME = [
  'Nora Finch',
  '',
  'Experience',
  'Dispatch Analyst, Lantern Works',
  '- Kept the dispatch queue under a second at peak.',
].join('\n');

const ROWS = [
  {
    selector: '.group\\/bullet',
    menuLabel: 'Bullet actions',
    leaveOffLabel: 'Leave off the resume',
    focusLabel: 'Toggle bullet visibility',
    focusRole: 'checkbox',
  },
  {
    selector: '.group\\/entry',
    menuLabel: 'Entry actions',
    leaveOffLabel: 'Leave off the resume',
    focusLabel: 'Toggle entry visibility',
    focusRole: 'checkbox',
  },
  {
    selector: '.group\\/section',
    menuLabel: 'Experience actions',
    leaveOffLabel: 'Leave section off the resume',
    focusLabel: 'Collapse Experience',
    focusRole: 'button',
  },
] as const;

async function importResume(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByLabel('Or paste the text').fill(RESUME);
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(importing).toHaveCount(0);
}

test('mouse menu actions do not leave editor controls showing after the pointer leaves', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary', { includeHidden: true });

  for (const { selector, menuLabel, leaveOffLabel } of ROWS) {
    const row = sidebar.locator(selector);
    const trigger = row.getByRole('button', { name: menuLabel, includeHidden: true });
    // Switching from keyboard navigation to the mouse must clear the keyboard reveal.
    await page.keyboard.press('Tab');
    await row.hover();
    await trigger.click();
    await page.mouse.move(0, 0);
    await expect(trigger).toBeVisible();
    await page.getByRole('menuitem', { name: leaveOffLabel, exact: true }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(trigger).toBeHidden();
    await row.hover();
    await expect(trigger).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(trigger).toBeHidden();
  }

  // Text editing stays discoverable even when a field was opened with the mouse.
  await sidebar.getByText('Lantern Works', { exact: true }).click();
  await expect(sidebar.getByRole('textbox', { name: 'Organization' })).toBeFocused();
  await page.mouse.move(0, 0);
  await expect(sidebar.getByRole('button', { name: 'Entry actions' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('keyboard focus reveals editor controls and returns to the menu trigger on Escape', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary', { includeHidden: true });
  await page.mouse.move(0, 0);

  for (const { selector, menuLabel, focusRole, focusLabel } of ROWS) {
    const row = sidebar.locator(selector);
    const trigger = row.getByRole('button', { name: menuLabel, includeHidden: true });
    // Start at an always-visible control with keyboard modality, then reach the menu by Tab.
    await page.keyboard.press('Tab');
    await row.getByRole(focusRole, { name: focusLabel, exact: true }).focus();
    await expect(trigger).toBeVisible();
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press('Tab');

      if (await trigger.evaluate((button) => button === document.activeElement)) break;
    }
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toBeVisible();
    expect(await trigger.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
  }

  expect(errors).toEqual([]);
});
