import { READ_TOOLS } from '@shared/agent-tools/readTools';
import type { LoggedMessage } from '../db/conversations/messages';
import type { ToolCallStamp } from '../db/conversations/toolCalls';
import type { ModelMessage } from '../model-providers/modelProvider';

/** The draft a run is working against: which template, and its rev. */
export interface DraftStamp {
  templateId: string;
  rev: number;
}

export const STALE_READ =
  'This read is out of date: the resume has changed since, or another one is open. Read it again.';

const callKey = (runId: number | null, callId: string) => `${runId} ${callId}`;

/** A read of another template, or of this one at another rev, no longer says what's there. */
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
      // For the user: the model hears of a stop from the user's next message, if at all.
      return [];
  }
}

/** Notes the app writes as the user's go into the user message beside them. */
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
 * The conversation as the model reads it, built from the log every step: each body in
 * `seq` order in the provider-neutral shape, reads gone stale replaced.
 */
export function assembleModelContext(
  log: LoggedMessage[],
  toolCalls: ToolCallStamp[],
  draft: DraftStamp | null
): ModelMessage[] {
  const stamps = new Map(toolCalls.map((stamp) => [callKey(stamp.runId, stamp.callId), stamp]));
  return joinUserMessages(log.flatMap((message) => toModelMessages(message, stamps, draft)));
}
