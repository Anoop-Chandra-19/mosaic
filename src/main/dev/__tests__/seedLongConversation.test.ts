import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDatabase, type Database } from '../../db/connection';
import { readConversationLog, readMessagePage } from '../../db/conversations/messages';
import { seedLongConversation } from '../seedLongConversation';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => db.close());

it('writes whole runs until the log holds the messages asked for', () => {
  const conversationId = seedLongConversation(db, 10);
  const types = readConversationLog(db, conversationId).map(({ body }) => body.type);
  expect(types).toHaveLength(12);
  expect(types.slice(0, 4)).toEqual(['user', 'assistant', 'toolResults', 'assistant']);
  expect(readMessagePage(db, conversationId, { limit: 4 })).toHaveLength(4);
});
