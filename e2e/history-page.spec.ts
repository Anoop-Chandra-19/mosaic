import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();

const BULLETS = [
  'Kept the dispatch queue under a second at peak, across every region the company ran in and through every holiday rush.',
  'Cut the nightly batch from four hours to forty minutes by moving it onto the event stream the rest of the platform used.',
  'Wrote the runbook the on-call rotation still uses, and paired with each new engineer through their first incident.',
];

async function importResume(page: Page) {
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Import resume' }).click();
  const importing = page.getByRole('dialog', { name: 'Import' });
  const lines = ['Ada Lovelace', '', 'Experience'];
  for (let i = 1; i <= 6; i++)
    lines.push(`Analyst ${i}, Engine Works`, ...BULLETS.map((b) => `- ${b}`));
  await importing.getByLabel('Or paste the text').fill(lines.join('\n'));
  await importing.getByRole('button', { name: 'Read pasted text' }).click();
  await importing
    .getByRole('button', { name: /^Import/ })
    .last()
    .click();
  await expect(page.getByText('Imported. Check the sections in the sidebar.')).toBeVisible();
}

async function nameVersion(page: Page, name: string) {
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${name}”`)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Each frame's page in the read pane after `act`, as the bullets on each page, in runs. */
async function recordPageChanges(page: Page, act: () => Promise<void>): Promise<string[]> {
  await page.evaluate(() => {
    const w = window as unknown as { shown: string[] };
    w.shown = [];
    const start = performance.now();
    const tick = () => {
      const pages = document.querySelectorAll(
        'aside[aria-label^="Reading"] [data-preview-page-content]'
      );
      w.shown.push(
        [...pages]
          .map((p) =>
            [...p.querySelectorAll('[data-preview-bullet-id]')]
              .map((b) => b.textContent!.length)
              .join(',')
          )
          .join(' | ')
      );
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(1200);
  const shown = await page.evaluate(() => (window as unknown as { shown: string[] }).shown);
  return shown.filter((frame, i) => frame !== shown[i - 1]);
}

test('stepping to another version shows its page laid out, never the old text re-wrapping', async () => {
  const { page, errors } = mosaic();
  await importResume(page);
  await nameVersion(page, 'Long');

  // Every bullet short, so the two versions wrap and break pages differently.
  const sidebar = page.getByRole('complementary');
  for (const bullet of BULLETS) {
    const rows = sidebar.locator('[data-bullet-text]', { hasText: bullet });
    while ((await rows.count()) > 0) {
      await rows.first().click();
      const text = sidebar.getByRole('textbox', { name: 'Bullet text' });
      await text.fill(bullet.split(' ').slice(0, 5).join(' ') + '.');
      await text.press('Enter');
    }
  }
  await nameVersion(page, 'Short');

  await page.keyboard.press('Control+Shift+H');
  const history = page.getByRole('region', { name: /^History of/ });
  await expect(history).toBeVisible();
  const row = (name: string) => history.locator('li[data-version-id]').filter({ hasText: name });

  // The page it was showing, then the new one: nothing in between. It opens on Long.
  for (const name of ['Short', 'Long']) {
    const changes = await recordPageChanges(page, () => row(name).click());
    expect(changes).toHaveLength(2);
  }
  expect(errors).toEqual([]);
});
