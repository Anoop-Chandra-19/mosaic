import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { createResumeHandles, type ResumeHandles } from './resumeHandles';

/** The draft as read_document last gave it: what a suggestion's `before` is taken from. */
export interface ReadReceipt {
  templateId: string;
  doc: ResumeData;
}

/** What the tools keep for one run. */
export interface AgentToolRun {
  /** The user's words: a number they gave is not new. */
  requestText: string;
  handles: ResumeHandles;
  /** Nothing can be suggested against text the run never read. */
  receipt: ReadReceipt | null;
  /** This run's suggestion for each bullet, entry or section, which a new one replaces. */
  suggestionIdByTarget: Map<string, string>;
  /** Every suggestion this run has staged and not replaced, which its card counts. */
  stagedIds: Set<string>;
  /** Targets sent back once for a definite mistake. The next try is staged, flagged. */
  repairedTargets: Set<string>;
}

/**
 * What a conversation's runs pass on: the model still has its last read in the log, so a
 * follow-up ask works from it, with the same handles, until another resume is open.
 */
export type ConversationReading = Pick<AgentToolRun, 'handles' | 'receipt'>;

export const createAgentToolRun = (
  requestText: string,
  reading: ConversationReading = { handles: createResumeHandles(), receipt: null }
): AgentToolRun => ({
  requestText,
  handles: reading.handles,
  receipt: reading.receipt,
  suggestionIdByTarget: new Map(),
  stagedIds: new Set(),
  repairedTargets: new Set(),
});

/**
 * What a propose call is compiled against, read from the stores once when it comes in, so
 * every step after that is given what it uses rather than reading it.
 */
export interface ToolCallContext {
  run: AgentToolRun;
  /** The resume open now, or null when none is. */
  templateId: string | null;
  /** The open draft as it is now, which staging checks a change against. */
  doc: ResumeData;
  /** The open resume's suggestions waiting for the user. */
  waiting: Proposal[];
}

/** What one tool says back to the model; `runAgentTool` adds where the draft stood. */
export type ToolAnswer = Omit<AgentToolResult, 'draft'>;

export const answer = (content: string, target?: ToolTarget): ToolAnswer => ({
  content,
  isError: false,
  ...(target && { target }),
});

export const refuse = (content: string): ToolAnswer => ({ content, isError: true });

export const NO_RESUME_OPEN = 'No resume is open. Ask the user to open one.';
