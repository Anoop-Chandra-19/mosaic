import type { DevToolRun } from '@shared/types/devTools';
import { DATA_TOOLS } from './tools/dataTools';
import type { DevTool } from './devTool';
import { ADDRESS_TOOLS, GO_TO_TOOLS } from './tools/goToTools';

/*
 * Tools for building and checking Mosaic, in development builds only: release builds leave
 * the module out (`--mode release`, see `AppShell.tsx`). The path: Ctrl+Shift+D, the wrench
 * (`DevToolsWrench.tsx`) or Develop › Developer tools… opens `DevTools.tsx`, whose palette
 * (`palette/`) lists `DEV_TOOLS`, takes a tool's choices one step at a time (`devTool.ts`'s
 * steps) and runs it with `runDevTool`, keeping it in Recent (`recentDevRuns.ts`). The tools
 * are in `tools/`: fictional data (`dataTools.ts`) and views by their address
 * (`goToTools.ts`). e2e runs the same table through `devTestHook.ts`.
 */

export const DEV_TOOLS: DevTool[] = [...DATA_TOOLS, ...GO_TO_TOOLS, ...ADDRESS_TOOLS];

export function findDevTool(toolId: string): DevTool | undefined {
  return DEV_TOOLS.find((tool) => tool.id === toolId);
}

/** Runs a tool with its choices, resolving with what to tell the user. */
export function runDevTool({ toolId, args }: DevToolRun): Promise<string> {
  const tool = findDevTool(toolId);
  if (!tool) return Promise.reject(new Error(`No developer tool “${toolId}”`));
  return tool.run(args);
}
