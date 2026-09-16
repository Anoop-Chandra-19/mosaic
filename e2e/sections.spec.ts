import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** The sections as the draft in the database has them. */
async function storedSections(page: Page) {
  return page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return (boot.value.draft?.doc.sections ?? []).map(({ kind, layout, label }) => ({
      kind,
      layout,
      label,
    }));
  });
}

/** A new custom section opens with its name selected: typing replaces it. */
async function nameNewSection(page: Page, placeholder: string, name: string) {
  const field = page.getByRole('textbox', { name: 'Section name' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(placeholder);
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(field).toBeHidden();
}

test('custom sections and lists are named as they are added, as many as you like', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // While the resume is empty: from the suggestions' "Something else".
  await page.getByRole('button', { name: 'Something else' }).click();
  await page.getByRole('menuitem', { name: /Custom section/ }).click();
  await nameNewSection(page, 'New section', 'Volunteering');

  // Once it has content: from Add Section, which offers both shapes every time.
  await page.getByText('Volunteering', { exact: true }).hover();
  await page.getByRole('button', { name: 'Add entry to Volunteering' }).click();
  await page.getByRole('button', { name: 'Add Section' }).click();
  await page.getByRole('menuitem', { name: /Custom list/ }).click();
  await nameNewSection(page, 'New list', 'Languages');

  // Built-in kinds are presets now: a second Experience is just another section.
  await page.getByRole('button', { name: 'Add Section' }).click();
  await page.getByRole('menuitem', { name: 'Experience' }).click();

  await expect
    .poll(() => storedSections(page))
    .toEqual([
      { kind: 'experience', layout: 'entries', label: 'Experience' },
      { kind: 'education', layout: 'entries', label: 'Education' },
      { kind: 'skills', layout: 'lines', label: 'Skills' },
      { kind: 'custom', layout: 'entries', label: 'Volunteering' },
      { kind: 'custom', layout: 'lines', label: 'Languages' },
      { kind: 'experience', layout: 'entries', label: 'Experience' },
    ]);
  expect(errors).toEqual([]);
});
