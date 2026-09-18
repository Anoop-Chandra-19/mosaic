import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** The header as the draft in the database has it: each line's separator and items. */
async function storedHeader(page: Page) {
  return page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return (boot.value.draft?.doc.contact.header.lines ?? []).map(({ separator, items }) => ({
      separator,
      items: items.map(({ kind, text, url, shown }) => ({ kind, text, url, shown })),
    }));
  });
}

/** The header on the first page of the preview. */
const pageHeader = (page: Page) => page.locator('[data-preview-header]').first();

/** An item's actions, which show while its row is hovered. */
async function itemAction(page: Page, text: string, kind: string, action: string) {
  await page.getByRole('button', { name: text, exact: true }).hover();
  await page.getByRole('button', { name: `${kind} actions` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

test('header items take text and a link, hide, and move between lines', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // A blank resume offers the usual items, empty, on the format's two lines.
  await expect(page.getByRole('region', { name: 'Line 1' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Line 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Email', exact: true }).click();
  const shows = page.getByPlaceholder('you@example.com');
  await expect(shows).toBeFocused();
  await shows.fill('ada@example.com');
  await page.getByPlaceholder('Optional').fill('ada@example.com');
  await expect(page.getByText('mailto:ada@example.com')).toBeVisible();
  await page.getByPlaceholder('Optional').press('Enter');

  const email = pageHeader(page).getByRole('link', { name: 'ada@example.com' });
  await expect(email).toHaveAttribute('href', 'mailto:ada@example.com');

  // Adding an item opens it, so its text can be typed straight away.
  await page.getByRole('button', { name: 'Add to line 1' }).click();
  await page.getByRole('menuitem', { name: 'GitHub' }).click();
  await expect(page.getByPlaceholder('github.com/you')).toBeFocused();
  await page.keyboard.type('github.com/ada');
  await page.keyboard.press('Enter');
  await expect(pageHeader(page)).toContainText('ada@example.com | github.com/ada');

  // Hidden: kept, but off the page.
  await itemAction(page, 'github.com/ada', 'GitHub', 'Leave off the page');
  await expect(pageHeader(page)).not.toContainText('github.com/ada');
  await itemAction(page, 'github.com/ada', 'GitHub', 'Put back on the page');

  // To line 2, which then prints with its own separator.
  await itemAction(page, 'github.com/ada', 'GitHub', 'Move to line 2');
  await page.getByRole('region', { name: 'Line 2' }).getByTitle('Between items').click();
  await page.getByRole('menuitemradio', { name: 'Separated by ·' }).click();

  await expect
    .poll(() => storedHeader(page))
    .toEqual([
      {
        separator: ' | ',
        items: [
          { kind: 'phone', text: '', url: '', shown: true },
          { kind: 'email', text: 'ada@example.com', url: 'ada@example.com', shown: true },
          { kind: 'linkedin', text: '', url: '', shown: true },
        ],
      },
      {
        separator: ' · ',
        items: [
          { kind: 'auth', text: '', url: '', shown: true },
          { kind: 'location', text: '', url: '', shown: true },
          { kind: 'github', text: 'github.com/ada', url: '', shown: true },
        ],
      },
    ]);
  await expect(pageHeader(page).getByText('github.com/ada')).toBeVisible();
  expect(errors).toEqual([]);
});

test('header buttons wrap, truncate and support keyboard editing at desktop widths', async () => {
  const { app, page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  const text = `ada-${'portfolio'.repeat(12)}`;
  const url = `https://example.com/${'projects/'.repeat(16)}`;
  await page.getByPlaceholder('you@example.com').fill(text);
  await page.getByPlaceholder('Optional').fill(url);
  await page.getByPlaceholder('Optional').press('Enter');

  const editText = page.getByRole('button', { name: text, exact: true });
  const editLink = page.getByRole('button', { name: 'Edit link', exact: true });
  for (const width of [720, 1280]) {
    await app.evaluate(({ BrowserWindow }, width) => {
      BrowserWindow.getAllWindows()[0].setSize(width, 800);
    }, width);
    for (const theme of ['light', 'dark']) {
      const isDark = await page
        .locator('html')
        .evaluate((element) => element.classList.contains('dark'));
      if (isDark !== (theme === 'dark')) {
        await page.getByRole('button', { name: 'Toggle theme' }).click();
      }
      await expect(editText).toBeVisible();
      await expect(editLink).toBeVisible();
      for (const control of [editText, editLink]) {
        await expect
          .poll(() =>
            control.evaluate((element) => {
              const bounds = element.getBoundingClientRect();
              const parent = element.parentElement!.getBoundingClientRect();
              return (
                bounds.left >= parent.left - 1 &&
                bounds.right <= parent.right + 1 &&
                element.scrollWidth <= element.clientWidth + 1
              );
            })
          )
          .toBe(true);
      }
      await expect(editText).toHaveCSS('white-space', 'normal');
      await expect(editLink.locator('span')).toHaveCSS('text-overflow', 'ellipsis');
      await editText.focus();
      await page.keyboard.press('Tab');
      await expect(editLink).toBeFocused();
      await expect(editLink).not.toHaveCSS('box-shadow', 'none');
      await page.keyboard.press('Enter');
      await expect(page.getByPlaceholder('Optional')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(editText).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});
