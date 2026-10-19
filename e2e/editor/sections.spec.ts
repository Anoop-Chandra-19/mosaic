import { expect, type Page } from '@playwright/test';
import { test, withApp } from '../harness/launch';

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

test('an entry line that wraps on the page says so in the editor, as the preview wraps it', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  const note = page.getByText(/The heading prints on \d lines/);
  await expect(note).toHaveCount(0);

  await editEntryField(
    page,
    'Company',
    'Organization',
    'Fictional Institute for Distributed Systems and Infrastructure'
  );
  await editEntryField(page, 'Month Year to Current', 'Dates', 'January 2020 to September 2026');

  await expect(note).toHaveText(/The heading prints on 2 lines beside the dates/);
  const previewLines = await page
    .locator('[data-preview-entry-heading-key] h3', { hasText: 'Fictional Institute' })
    .first()
    .evaluate((h3) => h3.clientHeight / parseFloat(getComputedStyle(h3).lineHeight));
  expect(previewLines).toBe(2);

  await editEntryField(
    page,
    'Fictional Institute for Distributed Systems and Infrastructure',
    'Organization',
    'Babbage & Co'
  );
  await expect(note).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('custom sections and lists are named as they are added, as many as you like', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // While the resume is empty: from the suggestions' "Something else".
  await page.getByRole('button', { name: 'Something else' }).click();
  await page.getByRole('menuitem', { name: /Custom section/ }).click();
  await nameNewSection(page, 'New section', 'Outreach');

  // Once it has content: from Add Section, which offers both shapes every time.
  await page.getByText('Outreach', { exact: true }).hover();
  await page.getByRole('button', { name: 'Add entry to Outreach' }).click();
  // From the + at the top of the pane, which comes before the sections.
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Add section' })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Custom list/ }).click();
  await nameNewSection(page, 'New list', 'Instruments');

  // A kind the resume has is under "Another like…", and lands right below the first.
  await page.getByRole('tabpanel').getByRole('button', { name: 'Add section' }).click();
  await page.getByRole('menuitem', { name: 'Another like…' }).press('ArrowRight');
  await page.getByRole('menu').last().getByRole('menuitem', { name: 'Experience' }).press('Enter');

  await expect
    .poll(() => storedSections(page))
    .toEqual([
      { kind: 'experience', layout: 'entries', label: 'Experience' },
      { kind: 'experience', layout: 'entries', label: 'Experience' },
      { kind: 'education', layout: 'entries', label: 'Education' },
      { kind: 'skills', layout: 'lines', label: 'Skills' },
      { kind: 'custom', layout: 'entries', label: 'Outreach' },
      { kind: 'custom', layout: 'lines', label: 'Instruments' },
    ]);
  expect(errors).toEqual([]);
});

/** Click a field of an entry in the editor, type its new text, and save it. */
async function editEntryField(page: Page, shown: string, label: string, text: string) {
  await page.getByRole('complementary').getByText(shown, { exact: true }).click();
  const field = page.getByRole('textbox', { name: label });
  await field.fill(text);
  await field.press('Enter');
  await expect(field).toBeHidden();
}

test('an entry’s title, organization, location, and dates print as one line', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();

  const job = page.locator('[data-preview-entry-heading-key="sec-experience::job1"]').first();
  await expect(job).toContainText('Job Title, Company, Location');
  await expect(job).toContainText('Month Year to Current');

  await editEntryField(page, 'Company', 'Organization', 'Babbage & Co');
  await editEntryField(page, 'Location', 'Location', '');
  await editEntryField(page, 'Month Year to Current', 'Dates', '1842 to 1843');

  // An empty part leaves no gap on the page, and waits in the editor for text.
  await expect(job).toContainText('Job Title, Babbage & Co');
  await expect(job).not.toContainText('Babbage & Co,');
  await expect(job).toContainText('1842 to 1843');
  // The job's, above the example's projects, which have no location either.
  await expect(
    page.getByRole('complementary').getByText('Location or Remote', { exact: true })
  ).toHaveCount(3);

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const boot = await window.mosaic.db.boot();
        if (!boot.ok) throw new Error(boot.message);
        const entry = boot.value.draft?.doc.sections[1].items[0];
        return [entry?.title, entry?.organization, entry?.location, entry?.dates];
      })
    )
    .toEqual(['Job Title', 'Babbage & Co', '', '1842 to 1843']);
  expect(errors).toEqual([]);
});
