import { vi } from 'vitest';
import type { MessagePage } from '@shared/types/agentBridge';
import type { TranscriptMessage, TranscriptMessageBody } from '@shared/types/agentConversation';

/** Conversations' logs, read in pages the way main reads them. */
export function createFakeAgentLog() {
  const byConversation = new Map<number, TranscriptMessage[]>();
  let nextId = 1;

  const append = (conversationId: number, runId: number | null, body: TranscriptMessageBody) => {
    const log = byConversation.get(conversationId) ?? [];
    byConversation.set(conversationId, log);
    log.push({ id: nextId++, seq: log.length + 1, runId, body, createdAt: 0 });
  };

  const readMessages = vi.fn(async (conversationId: number, page: MessagePage) => {
    const before = (byConversation.get(conversationId) ?? []).filter(
      (message) => message.seq < (page.beforeSeq ?? Infinity)
    );
    return before.slice(-page.limit);
  });

  return { append, readMessages };
}

export const userBody = (text: string): TranscriptMessageBody => ({
  type: 'user',
  text,
  resume: [],
  isLimit: false,
});

export const replyBody = (text: string): TranscriptMessageBody => ({
  type: 'assistant',
  content: [{ type: 'text', text }],
  finish: 'complete',
});
