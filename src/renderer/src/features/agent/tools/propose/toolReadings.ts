import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import type { ProposeToolArgs, ProposeToolName } from '@shared/agent-tools/proposeTools';
import type { ToolCallContext } from '../tool-run/agentToolRun';
import type { Problem } from './findInReceipt';

/** One interpretation of a call, with its proposed changes and interpretation notes. */
export interface Reading {
  changes: StagedChange[];
  /** Notes on accepted adjustments, such as "Took them in the order they sit: b2, then b3." */
  took: string[];
  /** Short description used to distinguish ambiguous interpretations. */
  summary: string;
}

/**
 * Interpret a propose tool's checked arguments against the run's receipt. Return
 * possible readings, or a problem explaining why the call cannot be interpreted.
 */
export type ProposeTool<N extends ProposeToolName> = (
  context: ToolCallContext,
  args: ProposeToolArgs[N]
) => Reading[] | Problem;

/** Wrap unambiguous changes in a single reading. */
export const oneReading = (...changes: StagedChange[]): Reading[] => [
  { changes, took: [], summary: '' },
];
