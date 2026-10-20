import { expect, type Page } from '@playwright/test';

/*
 * The app's developer tools, which e2e runs through the same table as the palette, for
 * setup: a spec clicks only what it tests. Built apps under test are development builds,
 * so the hook is there. A setup a spec needs that no tool makes becomes a tool first.
 * Views are named by their address, as the app writes it:
 * "history / Tailored for Kestrel / v12 vs v11 / changes".
 */

type DevToolArgs = Record<string, string | number | boolean>;

interface DevTestHook {
  run(toolId: string, args?: DevToolArgs): Promise<string>;
  goTo(address: string): Promise<void>;
  here(): string;
}

async function reachHook(page: Page) {
  await page.waitForFunction(() => 'mosaicDev' in window);
}

/** Runs a tool by its id, resolving once it is done with what the palette would say. */
export async function runDevTool(page: Page, toolId: string, args: DevToolArgs = {}) {
  await reachHook(page);
  return page.evaluate(
    ([id, choices]) => (window as unknown as { mosaicDev: DevTestHook }).mosaicDev.run(id, choices),
    [toolId, args] as const
  );
}

/** Goes to a view by its address; fails the test with why when it doesn't exist. */
export async function goToView(page: Page, address: string) {
  await reachHook(page);
  await page.evaluate(
    (to) => (window as unknown as { mosaicDev: DevTestHook }).mosaicDev.goTo(to),
    address
  );
}

/** Waits until the app is at the view the address names. */
export async function expectViewAt(page: Page, address: string) {
  await reachHook(page);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { mosaicDev: DevTestHook }).mosaicDev.here())
    )
    .toBe(address);
}
