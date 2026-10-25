import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MessageBody } from '@shared/types/agentConversation';
import { isMessageBody } from '../validateMessageBody';

/**
 * One body of each type as an earlier build wrote it. Never edit these: they stand for
 * conversations already on disk. A new type or field gets a new file, and the `Record`
 * makes the build fail until every type has one.
 */
const FIXTURE_BY_TYPE: Record<MessageBody['type'], string> = {
  user: 'user.json',
  assistant: 'assistant.json',
  toolResults: 'toolResults.json',
  templateSwitched: 'templateSwitched.json',
  runStopped: 'runStopped.json',
};

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./message-bodies/${name}`, import.meta.url), 'utf8'));
}

describe('isMessageBody', () => {
  it.each(Object.entries(FIXTURE_BY_TYPE))('reads a stored %s body', (type, name) => {
    const body = readFixture(name);
    expect(body).toMatchObject({ type });
    expect(isMessageBody(body)).toBe(true);
  });

  it.each<MessageBody>([
    { type: 'user', text: '', resume: [], isLimit: false },
    { type: 'assistant', content: [] },
    { type: 'assistant', content: [{ type: 'reasoning', durationMs: 0 }] },
    { type: 'assistant', content: [{ type: 'toolCall', callId: 'c', name: 'n', args: null }] },
    { type: 'toolResults', results: [] },
    { type: 'templateSwitched', templateId: 't', label: '' },
    { type: 'runStopped', reason: 'cancelled' },
    { type: 'runStopped', reason: 'repeatedCall', detail: 'order mixes lists' },
  ])('takes a body with only what is required: %o', (body) => {
    expect(isMessageBody(body)).toBe(true);
  });

  it.each([
    ['not an object', 'user'],
    ['an unknown type', { type: 'compaction', summary: '', throughSeq: 1 }],
    ['a type from the prototype', { type: 'toString' }],
    ['a user body without isLimit', { type: 'user', text: '', resume: [] }],
    [
      'a resume ref without a label',
      { type: 'user', text: '', resume: [{ sectionId: 's' }], isLimit: false },
    ],
    ['an unknown part', { type: 'assistant', content: [{ type: 'image', url: 'x' }] }],
    [
      'a negative thinking time',
      { type: 'assistant', content: [{ type: 'reasoning', durationMs: -1 }] },
    ],
    [
      'a tool call without args',
      { type: 'assistant', content: [{ type: 'toolCall', callId: 'c', name: 'n' }] },
    ],
    ['an unknown finish', { type: 'assistant', content: [], finish: 'stopped' }],
    [
      'a result whose error flag is text',
      { type: 'toolResults', results: [{ callId: 'c', content: '', isError: 'yes' }] },
    ],
    ['a switch without its template', { type: 'templateSwitched', label: 'Platform' }],
    ['a stop for an unknown reason', { type: 'runStopped', reason: 'tired' }],
    [
      'an unknown provider error without its message',
      { type: 'runStopped', reason: 'providerError', providerError: { reason: 'failed' } },
    ],
    [
      'a provider’s status as text',
      {
        type: 'runStopped',
        reason: 'providerError',
        providerError: { reason: 'keyRefused', httpStatus: '401' },
      },
    ],
  ])('refuses %s', (_, body) => {
    expect(isMessageBody(body)).toBe(false);
  });
});
