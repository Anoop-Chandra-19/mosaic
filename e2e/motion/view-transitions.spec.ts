import { expect, type Page } from '@playwright/test';
import { runDevTool } from '../harness/devTools';
import { test, withApp } from '../harness/launch';

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
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Save|Name) v\d/ })
    .click();
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

test('opening and closing the history each run one transition, and stepping runs none', async () => {
  const { page, errors } = mosaic();
  await startWithVersions(page);
  const transitions = await watchTransitions(page);

  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  // A step is ordinary animation, which never holds back the next key.
  await versionRow(page, 'Draft B').click();
  await expect(page.getByRole('complementary', { name: /^Reading / })).toContainText('Draft B');
  await versionRow(page, 'Draft A').click();
  await expect(page.getByRole('complementary', { name: /^Reading / })).toContainText('Draft A');

  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeHidden();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);
  expect(errors).toEqual([]);
});

/** The example suggestions, staged through the developer tools, which turn AI on to see them. */
async function stageSuggestions(page: Page) {
  await runDevTool(page, 'stageSuggestions');
}

test('the suggestion review opens and closes in one transition each, from the pane or without it', async () => {
  const { page, errors } = mosaic();
  await stageSuggestions(page);
  const review = page.getByRole('region', { name: 'Suggestion review' });
  const assistant = page.getByRole('complementary', { name: 'Assistant' });

  // With the assistant pane open (as it is once AI is on), it hands its column to the
  // review's inspector.
  await expect(assistant).toBeVisible();
  const transitions = await watchTransitions(page);
  await page.getByRole('button', { name: /suggestions waiting/ }).click();
  await expect(review).toBeVisible();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  // Compare all steps the way the toggle runs; keeping and moving never start one.
  await review.getByRole('radio', { name: 'Compare all' }).click();
  expect(await transitions.take(1)).toEqual([{ types: ['step-forward'], ran: true }]);
  await page.keyboard.press('a');
  await page.keyboard.press('j');
  await review.getByRole('radio', { name: 'On the page' }).click();
  expect(await transitions.take(1)).toEqual([{ types: ['step-back'], ran: true }]);

  // Apply, and undoing it, each cross-fade the page and the inspector as one.
  await page.keyboard.press('Control+Enter');
  expect(await transitions.take(1)).toEqual([{ types: ['crossfade'], ran: true }]);
  await page.keyboard.press('Control+z');
  expect(await transitions.take(1)).toEqual([{ types: ['crossfade'], ran: true }]);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(review).toBeHidden();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  // Without it, the inspector comes in from the edge, alone.
  await page.keyboard.press('Control+j');
  await expect(assistant).toBeHidden();
  await transitions.take(0);
  await page.getByRole('button', { name: /suggestions waiting/ }).click();
  await expect(review).toBeVisible();
  // A transition holds input while it runs, so the keys wait for it.
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(review).toBeHidden();
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
  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeHidden();
  const started = await transitions.take(2);
  expect(started.map((s) => s.ran)).toEqual([true, true]);
  expect(errors).toEqual([]);
});

test('hiding and showing the sidebar and the assistant each run one transition', async () => {
  const { page, errors } = mosaic();
  await startWithVersions(page);
  const transitions = await watchTransitions(page);
  const contentTab = page.getByRole('tab', { name: 'Content' });

  await page.keyboard.press('Control+b');
  await expect(contentTab).toBeHidden();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  // With the sidebar gone, the page still moves into the history view and back.
  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeVisible();
  await page.keyboard.press('Control+Shift+H');
  await expect(page.getByRole('region', { name: /^History of/ })).toBeHidden();
  expect((await transitions.take(2)).map((s) => s.ran)).toEqual([true, true]);

  await page.keyboard.press('Control+b');
  await expect(contentTab).toBeVisible();
  expect(await transitions.take(1)).toEqual([{ types: [], ran: true }]);

  // The assistant pane slides the same way, from the right.
  await page.evaluate(() =>
    window.mosaic.db.settings.set(
      'agentSettings',
      JSON.stringify({ state: { enabled: true }, version: 0 })
    )
  );
  await page.reload();
  const pane = page.getByRole('complementary', { name: 'Assistant' });
  await expect(pane).toBeVisible();
  const paneTransitions = await watchTransitions(page);

  await page.keyboard.press('Control+\\');
  await expect(pane).toBeHidden();
  expect(await paneTransitions.take(1)).toEqual([{ types: [], ran: true }]);

  await page.keyboard.press('Control+\\');
  await expect(pane).toBeVisible();
  expect(await paneTransitions.take(1)).toEqual([{ types: [], ran: true }]);
  expect(errors).toEqual([]);
});

test('ending the history tour cross-fades its veil and the example out as one', async () => {
  const { page, errors } = mosaic();
  await startWithVersions(page);
  await page.keyboard.press('Control+Shift+H');
  const view = page.getByRole('region', { name: /^History of/ });
  await expect(view).toBeVisible();
  await view.getByRole('button', { name: 'History settings' }).click();
  await page
    .getByRole('dialog', { name: 'History settings' })
    .getByRole('button', { name: 'How history works' })
    .click();
  await expect(page.locator('[data-tour-card]')).toBeVisible();
  const transitions = await watchTransitions(page);

  await page.keyboard.press('Escape');
  expect(await transitions.take(1)).toEqual([{ types: ['crossfade'], ran: true }]);
  await expect(page.locator('[data-tour-card]')).toHaveCount(0);
  await expect(view).toContainText('Draft B');
  expect(errors).toEqual([]);
});
