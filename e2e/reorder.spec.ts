import { expect, test, type Locator, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

const RESUME = [
  'Ada Lovelace',
  'ada@example.com',
  '',
  'Experience',
  'Analyst, Engine Works',
  '- First bullet about the engine',
  '- Second bullet about the engine',
  '- Third bullet about the engine',
  '',
  'Education',
  'Mathematics, University of London',
].join('\n');

/** One entry with more bullets than the sidebar can show at once. */
function longResume(bullets: number): string {
  return [
    'Ada Lovelace',
    'ada@example.com',
    '',
    'Experience',
    'Analyst, Engine Works',
    ...Array.from(
      { length: bullets },
      (_, i) => `- Bullet ${String(i + 1).padStart(2, '0')} about the engine`
    ),
  ].join('\n');
}

async function importResume(page: Page, text = RESUME) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
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

/** Press the grip, carry it to just inside the top of `target`, and let go there. */
async function dragAbove(page: Page, row: Locator, grip: Locator, target: Locator) {
  await row.hover();
  const from = (await grip.boundingBox())!;
  const to = (await target.boundingBox())!;
  const x = from.x + from.width / 2;
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, to.y + 2, { steps: 8 });
  await page.mouse.up();
}

test('a bullet is dragged into place, and one undo puts it back', async () => {
  const { page, errors } = mosaic();
  const sidebar = page.getByRole('complementary');
  const bullets = () => sidebar.getByText(/^(First|Second|Third) bullet/).allTextContents();
  await importResume(page);
  await expect
    .poll(bullets)
    .toEqual([
      'First bullet about the engine',
      'Second bullet about the engine',
      'Third bullet about the engine',
    ]);

  // A grip shows only on its own row, so once the third is hovered there is just the one.
  await dragAbove(
    page,
    sidebar.getByText('Third bullet about the engine'),
    sidebar.getByRole('button', { name: 'Drag bullet to reorder' }),
    sidebar.getByText('First bullet about the engine')
  );

  await expect
    .poll(bullets)
    .toEqual([
      'Third bullet about the engine',
      'First bullet about the engine',
      'Second bullet about the engine',
    ]);
  // The whole drag is one step, named like the menu's moves.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveAttribute(
    'title',
    /^Undo reorder bullets/
  );
  await page.keyboard.press('Control+z');
  await expect
    .poll(bullets)
    .toEqual([
      'First bullet about the engine',
      'Second bullet about the engine',
      'Third bullet about the engine',
    ]);
  expect(errors).toEqual([]);
});

test('holding a drag at the sidebar edge scrolls the list under it', async () => {
  const { page, errors } = mosaic();
  const sidebar = page.getByRole('complementary');
  const panel = sidebar.getByRole('tabpanel');
  const bullets = sidebar.getByText(/^Bullet \d\d about the engine$/);
  await importResume(page, longResume(40));
  await expect(bullets.first()).toHaveText('Bullet 01 about the engine');

  await sidebar.getByText('Bullet 01 about the engine').hover();
  const grip = (await sidebar
    .getByRole('button', { name: 'Drag bullet to reorder' })
    .boundingBox())!;
  const edge = (await panel.boundingBox())!;
  const x = grip.x + grip.width / 2;
  await page.mouse.move(x, grip.y + grip.height / 2);
  await page.mouse.down();
  // Near the bottom and held still: only the scrolling can move the list now.
  await page.mouse.move(x, edge.y + edge.height - 4, { steps: 10 });
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
  await page.mouse.up();

  // It landed where the sidebar had scrolled to, well below where it started.
  await expect(bullets.first()).toHaveText('Bullet 02 about the engine');
  expect(errors).toEqual([]);
});

test('a section is dragged above another', async () => {
  const { page, errors } = mosaic();
  const sidebar = page.getByRole('complementary');
  const sections = () => sidebar.getByText(/^(Experience|Education)$/).allTextContents();
  await importResume(page);
  await expect.poll(sections).toEqual(['Experience', 'Education']);

  const education = sidebar.getByText('Education', { exact: true });
  await dragAbove(
    page,
    education,
    sidebar.getByRole('button', { name: 'Drag Education to reorder' }),
    sidebar.getByText('Experience', { exact: true })
  );

  await expect.poll(sections).toEqual(['Education', 'Experience']);
  expect(errors).toEqual([]);
});
