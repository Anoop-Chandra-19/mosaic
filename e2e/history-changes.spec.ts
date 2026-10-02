import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

async function nameVersion(page: Page, version: string) {
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(version);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${version}”`)).toBeVisible();
}

async function setName(page: Page, name: string) {
  await page
    .getByRole('complementary')
    .getByText(/^(Your Name|Ada Lovelace)$/)
    .first()
    .click();
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('Your name').press('Enter');
}

/** Three named versions: a name, another name, then underlined links and nothing else. */
async function startWithVersions(page: Page) {
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  await setName(page, 'Ada Lovelace');
  await nameVersion(page, 'First');
  await setName(page, 'Grace Hopper');
  await nameVersion(page, 'Second');
  await page.getByRole('button', { name: 'Header options' }).click();
  await page.getByRole('menuitemradio', { name: 'Underlined' }).click();
  await page.keyboard.press('Escape');
  await nameVersion(page, 'Restyled');
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  const view = page.getByRole('region', { name: /^History of/ });
  await expect(view).toBeVisible();
  return view;
}

test('the read pane says what a version changed, against the one before it or the draft', async () => {
  const { page, errors } = mosaic();
  const view = await startWithVersions(page);
  const reading = view.getByRole('complementary');

  // It opens on Second: its words differ from the draft only in how links look, so it
  // isn't "identical", and Restore stays on.
  await expect(reading.getByRole('heading', { name: 'Second', exact: true })).toBeVisible();
  await expect(reading).toContainText('same words as your draft, formatting differs');
  await expect(reading.getByRole('button', { name: 'Restore' })).toBeEnabled();

  // Against the version before it: the name it changed, one line until opened.
  await expect(reading.getByRole('radio', { name: /^Changes in v\d+$/ })).toBeChecked();
  await expect(
    reading.getByRole('button', { name: /1 change\s*1 edited\s*in Header/ })
  ).toBeVisible();
  await reading.getByRole('button', { name: /1 change/ }).click();
  const changes = reading.getByLabel('Changes');
  await expect(changes.getByRole('button', { name: /Name\s*edited/ })).toBeVisible();
  await expect(reading).toContainText(/What v\d+ changed from v\d+\./);

  // Against the draft: the same words, and the links are the difference.
  await reading.getByRole('radio', { name: 'Against your draft' }).click();
  await expect(
    reading.getByRole('button', { name: /Same words\s*formatting differs/ })
  ).toBeVisible();
  const changeList = reading.getByLabel('Changes');
  await expect(changeList).toContainText('Links plain');
  await expect(changeList).toContainText('underlined in your draft');
  await expect(reading).toContainText('Restoring v');

  // Changes only shows the formatting as old → new.
  await reading.getByRole('button', { name: 'View as: Page' }).click();
  await page.getByRole('menuitemradio', { name: /Changes only/ }).click();
  const formatting = reading.getByRole('region', { name: 'Formatting' });
  await expect(formatting).toContainText('Links');
  await expect(formatting).toContainText('Underlined → Plain');
  expect(errors).toEqual([]);
});

test('Changes only steps through with n, and the details add line numbers', async () => {
  const { page, errors } = mosaic();
  const view = await startWithVersions(page);
  const reading = view.getByRole('complementary');
  await reading.getByRole('button', { name: 'View as: Page' }).click();
  await page.getByRole('menuitemradio', { name: /Changes only/ }).click();

  const header = reading.getByRole('region', { name: 'Header' });
  await expect(header).toContainText('Ada Lovelace');
  await expect(header).toContainText('Grace Hopper');
  await expect(header).not.toContainText('@@');

  await page.keyboard.press('n');
  await expect(header.locator('[aria-current="true"]')).toHaveCount(1);

  await view.getByText('Show all details').click();
  await expect(header).toContainText('@@');
  await expect(view.getByRole('navigation', { name: 'History index' })).toContainText('Months');

  // ↑ reads the newer version; ↓ comes back.
  await page.keyboard.press('ArrowUp');
  await expect(reading.getByRole('heading', { name: 'Restyled', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(reading.getByRole('heading', { name: 'Second', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the comparison and the details are remembered, and Settings shows the details', async () => {
  const { page, errors } = mosaic();
  const view = await startWithVersions(page);
  const reading = view.getByRole('complementary');
  await reading.getByRole('radio', { name: 'Against your draft' }).click();
  await view.getByText('Show all details').click();
  // Away from the checkbox, so its tooltip doesn't take the Escape before the view does.
  await view.focus();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();

  await page.keyboard.press('Control+Shift+H');
  await expect(
    view.getByRole('complementary').getByRole('radio', { name: 'Against your draft' })
  ).toBeChecked();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('navigation').getByRole('button', { name: 'History' }).click();
  await expect(settings.getByRole('switch', { name: 'Always show all details' })).toBeChecked();
  expect(errors).toEqual([]);
});
