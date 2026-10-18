import type { MessageBody } from '@shared/types/agentConversation';
import { StorageError } from '../storageError';
import { isMessageBody } from './validateMessageBody';

/** A body is checked once, here, before it is written; the log never changes it after. */
export function encodeStoredMessageBody(body: MessageBody): string {
  if (!isMessageBody(body)) throw new StorageError('invalid-argument', 'Not a message body');
  return JSON.stringify(body);
}

/**
 * Bodies are upgraded as they are read, so rows written by older builds keep working. No
 * body has changed shape yet; an upgrade step goes here when one does.
 */
export function parseStoredMessageBody(text: string): MessageBody {
  return JSON.parse(text) as MessageBody;
}
