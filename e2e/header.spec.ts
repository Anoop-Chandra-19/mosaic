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
