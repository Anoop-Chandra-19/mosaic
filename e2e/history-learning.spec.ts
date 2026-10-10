import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp({ showHistoryTips: true });

async function setName(page: Page, current: string, next: string) {
  await page.getByRole('complementary').getByText(current, { exact: true }).click();
  await page.getByPlaceholder('Your name').fill(next);
  await page.getByPlaceholder('Your name').press('Enter');
}

async function nameVersion(page: Page, name: string) {
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(name);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Save|Name) v\d/ })
    .click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
}

/** Created, then three named versions: enough history for tips, not a short line. */
async function startWithFour(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  for (const [index, name] of ['Ada', 'Grace', 'Edsger'].entries()) {
    await setName(page, index === 0 ? 'Your name' : ['Ada', 'Grace'][index - 1], name);
    await nameVersion(page, `Sent as ${name}`);
  }
}

const openHistory = async (page: Page) => {
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
};

test('a kind of row is explained once, and Got it sees it for good', async () => {
  const { page, errors } = mosaic();
  await startWithFour(page);
  await openHistory(page);

  const tip = page.getByRole('note', { name: 'A version you named' });
  await expect(tip).toContainText('The diamond marks v4');
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);

  await page.keyboard.press('Escape');
  await openHistory(page);
  await page.waitForTimeout(800);
  await expect(page.getByRole('note', { name: 'A version you named' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the history tour runs on the example, and your own history comes back', async () => {
  const { page, errors } = mosaic();
  await startWithFour(page);
  await openHistory(page);
  const view = page.getByRole('region', { name: /^History of/ });

  await view.getByRole('button', { name: 'History settings' }).click();
  await page
    .getByRole('dialog', { name: 'History settings' })
    .getByRole('button', { name: 'How history works' })
    .click();
  const card = page.locator('[data-tour-card]');
  await expect(card).toContainText('How history works');
  await expect(
    page.getByText('An example history, so every kind of row is there to see.')
  ).toBeVisible();
  await expect(view).toContainText('Sent to Northwind');
  await expect(view).not.toContainText('Sent as Edsger');

  await card.getByRole('button', { name: 'Show me' }).click();
  for (const title of [
    'What the marks mean',
    'One number per piece of work',
    'Read before you restore',
    'Restoring loses nothing',
    'You decide what gets a row',
  ]) {
    await card.getByRole('button', { name: 'Next' }).click();
    await expect(card).toContainText(title);
  }
  await card.getByRole('button', { name: 'Got it' }).click();

  await expect(card).toHaveCount(0);
  await expect(view).toContainText('Sent as Edsger');
  await expect(view).not.toContainText('Sent to Northwind');
  // Finishing explained the kinds of row it showed, so no tip comes for a named version.
  await page.waitForTimeout(800);
  await expect(page.getByRole('note', { name: 'A version you named' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
