import type { DevToolRun } from '@shared/types/devTools';
import { ASK_AGENT_TOOL } from './tools/askAgentTool';
import { DATA_TOOLS } from './tools/dataTools';
import type { DevTool } from './devTool';
import { CHECK_TOOLS } from './tools/checkTools';
import { ADDRESS_TOOLS, GO_TO_TOOLS } from './tools/goToTools';
import { SWITCH_TOOLS } from './tools/switchTools';

/*
 * Tools for building and checking Mosaic, in development builds only: release builds leave
 * the module out (`--mode release`, see `AppShell.tsx`). The path: Ctrl+Shift+D, the wrench
 * (`DevToolsWrench.tsx`) or Develop › Developer tools… opens `DevTools.tsx`, whose palette
 * (`palette/`) lists `DEV_TOOLS`, takes a tool's choices one step at a time (`devTool.ts`'s
 * steps) and runs it with `runDevTool`, keeping it in Recent (`recentDevRuns.ts`). The tools
 * are in `tools/`: fictional data (`dataTools.ts`), a run of the assistant
 * (`askAgentTool.ts`), views by their address (`goToTools.ts`),
 * the memory check (`checkTools.ts`, reading `memory-check/`) and the switches
 * (`switchTools.ts`), which stay on across launches (`switches/`, kept by main). What shows
 * outside the palette, the switches on and a load under way, is in `devToolsStore.ts`, for
 * the window's title and the wrench. Generated data, whole profiles and single histories, is
 * made in `profiles/`. e2e runs the same table through `devTestHook.ts`.
 */

export const DEV_TOOLS: DevTool[] = [
  ...DATA_TOOLS,
  ASK_AGENT_TOOL,
  ...GO_TO_TOOLS,
  ...ADDRESS_TOOLS,
  ...CHECK_TOOLS,
  ...SWITCH_TOOLS,
];

export function findDevTool(toolId: string): DevTool | undefined {
  return DEV_TOOLS.find((tool) => tool.id === toolId);
}

/** Runs a tool with its choices, resolving with what to tell the user. */
export function runDevTool({ toolId, args }: DevToolRun): Promise<string> {
  const tool = findDevTool(toolId);
  if (!tool) return Promise.reject(new Error(`No developer tool “${toolId}”`));
  return tool.run(args);
}
