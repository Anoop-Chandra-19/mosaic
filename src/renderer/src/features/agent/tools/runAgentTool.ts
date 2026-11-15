import { listEmptySectionIds } from '@/features/suggestions/proposals/fillSuggestedSection';
import { buildWorkingCopy } from '@/features/suggestions/proposals/workingCopy';
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
 * - `read/`: return the working copy or the newest saved version through
 *   `formatResumeForModel.ts`, using short handles from `tool-run/resumeHandles.ts`. The
 *   working copy is the draft with the waiting and kept suggestions applied. Reading it
 *   also records the run's receipt.
 * - `propose/`: interpret the call and apply change rules (`compileProposeCall.ts`),
 *   then stage accepted changes for review (`stageSuggestions.ts`). Staging also applies
 *   the changes to the receipt. Include a display target for the pane
 *   (`describeProposeTarget.ts`).
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

/** Build the working copy once per propose call. The call's changes are checked against it. */
function readToolCallContext(run: AgentToolRun): ToolCallContext {
  const { templateId } = useResumeStore.getState();
  const proposals = templateId ? (useProposalStore.getState().byTemplate[templateId] ?? []) : [];
  return {
    run,
    templateId,
    doc: buildWorkingCopy(getResumeSnapshot(), proposals),
    emptySectionIds: listEmptySectionIds(proposals),
  };
}

/** Put the notes on adjusted arguments before the tool outcome. */
const prependAdjustments = (adjustments: string[], toolAnswer: ToolAnswer): ToolAnswer =>
  adjustments.length
    ? { ...toolAnswer, content: `${adjustments.join('\n')}\n${toolAnswer.content}` }
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

const isArgsObject = (rawArgs: unknown): rawArgs is Record<string, unknown> =>
  typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs);

const ARGUMENTS_NOT_AN_OBJECT =
  'The arguments were not a JSON object, so the tool did not run. Call it again with the arguments as a JSON object.';

/**
 * The arguments as an object, or null when they are something else (text that would not
 * parse, a list). A call with no arguments at all has none.
 */
function readArgsObject(rawArgs: unknown): Record<string, unknown> | null {
  if (rawArgs === undefined || rawArgs === null) return {};
  return isArgsObject(rawArgs) ? rawArgs : null;
}

async function runWithCheckedArgs(
  name: AgentToolName,
  run: AgentToolRun,
  rawArgs: unknown
): Promise<ToolAnswer> {
  const argsObject = readArgsObject(rawArgs);
  if (!argsObject) return refuse(ARGUMENTS_NOT_AN_OBJECT);
  const normalized = readAgentToolArgs(AGENT_TOOLS[name], argsObject, lookUpReceipt(run));
  const checked = checkAgentToolArgs(AGENT_TOOLS[name], normalized.args);
  if ('problem' in checked) {
    return prependAdjustments(normalized.adjustments, refuse(checked.problem));
  }
  const toolAnswer = isProposeToolName(name)
    ? compileAndStage(run, name, checked.args)
    : await READ_TOOLS[name](run);
  return prependAdjustments(normalized.adjustments, toolAnswer);
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
