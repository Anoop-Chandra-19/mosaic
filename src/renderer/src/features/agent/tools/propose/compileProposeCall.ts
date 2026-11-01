import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import type { ProposeToolArgs, ProposeToolName } from '@shared/agent-tools/proposeTools';
import type { ToolCallContext } from '../tool-run/agentToolRun';
import { applyChangeRules } from './changeRules';
import { isProblem, type Problem } from './findInReceipt';
import { proposeEntry } from './proposeEntry';
import { proposeMerge } from './proposeMerge';
import { proposeRename } from './proposeRename';
import { proposeReorder } from './proposeReorder';
import { proposeReplaceEverywhere } from './proposeReplaceEverywhere';
import { proposeRewrite } from './proposeRewrite';
import { proposeSelect } from './proposeSelect';
import { proposeSplit } from './proposeSplit';
import { diagnose, type Diagnostic } from './toolDiagnostics';
import type { ProposeTool, Reading } from './toolReadings';

/*
 * A propose call, compiled: the passes every propose tool goes through once its arguments
 * are read and checked (`../readAgentToolArgs.ts`, `../checkAgentToolArgs.ts`).
 *
 * 1. the tool's own step (`propose<Tool>.ts`) turns its arguments into the readings the
 *    call can have, finding its handles through `findInReceipt.ts`, or gives the facts of
 *    why it has none (`toolFacts.ts`);
 * 2. pick: exactly one reading goes on; two or more are listed back;
 * 3. rules (`changeRules.ts`): each change is checked as nothing changed, a repeat, out of
 *    date, or a definite mistake, and what none of them stops is left to stage.
 *
 * Nothing here reads a store: the call's context brings what it needs. `stageSuggestions.ts`
 * stages what is left and answers with the diagnostics (`toolDiagnostics.ts`). Other
 * modules use this file and `stageSuggestions.ts`.
 */

export interface CompiledCall {
  diagnostics: Diagnostic[];
  toStage: StagedChange[];
}

const TOOLS: { [N in ProposeToolName]: ProposeTool<N> } = {
  propose_rewrite: proposeRewrite,
  propose_rename: proposeRename,
  propose_replace_everywhere: proposeReplaceEverywhere,
  propose_split: proposeSplit,
  propose_merge: proposeMerge,
  propose_reorder: proposeReorder,
  propose_select: proposeSelect,
  propose_entry: proposeEntry,
};

const COUNT_WORDS = ['two', 'three', 'four'];

/** The one reading, or the readings listed back when there are several. */
function pickReading(readings: Reading[]): Reading | Problem {
  if (readings.length === 1) return readings[0];
  const count = COUNT_WORDS[readings.length - 2] ?? String(readings.length);
  const listed = readings.map((reading) => reading.summary).join(', or ');
  return { problem: `That can be read ${count} ways: ${listed}. Say which.` };
}

export function compileProposeCall<N extends ProposeToolName>(
  context: ToolCallContext,
  name: N,
  args: ProposeToolArgs[N]
): CompiledCall {
  const readings = TOOLS[name](context, args);
  const reading = isProblem(readings) ? readings : pickReading(readings);
  if (isProblem(reading)) {
    return { diagnostics: [diagnose('error', null, reading.problem)], toStage: [] };
  }
  const diagnostics = reading.took.map((took) => diagnose('took', null, took));
  const toStage: StagedChange[] = [];
  for (const staged of reading.changes) {
    const stopped = applyChangeRules(context, staged.change);
    if (stopped) diagnostics.push(stopped);
    else toStage.push(staged);
  }
  return { diagnostics, toStage };
}
