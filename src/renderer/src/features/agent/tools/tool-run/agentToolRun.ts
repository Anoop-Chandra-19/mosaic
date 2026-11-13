import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { createResumeHandles, type ResumeHandles } from './resumeHandles';

/** Draft snapshot from the last read_document call, used for suggestion `before` values. */
export interface ReadReceipt {
  templateId: string;
  doc: ResumeData;
}

/** What the tools keep for one run. */
export interface AgentToolRun {
  /** User request used by checks to distinguish supplied numbers from new claims. */
  requestText: string;
  handles: ResumeHandles;
  /** Nothing can be suggested against text the run never read. */
  receipt: ReadReceipt | null;
  /** Latest suggestion ID per change-kind/target key, used to replace the conversation's pending suggestions. */
  suggestionIdByTarget: Map<string, string>;
  /** IDs of suggestions staged by this run and not replaced, used for the run card's count. */
  stagedIds: Set<string>;
  /** Targets sent back once for a definite mistake. The next try is staged, flagged. */
  repairedTargets: Set<string>;
}

/**
 * State passed between runs in one conversation. The model's last read remains in its
 * log, so follow-up requests reuse the receipt and handles. Opening another resume
 * requires a new draft read before proposing changes. The suggestions made so far come
 * along too, so a follow-up that revises one replaces it instead of adding a second.
 */
export type ConversationToolState = Pick<
  AgentToolRun,
  'handles' | 'receipt' | 'suggestionIdByTarget'
>;

export const createAgentToolRun = (
  requestText: string,
  earlier: ConversationToolState = {
    handles: createResumeHandles(),
    receipt: null,
    suggestionIdByTarget: new Map(),
  }
): AgentToolRun => ({
  requestText,
  handles: earlier.handles,
  receipt: earlier.receipt,
  suggestionIdByTarget: earlier.suggestionIdByTarget,
  stagedIds: new Set(),
  repairedTargets: new Set(),
});

/**
 * Inputs captured from stores once per propose call. Compilation steps receive this
 * context instead of reading stores themselves.
 */
export interface ToolCallContext {
  run: AgentToolRun;
  /** The resume open now, or null when none is. */
  templateId: string | null;
  /** Current draft snapshot used to validate proposed changes. */
  doc: ResumeData;
  /** The open resume's suggestions waiting for the user. */
  waiting: Proposal[];
}

/** Tool response before `runAgentTool` adds the current draft's template ID and revision. */
export type ToolAnswer = Omit<AgentToolResult, 'draft'>;

export const answer = (content: string, target?: ToolTarget): ToolAnswer => ({
  content,
  isError: false,
  ...(target && { target }),
});

export const refuse = (content: string): ToolAnswer => ({ content, isError: true });

export const NO_RESUME_OPEN = 'No resume is open. Ask the user to open one.';
