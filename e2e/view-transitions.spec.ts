import { expect, test, type Page } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

/*
 * View transitions fail quietly: a duplicate or misspelled name makes the browser skip one
 * (its `ready` rejects), and nothing else notices. These count every transition the app
 * starts, with its types and whether it ran. How one looks is checked by eye, frame by
 * frame; see the renderer CLAUDE.md.
 */

interface Started {
  types: string[];
  ran: boolean | null;
}

async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const started: { types: string[]; ran: boolean | null }[] = [];
    (window as unknown as { started: typeof started }).started = started;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((options: { types?: string[] }) => {
      const record = { types: [...(options?.types ?? [])], ran: null as boolean | null };
      started.push(record);
      const transition = start(options as never);
      transition.ready.then(
        () => (record.ran = true),
        () => (record.ran = false)
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
  return {
    /** The transitions started since the last call, once each has run or been skipped. */
    async take(count: number): Promise<Started[]> {
      await page.waitForFunction(
        (n) => {
          const started = (window as unknown as { started: Started[] }).started;
          return started.length >= n && started.every((s) => s.ran !== null);
        },
        count,
        { timeout: 5000 }
      );
      return page.evaluate(() => {
        const started = (window as unknown as { started: Started[] }).started;
        return started.splice(0);
      });
    },
  };
}

async function editAndName(page: Page, person: string, version: string) {
  await page
    .getByRole('complementary')
    .getByText(/^(Your Name|Ada Lovelace)$/)
    .first()
    .click();
  await page.getByPlaceholder('Your name').fill(person);
  await page.getByPlaceholder('Your name').press('Enter');
  await page.keyboard.press('Control+s');
  await page.getByLabel('Version name').fill(version);
  await page.getByRole('dialog').getByRole('button', { name: 'Name version' }).click();
  await expect(page.getByText(`Named “${version}”`)).toBeVisible();
}

async function startWithVersions(page: Page) {
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  await editAndName(page, 'Ada Lovelace', 'Draft A');
  await editAndName(page, 'Grace Hopper', 'Draft B');
  // Out of the name field, so the history key reaches the app.
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
}

const versionRow = (page: Page, name: string) =>
  page
    .getByRole('region', { name: /^History of/ })
    .locator('li[data-version-id]')
    .filter({ hasText: name });

test('opening, stepping through, and closing the history each run one transition', async () => {
  const { page, errors } = mosaic();
  await startWithVersions(page);
  const transitions = await watchTransitions(page);

  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  await versionRow(page, 'Draft A').click();
  // An older version is a step back in time; a newer one, forward.
  expect(await transitions.take(1)).toEqual([{ types: ['step-back'], ran: true }]);
  await versionRow(page, 'Draft B').click();
  expect(await transitions.take(1)).toEqual([{ types: ['step-forward'], ran: true }]);

  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeHidden();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);
  expect(errors).toEqual([]);
});

test('with reduced motion the transitions still run, only without moving', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startWithVersions(page);
  const transitions = await watchTransitions(page);

  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  await versionRow(page, 'Draft A').click();
  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeHidden();
  const started = await transitions.take(3);
  expect(started.map((s) => s.ran)).toEqual([true, true, true]);
  expect(errors).toEqual([]);
});
