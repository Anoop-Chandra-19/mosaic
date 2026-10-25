import type { StagedChange } from '@/features/suggestions/proposals/proposalActions';
import type { ProposeToolArgs, ProposeToolName } from '@shared/agent-tools/proposeTools';
import type { ToolCallContext } from '../agentToolRun';
import type { Problem } from './findInReceipt';

/** One thing a call can mean: the changes it makes, and what was taken to read it so. */
export interface Reading {
  changes: StagedChange[];
  /** "Took them in the order they sit: b2, then b3." for each thing read another way. */
  took: string[];
  /** The reading in a few words, for when the call has more than one. */
  summary: string;
}

/**
 * A propose tool's own step: what its checked arguments can mean, against what the run
 * read, as readings; or the facts of why they mean nothing.
 */
export type ProposeTool<N extends ProposeToolName> = (
  context: ToolCallContext,
  args: ProposeToolArgs[N]
) => Reading[] | Problem;

/** The one reading of a call that can only mean these changes. */
export const oneReading = (...changes: StagedChange[]): Reading[] => [
  { changes, took: [], summary: '' },
];
