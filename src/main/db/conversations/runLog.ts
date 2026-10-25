import type { Database } from 'better-sqlite3';
import type { RunStoppedMessageBody, RunStopReason } from '@shared/types/agentConversation';
import type { ModelReplyPart, ModelUsage } from '@shared/types/modelReply';
import { getTemplate } from '../resumes/templates';
import { appendMessage } from './messages';
import { finishRun, readLastRun, startRun, type ConversationRun, type RunEnd } from './runs';
import { closePendingCalls, finishToolCall, recordToolCall, type ToolCallEnd } from './toolCalls';

/*
 * What a run writes to the log, one step at a time. Each function is one transaction, so
 * the log never holds half a step: a reply without its pending calls, or answers without
 * their calls finished. The run loop (`main/agent/`) writes only through these, and reads
 * with `readConversationLog` and `readToolCallStamps`.
 */

export interface UserAsk {
  conversationId: number;
  text: string;
  /** The template open when the user sent it; null with none open. */
  templateId: string | null;
  provider: string;
  model: string;
}

export interface UserRunStart {
  runId: number;
  /** The open template as the run starts on it; null with none open. */
  template: { id: string; name: string; rev: number } | null;
}

export interface StoredModelReply {
  parts: ModelReplyPart[];
  finish?: 'complete' | 'outputLimit';
  usage?: ModelUsage | null;
  model: string;
  /** The draft's rev its tool calls run against; null with no template open. */
  rev: number | null;
}

/** One call's answer, as the result the model reads and as the call's own row. */
export type ToolAnswer = Omit<ToolCallEnd, 'runId' | 'resultMessageId'> & {
  content: string;
  isError: boolean;
};

export type RunStop = Omit<RunStoppedMessageBody, 'type'>;

const END_STATUS: Record<RunStopReason, RunEnd['status']> = {
  repeatedCall: 'failed',
  refusalsInARow: 'failed',
  stepLimit: 'step_limit',
  connection: 'failed',
  providerError: 'failed',
  appFault: 'failed',
  cancelled: 'cancelled',
};

/** The run, the user's message, and a note first when the open resume changed since. */
export function startUserRun(db: Database, ask: UserAsk): UserRunStart {
  return db.transaction(() => {
    const { conversationId, templateId } = ask;
    const template = templateId === null ? null : getTemplate(db, templateId);
    const lastRun = readLastRun(db, conversationId);
    const run = startRun(db, {
      conversationId,
      templateId,
      provider: ask.provider,
      model: ask.model,
    });
    if (template && lastRun && lastRun.templateId !== template.id) {
      appendMessage(db, {
        conversationId,
        runId: run.id,
        body: {
          type: 'templateSwitched',
          templateId: template.id,
          label: template.name,
          ...(lastRun.templateId ? { previousId: lastRun.templateId } : {}),
        },
      });
    }
    appendMessage(db, {
      conversationId,
      runId: run.id,
      body: { type: 'user', text: ask.text, resume: [], isLimit: false },
    });
    return {
      runId: run.id,
      template: template && { id: template.id, name: template.name, rev: template.rev },
    };
  })();
}

/** The model's reply, and each call it made recorded as pending. */
export function storeModelReply(db: Database, run: ConversationRun, reply: StoredModelReply): void {
  db.transaction(() => {
    const message = appendMessage(db, {
      conversationId: run.conversationId,
      runId: run.runId,
      body: {
        type: 'assistant',
        content: reply.parts,
        ...(reply.finish ? { finish: reply.finish } : {}),
      },
      model: reply.model,
      inputTokens: reply.usage?.inputTokens,
      outputTokens: reply.usage?.outputTokens,
    });
    for (const part of reply.parts) {
      if (part.type !== 'toolCall') continue;
      recordToolCall(db, {
        runId: run.runId,
        requestMessageId: message.id,
        callId: part.callId,
        name: part.name,
        rev: reply.rev,
      });
    }
  })();
}

/** A step's answers, as one message, with each call finished against it. */
export function storeToolAnswers(db: Database, run: ConversationRun, answers: ToolAnswer[]): void {
  db.transaction(() => {
    const message = appendMessage(db, {
      conversationId: run.conversationId,
      runId: run.runId,
      body: {
        type: 'toolResults',
        results: answers.map(({ callId, content, isError }) => ({
          callId,
          content,
          ...(isError ? { isError: true } : {}),
        })),
      },
    });
    for (const answer of answers) {
      finishToolCall(db, {
        runId: run.runId,
        callId: answer.callId,
        status: answer.status,
        checkName: answer.checkName,
        resultMessageId: message.id,
        rev: answer.rev,
      });
    }
  })();
}

/** The run's end: what stopped it, if anything did, then its status and tokens. */
export function endRun(
  db: Database,
  run: ConversationRun,
  stop: RunStop | undefined,
  usage: ModelUsage | null
): void {
  db.transaction(() => {
    if (stop) {
      appendMessage(db, {
        conversationId: run.conversationId,
        runId: run.runId,
        body: { type: 'runStopped', ...stop },
      });
    }
    finishRun(db, run.runId, {
      status: stop ? END_STATUS[stop.reason] : 'done',
      error: stop && stop.reason !== 'cancelled' ? stop.reason : undefined,
      ...usage,
    });
  })();
}

/** A fault in Mosaic itself: its calls answered, and the fault stored as the run's stop. */
export function failRun(
  db: Database,
  run: ConversationRun,
  fault: string,
  usage: ModelUsage | null
): void {
  db.transaction(() => {
    closePendingCalls(db, run, 'The tool was not run.');
    endRun(db, run, { reason: 'appFault', detail: fault }, usage);
  })();
}
