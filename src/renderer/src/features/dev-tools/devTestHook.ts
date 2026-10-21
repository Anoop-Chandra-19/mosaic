import type { DevToolArgs } from '@shared/types/devTools';
import { describeCurrentView, goToViewAddress } from '@/features/view-address/viewAddress';
import { runDevTool } from './devTools';
import { makeHistory, type HistorySpec } from './profiles/makeHistory';

/** What e2e reaches the developer tools through (`e2e/harness/devTools.ts`). */
export interface DevTestHook {
  /** Runs a tool as the palette does, resolving with what it would tell the user. */
  run(toolId: string, args?: DevToolArgs): Promise<string>;
  /** Goes to a view by its address, failing with why when it doesn't exist. */
  goTo(address: string): Promise<void>;
  /** The address of where the app is now. */
  here(): string;
  /** Adds a template with the history given and opens it, resolving with what it made. */
  makeHistory(spec: HistorySpec): Promise<string>;
}

async function goTo(address: string): Promise<void> {
  const resolution = await goToViewAddress(address);
  if ('error' in resolution) throw new Error(resolution.error);
  if ('sameName' in resolution) throw new Error(`Templates share the name in “${address}”.`);
}

declare global {
  interface Window {
    /** Development builds only, which the e2e tests run. */
    mosaicDev?: DevTestHook;
  }
}

export function installDevTestHook(): void {
  window.mosaicDev = {
    run: (toolId, args = {}) => runDevTool({ toolId, args }),
    goTo,
    here: describeCurrentView,
    makeHistory,
  };
}
