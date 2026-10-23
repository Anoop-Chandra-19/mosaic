import { useResumeStore } from '@/stores/resumeStore';
import {
  isAgentToolName,
  type AgentToolArgs,
  type AgentToolName,
  type AgentToolResult,
} from '@shared/agent-tools/agentTools';
import { refuse, type AgentToolRun, type ToolAnswer } from './agentToolRun';
import { checkAgentToolArgs } from './checkAgentToolArgs';
import { proposeEntry } from './propose/proposeEntry';
import { proposeMerge } from './propose/proposeMerge';
import { proposeReorder } from './propose/proposeReorder';
import { proposeReplaceEverywhere } from './propose/proposeReplaceEverywhere';
import { proposeRewrite } from './propose/proposeRewrite';
import { proposeSelect } from './propose/proposeSelect';
import { proposeSplit } from './propose/proposeSplit';
import { readDocument } from './read/readDocument';
import { readNewestVersion } from './read/readNewestVersion';

/*
 * The assistant's tools, run in the page where the draft and the suggestions live. A call
 * comes in as a name and the model's arguments; `checkAgentToolArgs` checks them against
 * the definitions the model was given (`@shared/agent-tools/`), and the tool answers:
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
  propose_replace_everywhere: proposeReplaceEverywhere,
  propose_split: proposeSplit,
  propose_merge: proposeMerge,
  propose_reorder: proposeReorder,
  propose_select: proposeSelect,
  propose_entry: proposeEntry,
};

async function runWithCheckedArgs<N extends AgentToolName>(
  name: N,
  run: AgentToolRun,
  rawArgs: unknown
): Promise<ToolAnswer> {
  const checked = checkAgentToolArgs(name, rawArgs);
  if ('problem' in checked) return refuse(checked.problem);
  return TOOLS[name](run, checked.args);
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
