import { READ_TOOLS } from '@shared/agent-tools/readTools';
import type { LoggedMessage } from '../db/conversations/messages';
import type { ToolCallStamp } from '../db/conversations/toolCalls';
import type { ModelMessage } from '../model-providers/modelProvider';

/** Identifies the template and draft edit counter used to detect stale reads. */
export interface DraftStamp {
  templateId: string;
  rev: number;
}

export const STALE_READ =
  'This read is out of date: the resume has changed since, or another one is open. Read it again.';

const callKey = (runId: number | null, callId: string) => `${runId} ${callId}`;

function isStaleRead(stamp: ToolCallStamp | undefined, draft: DraftStamp | null): boolean {
  if (!stamp || !Object.hasOwn(READ_TOOLS, stamp.name)) return false;
  return draft === null || stamp.templateId !== draft.templateId || stamp.rev !== draft.rev;
}

function toModelMessages(
  { runId, body }: LoggedMessage,
  stamps: Map<string, ToolCallStamp>,
  draft: DraftStamp | null
): ModelMessage[] {
  switch (body.type) {
    case 'user':
      return [{ role: 'user', text: body.text }];
    case 'assistant':
      return [{ role: 'assistant', parts: body.content }];
    case 'toolResults':
      return body.results.map((result) => {
        const stamp = stamps.get(callKey(runId, result.callId));
        const isStale = !result.isError && isStaleRead(stamp, draft);
        return {
          role: 'toolResult',
          callId: result.callId,
          toolName: stamp?.name ?? '',
          content: isStale ? STALE_READ : result.content,
          isError: result.isError,
        };
      });
    case 'templateSwitched':
      return [{ role: 'user', text: `The open resume is now “${body.label}”.` }];
    case 'runStopped':
      // Stop records are for the user, not model context.
      return [];
  }
}

/** Merge adjacent user-role messages so app notes share a message with nearby user text. */
function joinUserMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.reduce<ModelMessage[]>((joined, message) => {
    const last = joined.at(-1);
    if (last?.role === 'user' && message.role === 'user') {
      joined[joined.length - 1] = { role: 'user', text: `${last.text}\n\n${message.text}` };
    } else {
      joined.push(message);
    }
    return joined;
  }, []);
}

/**
 * Rebuilds provider-neutral context each step from the log, which must be in `seq` order.
 * Replaces successful reads from another template or draft edit counter with a reread notice.
 * The stored log is unchanged.
 */
export function assembleModelContext(
  log: LoggedMessage[],
  toolCalls: ToolCallStamp[],
  draft: DraftStamp | null
): ModelMessage[] {
  const stamps = new Map(toolCalls.map((stamp) => [callKey(stamp.runId, stamp.callId), stamp]));
  return joinUserMessages(log.flatMap((message) => toModelMessages(message, stamps, draft)));
}
