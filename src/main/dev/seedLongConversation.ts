import type { Database } from 'better-sqlite3';
import {
  endRun,
  startUserRun,
  storeModelReply,
  storeToolAnswers,
} from '../db/conversations/runLog';
import type { ConversationRun } from '../db/conversations/runs';

/*
 * A long conversation of fictional runs, written as real runs write theirs: what the pane has
 * to hold up under. Replies vary from a short note to a long one with lists and code, and each
 * run reads a resume-sized document, which the pane never loads but the log has to carry.
 */

const PROVIDER = 'anthropic';
const MODEL = 'claude-sonnet-5-5';
const STEP_MS = 1400;

const READ_RESULT =
  'b1: Led the billing migration for two teams and retired the old queue.\n'.repeat(160);

const PARAGRAPH =
  'The summary leads with **billing**, which suits this posting, but the first bullet repeats the second. Cutting one leaves room for the `nightly` queue work.\n\n';
const LIST = '- Cut invoice errors by a third\n- Moved `nightly` runs to one queue\n\n';
const CODE = '```\nLed the migration to one queue\nRetired the old nightly job\n```\n\n';

/** Short, medium, long and very long, in turn, so no two neighbours measure the same. */
const REPLIES = [
  PARAGRAPH,
  PARAGRAPH + LIST,
  PARAGRAPH.repeat(3) + LIST + CODE,
  (PARAGRAPH + LIST).repeat(5) + CODE,
];

function writeRun(db: Database, run: ConversationRun, index: number, startedAt: number): void {
  const callId = `seeded-${index}`;
  storeModelReply(db, run, {
    parts: [
      { type: 'text', text: 'Reading your resume first.' },
      { type: 'toolCall', callId, name: 'read_document', args: {} },
    ],
    model: MODEL,
    rev: null,
  });
  storeToolAnswers(db, run, [
    {
      callId,
      content: READ_RESULT,
      isError: false,
      status: 'ok',
      rev: null,
      startedAt,
      durationMs: STEP_MS,
    },
  ]);
  storeModelReply(db, run, {
    parts: [{ type: 'text', text: REPLIES[index % REPLIES.length] }],
    finish: 'complete',
    model: MODEL,
    rev: null,
  });
  endRun(db, run, undefined, null);
}

/** Writes runs until the log holds at least `messageCount` messages. Returns the conversation. */
export function seedLongConversation(db: Database, messageCount: number): number {
  const messagesPerRun = 4;
  const startedAt = Date.now();
  let conversationId: number | null = null;
  for (let index = 0; index * messagesPerRun < messageCount; index++) {
    const start = startUserRun(db, {
      conversationId,
      templateId: null,
      provider: PROVIDER,
      model: MODEL,
      text: `What stands out in part ${index + 1}?`,
    });
    conversationId = start.conversationId;
    writeRun(db, { conversationId, runId: start.runId }, index, startedAt);
  }
  if (conversationId === null) throw new Error('A long conversation needs at least one message');
  return conversationId;
}
