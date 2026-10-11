import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

/** The example suggestions, staged through the developer tools, with AI on to see them. */
async function stageExampleSuggestions(page: Page) {
  await page.getByRole('button', { name: 'Developer tools' }).click();
  await page.getByRole('menuitem', { name: /Stage example suggestions/ }).click();
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
}

test('suggestions are reviewed from the status bar, kept and dropped with the keys', async () => {
  const { page, errors } = mosaic();
  await stageExampleSuggestions(page);

  await page.getByRole('button', { name: '12 suggestions waiting' }).click();
  const review = page.getByRole('region', { name: 'Suggestion review' });
  await expect(review.getByRole('heading', { name: 'Reviewing 12 suggestions' })).toBeVisible();
  const inspector = review.getByRole('complementary', { name: 'Suggestions' });
  await expect(inspector.getByText('1 / 12')).toBeVisible();

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
