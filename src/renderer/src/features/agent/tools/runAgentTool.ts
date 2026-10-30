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
import { refuse, type AgentToolRun, type ToolAnswer, type ToolCallContext } from './agentToolRun';
import { checkAgentToolArgs } from './checkAgentToolArgs';
import { lookUpReceipt } from './lookUpReceipt';
import { compileProposeCall } from './propose/compileProposeCall';
import { describeProposeTarget } from './propose/describeProposeTarget';
import { stageCompiledCall } from './propose/stageSuggestions';
import { readAgentToolArgs } from './readAgentToolArgs';
import { readDocument } from './read/readDocument';
import { readNewestVersion } from './read/readNewestVersion';

/*
 * The assistant's tools, run in the page where the draft and the suggestions live. A call
 * comes in as a name and the model's arguments; `readAgentToolArgs` takes the one reading
 * of any that don't fit (over what the run read, `lookUpReceipt.ts`), `checkAgentToolArgs`
 * checks them against the definitions the model was given (`@shared/agent-tools/`), and:
 *
 * - `read/` answers: the draft and the newest version, written out by
 *   `formatResumeForModel.ts` with the short handles of `resumeHandles.ts`. Reading the
 *   draft is the run's receipt.
 * - `propose/` compiles the call (`compileProposeCall.ts`): the tool's own step turns it
 *   into what it can mean, and the rules every change goes through decide what is staged
 *   for review (`stageSuggestions.ts`). What the call was about goes with its answer, for
 *   the pane (`describeProposeTarget.ts`).
 *
 * Other modules use this file and `agentToolRun.ts`, which holds what a run's tools keep.
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

/** What a propose call is compiled against, read from the stores once. */
function readToolCallContext(run: AgentToolRun): ToolCallContext {
  const { templateId } = useResumeStore.getState();
  const proposals = templateId ? (useProposalStore.getState().byTemplate[templateId] ?? []) : [];
  const waiting = proposals.filter((proposal) => proposal.status === 'pending');
  return { run, templateId, doc: getResumeSnapshot(), waiting };
}

/** What was taken another way goes first, so the model reads it before the outcome. */
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
  // The check held the arguments to the schema these types describe.
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

/** One call, answered whatever happens: a failure is an error the model reads. */
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
