import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import {
  AGENT_TOOLS,
  isAgentToolName,
  type AgentToolName,
  type AgentToolResult,
} from '@shared/agent-tools/agentTools';
import {
  PROPOSE_TOOLS,
  type ProposeToolArgs,
  type ProposeToolName,
} from '@shared/agent-tools/proposeTools';
import type { ReadToolArgs } from '@shared/agent-tools/readTools';
import { checkAgentToolArgs } from './checkAgentToolArgs';
import { lookUpReceipt } from './lookUpReceipt';
import { compileProposeCall } from './propose/compileProposeCall';
import { describeProposeTarget } from './propose/describeProposeTarget';
import { stageCompiledCall } from './propose/stageSuggestions';
import { readAgentToolArgs } from './readAgentToolArgs';
import { readDocument } from './read/readDocument';
import { readNewestVersion } from './read/readNewestVersion';
import {
  refuse,
  type AgentToolRun,
  type ToolAnswer,
  type ToolCallContext,
} from './tool-run/agentToolRun';

/*
 * Execute assistant tools in the renderer, where the draft and suggestions live.
 * `readAgentToolArgs` normalizes model arguments using receipt lookups from
 * `lookUpReceipt.ts`; `checkAgentToolArgs` validates them against the definitions
 * given to the model (`@shared/agent-tools/`). Then dispatch to:
 *
 * - `read/`: return the draft or newest saved version through `formatResumeForModel.ts`,
 *   using short handles from `tool-run/resumeHandles.ts`. Reading the draft also records
 *   the run's receipt.
 * - `propose/`: interpret the call and apply change rules (`compileProposeCall.ts`),
 *   then stage accepted changes for review (`stageSuggestions.ts`). Include a display
 *   target for the pane (`describeProposeTarget.ts`).
 *
 * Dependencies flow from this folder's entry points to `read/` and `propose/`, then to
 * `tool-run/`, which holds run state. Other modules start from `agentRunTools.ts`.
 */

type ReadToolName = keyof ReadToolArgs;

const READ_TOOLS: {
  [N in ReadToolName]: (run: AgentToolRun) => ToolAnswer | Promise<ToolAnswer>;
} = {
  read_document: readDocument,
  read_newest_version: readNewestVersion,
};

const isProposeToolName = (name: AgentToolName): name is ProposeToolName =>
  Object.hasOwn(PROPOSE_TOOLS, name);

/** Capture the current draft and pending suggestions once for proposal compilation. */
function readToolCallContext(run: AgentToolRun): ToolCallContext {
  const { templateId } = useResumeStore.getState();
  const proposals = templateId ? (useProposalStore.getState().byTemplate[templateId] ?? []) : [];
  const waiting = proposals.filter((proposal) => proposal.status === 'pending');
  return { run, templateId, doc: getResumeSnapshot(), waiting };
}

/** Put argument-normalization notes before the tool outcome. */
const sayTookFirst = (took: string[], toolAnswer: ToolAnswer): ToolAnswer =>
  took.length
    ? { ...toolAnswer, content: `${took.join('\n')}\n${toolAnswer.content}` }
    : toolAnswer;

function compileAndStage<N extends ProposeToolName>(
  run: AgentToolRun,
  name: N,
  checkedArgs: Record<string, unknown>
): ToolAnswer {
  const context = readToolCallContext(run);
  // Schema validation has checked the arguments against these tool types.
  const args = checkedArgs as ProposeToolArgs[N];
  const target = describeProposeTarget(context, name, args);
  return {
    ...stageCompiledCall(context, compileProposeCall(context, name, args)),
    ...(target && { target }),
  };
}

async function runWithCheckedArgs(
  name: AgentToolName,
  run: AgentToolRun,
  rawArgs: unknown
): Promise<ToolAnswer> {
  const givenArgs =
    typeof rawArgs === 'object' && rawArgs !== null ? (rawArgs as Record<string, unknown>) : {};
  const read = readAgentToolArgs(AGENT_TOOLS[name], givenArgs, lookUpReceipt(run));
  const checked = checkAgentToolArgs(AGENT_TOOLS[name], read.args);
  if ('problem' in checked) return sayTookFirst(read.took, refuse(checked.problem));
  const toolAnswer = isProposeToolName(name)
    ? compileAndStage(run, name, checked.args)
    : await READ_TOOLS[name](run);
  return sayTookFirst(read.took, toolAnswer);
}

function describeOpenDraft(): AgentToolResult['draft'] {
  const { templateId, rev } = useResumeStore.getState();
  return templateId === null ? null : { templateId, rev };
}

/** Answer one tool call, converting unknown tools and execution failures into model-visible errors. */
export async function runAgentTool(
  run: AgentToolRun,
  name: string,
  rawArgs: unknown
): Promise<AgentToolResult> {
  let toolAnswer: ToolAnswer;
  try {
    toolAnswer = isAgentToolName(name)
      ? await runWithCheckedArgs(name, run, rawArgs)
      : refuse(`There is no tool named ${name}.`);
  } catch (error) {
    toolAnswer = refuse(`The tool failed: ${error instanceof Error ? error.message : error}`);
  }
  return { ...toolAnswer, draft: describeOpenDraft() };
}
