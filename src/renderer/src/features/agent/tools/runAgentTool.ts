import { useResumeStore } from '@/stores/resumeStore';
import {
  AGENT_TOOLS,
  isAgentToolName,
  type AgentToolArgs,
  type AgentToolName,
  type AgentToolResult,
} from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from './agentToolRun';
import { checkAgentToolArgs } from './checkAgentToolArgs';
import { lookUpReceipt } from './lookUpReceipt';
import { proposeEntry } from './propose/proposeEntry';
import { proposeMerge } from './propose/proposeMerge';
import { proposeRename } from './propose/proposeRename';
import { proposeReorder } from './propose/proposeReorder';
import { proposeReplaceEverywhere } from './propose/proposeReplaceEverywhere';
import { proposeRewrite } from './propose/proposeRewrite';
import { proposeSelect } from './propose/proposeSelect';
import { proposeSplit } from './propose/proposeSplit';
import { readAgentToolArgs } from './readAgentToolArgs';
import { readDocument } from './read/readDocument';
import { readNewestVersion } from './read/readNewestVersion';

/*
 * The assistant's tools, run in the page where the draft and the suggestions live. A call
 * comes in as a name and the model's arguments; `readAgentToolArgs` takes the one reading
 * of any that don't fit (over what the run read, `lookUpReceipt.ts`), `checkAgentToolArgs`
 * checks them against the definitions the model was given (`@shared/agent-tools/`), and
 * the tool answers:
 *
 * - `read/`: the draft and the newest version, written out by `formatResumeForModel.ts`
 *   with the short handles of `resumeHandles.ts`. Reading the draft is the run's receipt.
 * - `propose/`: each tool finds what its handles name in the receipt (`findInReceipt.ts`),
 *   builds its change, and stages it for review (`stageSuggestions.ts`).
 *
 * Other modules use this file and `agentToolRun.ts`, which holds what a run's tools keep.
 */

const TOOLS: {
  [N in AgentToolName]: (
    run: AgentToolRun,
    args: AgentToolArgs[N]
  ) => ToolAnswer | Promise<ToolAnswer>;
} = {
  read_document: readDocument,
  read_newest_version: readNewestVersion,
  propose_rewrite: proposeRewrite,
  propose_rename: proposeRename,
  propose_replace_everywhere: proposeReplaceEverywhere,
  propose_split: proposeSplit,
  propose_merge: proposeMerge,
  propose_reorder: proposeReorder,
  propose_select: proposeSelect,
  propose_entry: proposeEntry,
};

/** What was taken another way goes first, so the model reads it before the outcome. */
const sayTookFirst = (took: string[], toolAnswer: ToolAnswer): ToolAnswer =>
  took.length ? { ...toolAnswer, content: `${took.join(' ')}\n${toolAnswer.content}` } : toolAnswer;

async function runWithCheckedArgs<N extends AgentToolName>(
  name: N,
  run: AgentToolRun,
  rawArgs: unknown
): Promise<ToolAnswer> {
  const givenArgs =
    typeof rawArgs === 'object' && rawArgs !== null ? (rawArgs as Record<string, unknown>) : {};
  const read = readAgentToolArgs(AGENT_TOOLS[name], givenArgs, lookUpReceipt(run));
  const checked = checkAgentToolArgs(AGENT_TOOLS[name], read.args);
  if ('problem' in checked) return sayTookFirst(read.took, refuse(checked.problem));
  // The check held the arguments to the schema these types describe.
  const args = checked.args as AgentToolArgs[N];
  return sayTookFirst(read.took, await TOOLS[name](run, args));
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
