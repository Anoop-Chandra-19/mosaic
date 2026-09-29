import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

const LONG = 'Rebuilt the billing export for the finance team. Cut its run from hours to minutes.';
const SHORT = 'Mentored two new engineers.';

const RESUME = [
  'Ada Lovelace',
  '',
  'Experience',
  'Analyst, Engine Works',
  `- ${LONG}`,
  `- ${SHORT}`,
].join('\n');

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
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

/** The bullets in order, an open editor as its text in brackets. */
function readBullets(page: Page) {
  return () =>
    page
      .getByRole('complementary')
      .locator('.group\\/bullet, textarea')
      .evaluateAll((rows) =>
        rows.map((row) =>
          row instanceof HTMLTextAreaElement ? `[${row.value}]` : (row.textContent?.trim() ?? '')
        )
      );
}

async function openBulletMenu(page: Page, text: string) {
  const row = page.getByRole('complementary').locator('.group\\/bullet', { hasText: text });
  await row.hover();
  await row.getByRole('button', { name: 'Bullet actions' }).click();
}

test('Shift+Enter splits at the cursor, opens the new bullet, and one Undo takes it back', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = readBullets(page);

  await sidebar.getByText(LONG).click();
  const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await text.fill(LONG.replace('hours', 'three hours'));
  await text.evaluate((field: HTMLTextAreaElement) => {
    const at = field.value.indexOf('Cut');
    field.setSelectionRange(at, at);
  });
  await text.press('Shift+Enter');

  await expect
    .poll(bullets)
    .toEqual([
      'Rebuilt the billing export for the finance team.',
      '[Cut its run from three hours to minutes.]',
      SHORT,
    ]);
  const opened = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await expect(opened).toBeFocused();
  expect(await opened.evaluate((field: HTMLTextAreaElement) => field.selectionStart)).toBe(0);
  await opened.press('Escape');

  // The edit and the split are one step.
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect.poll(bullets).toEqual([LONG, SHORT]);
  expect(errors).toEqual([]);
});

test('a split is refused at either end, and the note says why', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = readBullets(page);

  await sidebar.getByText(SHORT).click();
  const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await text.press('Home');
  await text.press('Shift+Enter');
  await expect(sidebar.getByRole('status')).toHaveText(
    'The cursor is at the start. Move it to where the new bullet should begin.'
  );
  expect(await bullets()).toEqual([LONG, `[${SHORT}]`]);

  await text.press('ArrowRight');
  await expect(sidebar.getByRole('status')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Split bullet picks a point first: the marker starts at the sentence break', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = readBullets(page);

  await openBulletMenu(page, LONG);
  await page.getByRole('menuitem', { name: 'Split bullet' }).click();
  const text = sidebar.getByRole('textbox', {
    name: 'Bullet text. The new bullet starts at the cursor.',
  });
  await expect(text).toBeFocused();
  await expect(sidebar.getByRole('status')).toHaveText(
    'The text after the marker becomes a new bullet below.'
  );
  expect(await text.evaluate((field: HTMLTextAreaElement) => field.selectionStart)).toBe(
    LONG.indexOf('Cut')
  );

  await text.press('End');
  await expect(sidebar.getByRole('status')).toHaveText(
    'The cursor is at the end. Move it to where the new bullet should begin.'
  );
  await expect(sidebar.getByRole('button', { name: 'Split here' })).toBeDisabled();

  // Escape leaves split mode, not the editor.
  await text.press('Escape');
  const editing = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await expect(editing).toBeFocused();
  await editing.press('Escape');
  expect(await bullets()).toEqual([LONG, SHORT]);

  await openBulletMenu(page, LONG);
  await page.getByRole('menuitem', { name: 'Split bullet' }).click();
  await sidebar.getByRole('button', { name: 'Split here' }).click();
  await expect
    .poll(bullets)
    .toEqual([
      'Rebuilt the billing export for the finance team.',
      '[Cut its run from hours to minutes.]',
      SHORT,
    ]);
  await expect(page.getByText('Split into two bullets', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Ctrl+Shift+J folds the bullet below in; Escape puts both back, Enter merges', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = readBullets(page);

  await sidebar.getByRole('checkbox', { name: 'Toggle bullet visibility' }).first().focus();
  await page.keyboard.press('Control+Shift+J');
  const merged = sidebar.getByRole('textbox', { name: 'Merged text of two bullets' });
  await expect(merged).toBeFocused();
  await expect.poll(bullets).toEqual([`[${LONG} ${SHORT}]`]);

  await merged.press('Escape');
  await expect.poll(bullets).toEqual([LONG, SHORT]);

  await openBulletMenu(page, LONG);
  await page.getByRole('menuitem', { name: 'Merge with bullet below' }).click();
  await sidebar.getByRole('textbox', { name: 'Merged text of two bullets' }).press('Enter');
  await expect.poll(bullets).toEqual([`${LONG} ${SHORT}`]);
  await expect(page.getByText('Merged two bullets', { exact: true })).toBeVisible();

  await openBulletMenu(page, SHORT);
  await expect(page.getByRole('menuitem', { name: 'Merge with bullet below' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('merging a bullet that is off the resume asks which the merged one is', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const checks = sidebar.getByRole('checkbox', { name: 'Toggle bullet visibility' });
  await checks.nth(1).click();

  await openBulletMenu(page, LONG);
  await page.getByRole('menuitem', { name: 'Merge with bullet below' }).click();
  await expect(sidebar.getByText('The bullet below is off the resume.')).toBeVisible();
  // It starts as the first bullet is, since the first keeps its place.
  await expect(sidebar.getByRole('radio', { name: 'On the resume' })).toBeChecked();
  await sidebar.getByRole('radio', { name: 'Left off' }).click();
  await sidebar.getByRole('button', { name: 'Merge', exact: true }).click();

  await expect(checks).toHaveCount(1);
  await expect(checks).not.toBeChecked();
  await expect(
    page.getByText('Merged two bullets. The merged bullet is off the resume.')
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('merging from an open editor starts from the text as edited', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');
  const bullets = readBullets(page);

  await sidebar.getByText(LONG).click();
  const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await text.fill('Rebuilt the billing export.');
  await text.press('Control+Shift+J');

  const merged = sidebar.getByRole('textbox', { name: 'Merged text of two bullets' });
  await expect(merged).toHaveValue(`Rebuilt the billing export. ${SHORT}`);
  await merged.press('Enter');
  await expect.poll(bullets).toEqual([`Rebuilt the billing export. ${SHORT}`]);
  expect(errors).toEqual([]);
});

test('pasting several lines replaces the selection, joined into one line', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  const sidebar = page.getByRole('complementary');

  await sidebar.getByText(SHORT).click();
  const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
  await text.evaluate((field: HTMLTextAreaElement) => {
    field.setSelectionRange(field.value.indexOf('two'), field.value.indexOf(' new'));
    const data = new DataTransfer();
    data.setData('text', 'three\nsenior');
    field.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    );
  });

  await expect(text).toHaveValue('Mentored three senior new engineers.');
  expect(await text.evaluate((field: HTMLTextAreaElement) => field.selectionStart)).toBe(
    'Mentored three senior'.length
  );
  expect(errors).toEqual([]);
});
