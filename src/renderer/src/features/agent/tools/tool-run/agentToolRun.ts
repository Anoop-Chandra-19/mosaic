import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { ResumeData } from '@shared/types/resume';
import { createResumeHandles, type ResumeHandles } from './resumeHandles';

/**
 * The working copy as the model knows it. It starts as what the last read_document call
 * returned. Each suggestion the run stages after that is applied to it. A suggestion's
 * `before` value is read from it.
 */
export interface ReadReceipt {
  templateId: string;
  doc: ResumeData;
}

/** The state the tools keep for one run. */
export interface AgentToolRun {
  /** The user's request. The checks use it to tell a number the user gave from a new claim. */
  requestText: string;
  handles: ResumeHandles;
  /** Null until the run reads the resume. A propose call is refused while it is null. */
  receipt: ReadReceipt | null;
  /** IDs of suggestions staged by this run, used for the run card's count. */
  stagedIds: Set<string>;
  /**
   * Targets already sent back once for a definite mistake. The next try for the same
   * target is staged with its flag, not sent back again.
   */
  repairedTargets: Set<string>;
}

/**
 * State passed between runs in one conversation. The model's last read remains in its
 * log, so follow-up requests reuse the receipt and handles. Opening another resume
 * requires a new read before proposing changes.
 */
export type ConversationToolState = Pick<AgentToolRun, 'handles' | 'receipt'>;

export const createAgentToolRun = (
  requestText: string,
  earlier: ConversationToolState = { handles: createResumeHandles(), receipt: null }
): AgentToolRun => ({
  requestText,
  handles: earlier.handles,
  receipt: earlier.receipt,
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
  /** The working copy as it is now. Proposed changes are validated against it. */
  doc: ResumeData;
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
