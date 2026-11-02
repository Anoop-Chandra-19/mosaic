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
 * Compile propose calls after argument normalization and validation
 * (`../readAgentToolArgs.ts`, `../checkAgentToolArgs.ts`).
 *
 * 1. The tool-specific step (`propose<Tool>.ts`) returns possible interpretations,
 *    resolving handles through `findInReceipt.ts`, or explains why the call cannot be
 *    interpreted (`toolFacts.ts`).
 * 2. Accept exactly one interpretation; list alternatives when the call is ambiguous.
 * 3. Apply `changeRules.ts` to each change: detect no-ops, duplicates, invalid or stale
 *    changes, and definite mistakes. Return changes that pass for staging.
 *
 * All inputs come from the call context; this module does not read stores.
 * `stageSuggestions.ts` stages the remaining changes and formats diagnostics through
 * `toolDiagnostics.ts`. Other modules use this file and `stageSuggestions.ts`.
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

/** Return the sole interpretation, or a problem listing the alternatives. */
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
