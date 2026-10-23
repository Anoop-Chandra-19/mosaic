import type { AgentToolResult } from '@shared/agent-tools/agentTools';
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
  /** Targets sent back once for a definite mistake. The next try is staged, flagged. */
  repairedTargets: Set<string>;
}

export const createAgentToolRun = (requestText: string): AgentToolRun => ({
  requestText,
  handles: createResumeHandles(),
  receipt: null,
  suggestionIdByTarget: new Map(),
  repairedTargets: new Set(),
});

/** What one tool says back to the model; `runAgentTool` adds where the draft stood. */
export type ToolAnswer = Omit<AgentToolResult, 'draft'>;

export const answer = (content: string): ToolAnswer => ({ content, isError: false });

export const refuse = (content: string): ToolAnswer => ({ content, isError: true });

export const NO_RESUME_OPEN = 'No resume is open. Ask the user to open one.';
