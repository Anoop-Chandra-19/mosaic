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

test('the preview zooms to the pointer, pans with Space, and fits again', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const fit = page.getByRole('button', { name: 'Reset zoom' });
  const sheet = page.locator('[data-preview-page-content]').first();
  await expect(fit).toHaveText('100%');

  // Ctrl and the wheel, pointing a third of the way down the page.
  const box = (await sheet.boundingBox())!;
  const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 3 };
  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  await expect(fit).not.toHaveText('100%');

  const zoomed = (await sheet.boundingBox())!;
  expect(zoomed.width).toBeGreaterThan(box.width);
  // Whatever was under the pointer is still under it: the page grew around that line,
  // rather than the panel jumping to a different part of the resume.
  const grew = zoomed.height / box.height;
  const stayed = zoomed.y + (pointer.y - box.y) * grew;
  expect(Math.abs(stayed - pointer.y)).toBeLessThan(4);

  // Space and a drag move the page rather than selecting it.
  const scroller = page.locator('main > div').last();
  await page.keyboard.down('Space');
  await page.mouse.move(zoomed.x + 100, zoomed.y + 200);
  await page.mouse.down();
  await page.mouse.move(zoomed.x + 100, zoomed.y + 80, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  // The readout puts it back to a page that fits, scrolled to the top.
  await fit.click();
  await expect(fit).toHaveText('100%');
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(0);
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
