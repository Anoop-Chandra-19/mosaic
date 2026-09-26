import { expect, test, type Locator, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/**
 * What a button's hint says, read the way a person reads it: by pointing at it. The pointer
 * travels there in steps, as a real one does: leaving another button's hint opens a moment
 * in which the pointer may still be on its way to that hint, and only further movement
 * ends it. `hover()` jumps in one move. The hint just left can still be fading out beside
 * the new one, so the new one is found by what it says.
 */
async function expectHint(page: Page, button: Locator, text: RegExp) {
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await expect(page.getByRole('tooltip', { name: text })).toBeAttached();
}

/** Replace the contact name, whatever it is now, and leave the field. */
async function setName(page: Page, current: string, next: string) {
  await page.getByRole('complementary').getByText(current, { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(next);
  await page.getByPlaceholder('Your name').press('Enter');
}

function name(page: Page, text: string) {
  return page.getByRole('complementary').getByText(text, { exact: true });
}

test('a change is taken back and put back, from the keyboard or the top bar', async () => {
  const { page, errors } = mosaic();
  const bar = page.getByRole('contentinfo');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // Nothing has happened yet, so neither button offers anything.
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await setName(page, 'Your name', 'Ada Lovelace');
  await expect(bar.getByText('1 change since v1')).toBeVisible();
  await expectHint(page, undo, /^Undo edit the name/);

  // Ctrl+Z takes it back, and the status bar counts the draft back to the version.
  await page.keyboard.press('Control+z');
  await expect(name(page, 'Your name')).toBeVisible();
  await expect(bar.getByText('Matches v1')).toBeVisible();
  await expect(undo).toBeDisabled();
  await expectHint(page, redo, /^Redo edit the name/);

  // Both redo shortcuts work, whichever one the reader learned elsewhere.
  await page.keyboard.press('Control+Shift+z');
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+y');
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  await expect(bar.getByText('1 change since v1')).toBeVisible();

  // And the two buttons do the same as the keys.
  await undo.click();
  await expect(name(page, 'Your name')).toBeVisible();
  await redo.click();
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  await expect(redo).toBeDisabled();
  expect(errors).toEqual([]);
});

test('undo walks back through several changes, and the sheet follows', async () => {
  const { page, errors } = mosaic();
  const bar = page.getByRole('contentinfo');
  const sheet = page.getByRole('main');
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // A section added and named is two steps of its own, on top of the name.
  await setName(page, 'Your name', 'Ada Lovelace');
  await page.getByRole('button', { name: 'Something else' }).click();
  await page.getByRole('menuitem', { name: /Custom section/ }).click();
  const sectionName = page.getByRole('textbox', { name: 'Section name' });
  await expect(sectionName).toBeFocused();
  await page.keyboard.type('Volunteering');
  await page.keyboard.press('Enter');
  await expect(bar.getByText('3 changes since v1')).toBeVisible();
  // The sheet is drawn twice: the pages, and the offscreen copy the paginator measures.
  await expect(sheet.getByText('Ada Lovelace').first()).toBeVisible();

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('complementary').getByText('New section')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('complementary').getByText('New section')).toHaveCount(0);
  await expect(bar.getByText('1 change since v1')).toBeVisible();

  await page.keyboard.press('Control+z');
  // The preview is drawn from the draft, so it walks back with it.
  await expect(sheet.getByText('Ada Lovelace')).toHaveCount(0);
  await expect(bar.getByText('Matches v1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the status bar says when the draft has been undone past a named version', async () => {
  const { page, errors } = mosaic();
  const bar = page.getByRole('contentinfo');
  await page.getByRole('button', { name: /Blank resume/ }).click();

  await setName(page, 'Your name', 'Ada Lovelace');
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill('Sent to Striped');
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(bar.getByText('Matches v2')).toBeVisible();

  await setName(page, 'Ada Lovelace', 'Grace Hopper');
  await expect(bar.getByText('1 change since v2')).toBeVisible();

  await page.keyboard.press('Control+z');
  await expect(bar.getByText('Matches v2')).toBeVisible();
  // A step further back than the version, which is a different thing to say.
  await page.keyboard.press('Control+z');
  await expect(name(page, 'Your name')).toBeVisible();
  await expect(bar.getByText('1 change undone past v2')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a field keeps its own undo while it is being typed in', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');

  // Ctrl+Z inside the field is the field's, so the document is left where it was.
  await name(page, 'Ada Lovelace').click();
  const field = page.getByPlaceholder('Your name');
  await field.fill('Grace Hopper');
  await page.keyboard.press('Control+z');
  await expect(field).toBeFocused();
  await field.press('Escape');
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an import is one step, and taking it back leaves the history standing', async () => {
  const { page, errors } = mosaic();
  const bar = page.getByRole('contentinfo');
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');

  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing
    .getByLabel('Or paste the text')
    .fill(
      ['Grace Hopper', 'grace@example.com', '', 'Experience', 'Programmer, Harvard'].join('\n')
    );
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  // Over the open resume, rather than as a template of its own.
  await importing.getByRole('button', { name: 'How to import' }).click();
  await page.getByRole('menuitemradio', { name: /^Replace/ }).click();
  await importing.getByRole('button', { name: 'Replace resume' }).click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
  await expect(name(page, 'Grace Hopper')).toBeVisible();

  // One step back is the whole import, and the resume that was there returns.
  await expectHint(page, page.getByRole('button', { name: 'Undo', exact: true }), /^Undo import/);
  await page.keyboard.press('Control+z');
  await expect(name(page, 'Ada Lovelace')).toBeVisible();

  // History still records that the import happened: undo moves the draft, not the log.
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByText(/Imported from pasted text/)).toBeVisible();
  await expect(bar.getByText('1 change undone past v3')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reading an older version stops the editor and undo until you come back', async () => {
  const { page, errors } = mosaic();
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');

  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill('Sent to Striped');
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await setName(page, 'Ada Lovelace', 'Grace Hopper');

  await page.getByRole('tab', { name: 'Templates' }).click();
  const named = page.getByRole('listitem').filter({ hasText: 'Sent to Striped' });
  await named.hover();
  await named.getByRole('button', { name: 'Read v2' }).click();
  await page.getByRole('tab', { name: 'Content' }).click();

  // The editor says what it is showing and takes nothing in the meantime.
  await expect(page.getByText(/Reading v2, not your draft/)).toBeVisible();
  // Both panes show the same document: the version, not the draft behind it.
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  await expect(
    page.getByRole('complementary').getByRole('button', { name: 'Restore to edit' })
  ).toBeVisible();

  await expect(undo).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(page.getByText('Go back to your draft to edit it.')).toBeVisible();
  await expect(name(page, 'Ada Lovelace')).toBeVisible();

  // Back to the draft, which is as it was left, and undo works on it again.
  await page.getByRole('complementary').getByRole('button', { name: 'Back to draft' }).click();
  await expect(name(page, 'Grace Hopper')).toBeVisible();
  await expect(undo).toBeEnabled();
  await page.keyboard.press('Control+z');
  await expect(name(page, 'Ada Lovelace')).toBeVisible();
  expect(errors).toEqual([]);
});

test('undo starts again for the template that opens next', async () => {
  const { page, errors } = mosaic();
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await setName(page, 'Your name', 'Ada Lovelace');
  await expect(undo).toBeEnabled();

  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await expect(undo).toBeDisabled();

  // The steps of the first template did not come along with it.
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('contentinfo').getByText('Matches v1')).toBeVisible();
  expect(errors).toEqual([]);
});
