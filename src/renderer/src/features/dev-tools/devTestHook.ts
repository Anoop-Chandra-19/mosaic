import type { DevToolArgs } from '@shared/types/devTools';
import { runDevTool } from './devTools';

/** What e2e reaches the developer tools through (`e2e/harness/devTools.ts`). */
export interface DevTestHook {
  /** Runs a tool as the palette does, resolving with what it would tell the user. */
  run(toolId: string, args?: DevToolArgs): Promise<string>;
}

declare global {
  interface Window {
    /** Development builds only, which the e2e tests run. */
    mosaicDev?: DevTestHook;
  }
}

export function installDevTestHook(): void {
  window.mosaicDev = { run: (toolId, args = {}) => runDevTool({ toolId, args }) };
}
