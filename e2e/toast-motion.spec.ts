import { expect, type Page } from '@playwright/test';
import { test, withApp } from './launch';

const mosaic = withApp();
const toastPill = (page: Page) => page.locator('[role="status"] > [data-state]');

async function nameVersion(page: Page, name: string) {
  await page.keyboard.press('Control+s');
  const dialog = page.getByRole('dialog', { includeHidden: true });
  await dialog.getByLabel('Version name').fill(name);
  await dialog.getByRole('button', { name: /^(Save|Name) v\d/ }).click();
  await expect(toastPill(page)).toContainText(`Named “${name}”`);
  await expect(dialog).toHaveCount(0);
}

/** Pause native exits in the mutation microtask, before their first frame. */
async function holdToastExits(page: Page) {
  return page.evaluateHandle(() => {
    const exits: Animation[] = [];
    const observer = new MutationObserver(() => {
      const pill = document.querySelector('[role="status"] > [data-state]');
      for (const animation of pill?.getAnimations() ?? []) {
        if (animation.id !== 'presence-exit' || exits.includes(animation)) continue;
        animation.pause();
        animation.currentTime = 0;
        exits.push(animation);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
    return exits;
  });
}

test('a departing toast stays inert until replaced or its native exit finishes', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  const exits = await holdToastExits(page);
  await nameVersion(page, 'First receipt');
  const pill = toastPill(page);
  const departing = await pill.elementHandle();
  await pill.getByRole('button', { name: 'Dismiss' }).click();
  await expect.poll(() => exits.evaluate((exits) => exits.length)).toBe(1);
  await expect(pill).toHaveAttribute('data-state', 'closed');
  await expect(pill).toHaveAttribute('inert', '');
  await expect(pill).toHaveAttribute('aria-hidden', 'true');
  await expect(pill).toContainText('Named “First receipt”');

  await nameVersion(page, 'Second receipt');
  expect(await departing!.evaluate((pill) => pill.isConnected)).toBe(false);
  await expect.poll(() => exits.evaluate(([exit]) => exit.playState)).toBe('idle');
  await expect(pill).toHaveCount(1);
  await expect(pill).toHaveAttribute('data-state', 'open');
  await expect(pill).not.toHaveAttribute('inert', '');
  await expect(pill).not.toHaveAttribute('aria-hidden', 'true');
  await pill.getByRole('button', { name: 'Dismiss' }).click();
  await expect.poll(() => exits.evaluate((exits) => exits.length)).toBe(2);
  await expect(pill).toHaveAttribute('data-state', 'closed');
  await exits.evaluate((exits) => exits[1].finish());
  await expect(pill).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced-motion toasts skip presence animations for manual and automatic dismissal', async () => {
  const { page, errors } = mosaic();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.clock.install();
  const animations = await page.evaluateHandle(() => {
    const animations: Animation[] = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      const animation = animate.apply(this, args);
      animations.push(animation);
      return animation;
    };
    return animations;
  });
  const pill = toastPill(page);
  for (const dismissal of ['manual', 'automatic'] as const) {
    await nameVersion(page, `Reduced ${dismissal}`);
    await expect(pill).toHaveAttribute('data-state', 'open');
    if (dismissal === 'manual') {
      await pill.getByRole('button', { name: 'Dismiss' }).click();
    } else {
      await page.clock.fastForward(5000);
    }
    await expect(pill).toHaveCount(0);
    const hasPresenceMotion = await animations.evaluate((animations) =>
      animations.some(({ id }) => id.startsWith('presence-'))
    );
    expect(hasPresenceMotion).toBe(false);
  }
  expect(errors).toEqual([]);
});
