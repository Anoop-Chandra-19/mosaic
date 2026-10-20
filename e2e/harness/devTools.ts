import type { Page } from '@playwright/test';

/*
 * The app's developer tools, which e2e runs through the same table as the palette, for
 * setup: a spec clicks only what it tests. Built apps under test are development builds,
 * so the hook is there. A setup a spec needs that no tool makes becomes a tool first.
 */

type DevToolArgs = Record<string, string | number | boolean>;

interface DevTestHook {
  run(toolId: string, args?: DevToolArgs): Promise<string>;
}

/** Runs a tool by its id, resolving once it is done with what the palette would say. */
export async function runDevTool(page: Page, toolId: string, args: DevToolArgs = {}) {
  await page.waitForFunction(() => 'mosaicDev' in window);
  return page.evaluate(
    ([id, choices]) => (window as unknown as { mosaicDev: DevTestHook }).mosaicDev.run(id, choices),
    [toolId, args] as const
  );
}
