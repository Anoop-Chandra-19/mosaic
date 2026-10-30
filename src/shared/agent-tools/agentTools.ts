import type { ToolTarget } from '../types/agentConversation';
import type { ModelTool } from '../types/modelTool';
import { PROPOSE_TOOLS, type ProposeToolArgs } from './proposeTools.ts';
import { READ_TOOLS, type ReadToolArgs } from './readTools.ts';

/*
 * The assistant's tools: what the model is offered (`AGENT_TOOLS`) and what a call's
 * arguments are once checked (`AgentToolArgs`), defined a group to a file: `readTools.ts`
 * and `proposeTools.ts`, each built with `defineAgentTool.ts`. Main sends
 * the definitions with every request; the renderer checks a call's arguments against the
 * same definitions, runs it (`features/agent/tools/runAgentTool.ts`) and answers with an
 * `AgentToolResult`.
 *
 * The eval scripts offer these definitions too, so they measure what ships. Node loads
 * them as they are, which is why the imports here name their `.ts` files.
 *
 * The model names sections, entries and bullets by the short handles read_document gives
 * it ("s1", "e2", "b7"), never by their ids.
 */

export type AgentToolArgs = ReadToolArgs & ProposeToolArgs;

export type AgentToolName = keyof AgentToolArgs;

/** What a tool call answers. `content` is what the model reads. */
export interface AgentToolResult {
  content: string;
  isError: boolean;
  /** The open draft when the call ran, which a later read is compared with. None open: null. */
  draft: { templateId: string; rev: number } | null;
  /** What the call was about, for the pane; the model never reads it. */
  target?: ToolTarget;
}

export const AGENT_TOOLS: Record<AgentToolName, ModelTool> = {
  ...READ_TOOLS,
  ...PROPOSE_TOOLS,
};

export const isAgentToolName = (name: string): name is AgentToolName =>
  Object.hasOwn(AGENT_TOOLS, name);
