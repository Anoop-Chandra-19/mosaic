import { expect, type Page } from '@playwright/test';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

/*
 * Stepping through versions: ordinary animation of the version stepped to, never a view
 * transition. Each step's movement is recorded as it starts, since it lasts 200 ms. When a
 * held key skims is a matter of milliseconds, so the rule has unit tests instead.
 */

async function recordSteps(page: Page) {
  await page.evaluate(() => {
    const steps: string[] = [];
    (window as unknown as { steps: string[] }).steps = steps;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const first = Array.isArray(keyframes) ? keyframes[0] : null;
      const transform = typeof first?.transform === 'string' ? first.transform : '';
      if (this.closest('aside') && transform.startsWith('translateX')) steps.push(transform);
      return animate.call(this, keyframes, options);
    };
  });
  return {
    /** The steps that moved since the last call, as where each started. */
    take: () => page.evaluate(() => (window as unknown as { steps: string[] }).steps.splice(0)),
  };
}
async function nameVersion(page: Page, person: string, version: string) {
  await page
    .getByRole('complementary')
    .getByText(/^(Your Name|Ada Lovelace|Grace Hopper)$/)
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

test('a step moves the version in, fast keys land where they point, and reduced motion only changes it', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Start from a sample/ }).click();
  await page.getByRole('button', { name: 'Example resume' }).click();
  for (const [person, version] of [
    ['Ada Lovelace', 'Draft A'],
    ['Grace Hopper', 'Draft B'],
    ['Ada Lovelace', 'Draft C'],
  ]) {
    await nameVersion(page, person, version);
  }
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  const reading = page.getByRole('complementary', { name: /^Reading / });
  await expect(reading).toContainText('Draft B');
  const steps = await recordSteps(page);

  // One step to a newer version: its words come in from the right, 12px out.
  await page.keyboard.press('ArrowUp');
  await expect(reading).toContainText('Draft C');
  await expect.poll(steps.take).toEqual([expect.stringMatching(/^translateX\([\d.]+px\)$/)]);

  // Keys faster than versions are read still count from the last one asked for.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(reading).toContainText('Draft A');
  await steps.take();

  // Reduced motion: the version just changes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowUp');
  await expect(reading).toContainText('Draft B');
  expect(await steps.take()).toEqual([]);
  expect(errors).toEqual([]);
});
