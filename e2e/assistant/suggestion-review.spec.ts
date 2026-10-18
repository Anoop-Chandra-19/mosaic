import { expect, type Page } from '@playwright/test';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

/** The example suggestions, staged through the developer tools, which turn AI on to see them. */
async function stageExampleSuggestions(page: Page) {
  await page.getByRole('button', { name: 'Developer tools' }).click();
  await page.getByRole('menuitem', { name: /Stage example suggestions/ }).click();
  await expect(page.getByText(/Turned the assistant on/)).toBeVisible();
}

test('suggestions are reviewed from the status bar, kept and dropped with the keys', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);

  await page.getByRole('button', { name: '12 suggestions waiting' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  await expect(review.getByRole('heading', { name: 'Reviewing 12 suggestions' })).toBeVisible();
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  await expect(inspector.getByText('1 / 12')).toBeVisible();
  // The opening transition holds input while it runs, so the keys wait for it.
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));

  // Keep moves on to the next; drop stays.
  await page.keyboard.press('a');
  await expect(inspector.getByText('2 / 12')).toBeVisible();
  await page.keyboard.press('r');
  await expect(inspector.getByRole('button', { name: 'Dropped' })).toBeVisible();
  await page.keyboard.press('k');
  await expect(inspector.getByRole('button', { name: 'Kept' })).toBeVisible();

  // Esc steps back to the list, then back to the draft, which nothing has touched.
  await page.keyboard.press('Escape');
  await expect(inspector.getByText('12 suggestions', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(review).toBeHidden();
  await expect(page.getByRole('button', { name: '11 suggestions waiting' })).toBeVisible();
  await expect(page.getByText('Assisted in migrating billing to Postgres').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a number is filled in, a rewrite put in your words, and a new entry confirmed fact by fact', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);
  await page.getByRole('button', { name: '12 suggestions waiting' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  const status = inspector.getByText(/^(waiting|kept)/).first();

  // The number only you know: typed into the sentence, it keeps the suggestion.
  await inspector.getByRole('button', { name: 'All suggestions' }).click();
  await inspector
    .getByRole('button', { name: /^Rewrite, bullet 3/ })
    .first()
    .click();
  await inspector.getByRole('textbox', { name: /number only you know/ }).fill('40');
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('kept');

  // In your words: Enter saves and keeps it, and the assistant's wording is one click back.
  await page.keyboard.press('k');
  await page.keyboard.press('k');
  await page.keyboard.press('e');
  const editor = inspector.getByRole('textbox', { name: 'The suggestion in your words' });
  await editor.fill('Led the move of billing to Postgres');
  await editor.press('Enter');
  await expect(status).toHaveText('kept · edited');
  await inspector.getByRole('button', { name: 'Back to the assistant’s wording' }).click();
  await expect(status).toHaveText('kept');

  // A new entry is kept only once each of its facts is confirmed.
  await page.keyboard.press('Escape');
  await inspector.getByRole('button', { name: /^New entry/ }).click();
  const keep = inspector.getByRole('button', { name: 'Confirm 4 more' });
  await expect(keep).toBeDisabled();
  for (const fact of ['title', 'organization', 'place', 'dates']) {
    await inspector.getByRole('button', { name: `Confirm ${fact}` }).click();
  }
  await inspector.getByRole('button', { name: 'Keep' }).click();
  await expect(inspector.getByRole('button', { name: 'Kept' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('what was kept applies as one step, which undo takes back to review', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);
  await page.getByRole('button', { name: '12 suggestions waiting' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  await inspector.getByRole('button', { name: 'Keep', exact: true }).click();

  await page.keyboard.press('Control+Enter');
  await expect(
    inspector.getByRole('heading', { name: 'Applied 1 of 12 suggestions' })
  ).toBeVisible();
  await inspector.getByRole('button', { name: 'Undo apply' }).click();
  await expect(review.getByRole('heading', { name: 'Reviewing 12 suggestions' })).toBeVisible();
  await expect(review.getByRole('button', { name: 'Apply 1 suggestion' })).toBeVisible();

  await review.getByRole('button', { name: 'Apply 1 suggestion' }).click();
  await inspector.getByRole('button', { name: 'Back to draft' }).click();
  await expect(review).toBeHidden();
  await expect(page.getByRole('button', { name: '11 suggestions waiting' })).toBeVisible();
  await expect(
    page.getByRole('complementary').getByText('Led the billing migration to Postgres')
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('editing a bullet puts its suggestion out of date, undo brings it back, and its dot opens it', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);
  const editor = page.getByRole('complementary').first();

  await editor.getByText('Assisted in migrating billing to Postgres').click();
  await expect(editor.getByText(/Saving your edit puts it out of date/)).toBeVisible();
  await page.keyboard.type(' quickly');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: /11 suggestions waiting\s*· 1 out of date/ })
  ).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: '12 suggestions waiting' })).toBeVisible();

  await editor.getByRole('button', { name: 'Review its suggestion' }).nth(1).click();
  const inspector = page
    .getByRole('region', { name: 'Suggestion review' })
    .getByRole('complementary', { name: 'Suggestions' });
  await expect(inspector.getByText('2 / 12')).toBeVisible();
  expect(errors).toEqual([]);
});

test('applying with a name keeps it in history under that name', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);
  await page.getByRole('button', { name: '12 suggestions waiting' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  await inspector.getByRole('button', { name: 'Keep', exact: true }).click();

  await review.getByRole('button', { name: /New version/ }).click();
  const menu = page.getByRole('dialog');
  await menu.getByText('Name it', { exact: true }).click();
  await menu.getByRole('textbox', { name: 'Version name' }).fill('Tightened for Northwind');
  await menu.getByRole('button', { name: 'Done' }).click();
  await expect(
    review.getByRole('button', { name: 'Named “Tightened for Northwind”' })
  ).toBeVisible();
  await review.getByRole('button', { name: 'Apply 1 suggestion' }).click();
  await inspector.getByRole('button', { name: 'Back to draft' }).click();
  await expect(review).toBeHidden();

  await page.keyboard.press('Control+Shift+H');
  await expect(
    page
      .getByRole('region', { name: /^History of/ })
      .getByRole('button', { name: /^Tightened for Northwind v2/ })
  ).toBeVisible();
  expect(errors).toEqual([]);
});
