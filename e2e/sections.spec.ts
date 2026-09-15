import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** The sections as the draft in the database has them. */
async function storedSections(page: Page) {
  return page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return (boot.value.draft?.doc.sections ?? []).map(({ type, label }) => ({ type, label }));
  });
}

/** A new custom section opens with its name selected: typing replaces it. */
async function nameNewSection(page: Page, name: string) {
  const field = page.getByRole('textbox', { name: 'Section name' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('New section');
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(field).toBeHidden();
}

test('custom sections are named as they are added, as many as you like', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // While the resume is empty: from the suggestions' "Something else".
  await page.getByRole('button', { name: 'Something else' }).click();
  await page.getByRole('menuitem', { name: 'Custom section' }).click();
  await nameNewSection(page, 'Volunteering');

  // Once it has content: from Add Section, which still offers another.
  await page.getByText('Volunteering', { exact: true }).hover();
  await page.getByRole('button', { name: 'Add entry to Volunteering' }).click();
  await page.getByRole('button', { name: 'Add Section' }).click();
  await page.getByRole('menuitem', { name: 'Custom section' }).click();
  await nameNewSection(page, 'Publications');

  await expect
    .poll(async () => (await storedSections(page)).filter((s) => s.type === 'custom'))
    .toEqual([
      { type: 'custom', label: 'Volunteering' },
      { type: 'custom', label: 'Publications' },
    ]);
  expect(errors).toEqual([]);
});
