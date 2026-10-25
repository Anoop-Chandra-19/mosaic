import type { DevToolRun } from '@shared/types/devTools';
import { ASK_AGENT_TOOL } from './askAgentTool';
import { DATA_TOOLS } from './dataTools';
import type { DevTool } from './devTool';
import { CHECK_TOOLS } from './checkTools';
import { ADDRESS_TOOLS, GO_TO_TOOLS } from './goToTools';
import { SWITCH_TOOLS } from './switchTools';

/** Every tool, in the palette's order. */
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
