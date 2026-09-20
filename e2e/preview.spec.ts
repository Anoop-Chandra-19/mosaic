import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/** A resume long enough to run past one page: a heading, then bullets that wrap. */
function longResumeText(bullets: number): string {
  return [
    'Ada Lovelace',
    'ada@example.com',
    '',
    'Experience',
    'Analyst, Engine Works',
    ...Array.from(
      { length: bullets },
      (_, i) =>
        `- Wrote program ${i} for the analytical engine, checking every step of it by hand against the tables computed the long way, and wrote down whatever differed.`
    ),
  ].join('\n');
}

async function importPastedResume(page: Awaited<ReturnType<typeof mosaic>>['page'], text: string) {
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  await importing.getByLabel('Or paste the text').fill(text);
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

test('the preview draws every page, numbered, and says when a resume runs long', async () => {
  const { page, errors } = mosaic();
  const main = page.getByRole('main');
  await page.getByRole('button', { name: /Blank resume/ }).click();

  // One page: counted plainly, and a lone sheet needs no number on it.
  await expect(main.getByText('1 page', { exact: true })).toBeVisible();
  await expect(page.locator('[data-preview-page-number]')).toHaveCount(0);

  await importPastedResume(page, longResumeText(40));

  // Several pages: every one is drawn and numbered, and the count is called out.
  const sheets = page.locator('[data-preview-page-content]');
  await expect(sheets).toHaveCount(3);
  await expect(page.locator('[data-preview-page-number]')).toHaveText(['1 / 3', '2 / 3', '3 / 3']);
  await expect(main.getByText('3 pages', { exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByText('3 pages · A4')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a resume past ten pages is drawn as far as the preview goes, and says so', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await importPastedResume(page, longResumeText(400));

  await expect(page.locator('[data-preview-page-content]')).toHaveCount(10);
  await expect(page.getByText(/This resume runs past 10 pages/)).toBeVisible();
  // Counted as "more than ten" everywhere, rather than claiming a number it didn't reach.
  await expect(page.locator('[data-preview-page-number]').last()).toHaveText('10 / 10+');
  await expect(page.getByRole('main').getByText('10+ pages', { exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByText('10+ pages · A4')).toBeVisible();
  expect(errors).toEqual([]);
});
