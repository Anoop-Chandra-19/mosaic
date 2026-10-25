import { describe, expect, it } from 'vitest';
import type { LoggedMessage } from '../../db/conversations/messages';
import type { ToolCallStamp } from '../../db/conversations/toolCalls';
import { assembleModelContext, STALE_READ } from '../assembleModelContext';

const LOG: LoggedMessage[] = [
  {
    seq: 1,
    runId: 1,
    body: { type: 'user', text: 'Tighten my summary.', resume: [], isLimit: false },
  },
  {
    seq: 2,
    runId: 1,
    body: {
      type: 'assistant',
      content: [
        { type: 'toolCall', callId: 'c1', name: 'read_document', args: {} },
        { type: 'toolCall', callId: 'c2', name: 'propose_rewrite', args: { id: 'l1' } },
      ],
      finish: 'complete',
    },
  },
  {
    seq: 3,
    runId: 1,
    body: {
      type: 'toolResults',
      results: [
        { callId: 'c1', content: 'Name: Ada Quill …' },
        { callId: 'c2', content: 'l1: suggested. Checks: none.' },
      ],
    },
  },
  { seq: 4, runId: 1, body: { type: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  { seq: 5, runId: 1, body: { type: 'runStopped', reason: 'cancelled' } },
  { seq: 6, runId: 2, body: { type: 'templateSwitched', templateId: 't2', label: 'Data, senior' } },
  { seq: 7, runId: 2, body: { type: 'user', text: 'Now this one.', resume: [], isLimit: false } },
];

const STAMPS: ToolCallStamp[] = [
  { runId: 1, callId: 'c1', name: 'read_document', templateId: 't1', rev: 4 },
  { runId: 1, callId: 'c2', name: 'propose_rewrite', templateId: 't1', rev: 4 },
];

describe('assembleModelContext', () => {
  it('turns each body into the model’s messages, leaving out stops and joining notes to the user’s message', () => {
    expect(assembleModelContext(LOG, STAMPS, { templateId: 't1', rev: 4 })).toEqual([
      { role: 'user', text: 'Tighten my summary.' },
      { role: 'assistant', parts: (LOG[1].body as { content: unknown }).content },
      {
        role: 'toolResult',
        callId: 'c1',
        toolName: 'read_document',
        content: 'Name: Ada Quill …',
        isError: undefined,
      },
      {
        role: 'toolResult',
        callId: 'c2',
        toolName: 'propose_rewrite',
        content: 'l1: suggested. Checks: none.',
        isError: undefined,
      },
      { role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] },
      { role: 'user', text: 'The open resume is now “Data, senior”.\n\nNow this one.' },
    ]);
  });

  it.each([
    ['the draft has moved on', { templateId: 't1', rev: 5 }],
    ['another resume is open', { templateId: 't2', rev: 4 }],
    ['none is open', null],
  ])('marks a read stale when %s, and leaves other answers alone', (_, draft) => {
    const results = assembleModelContext(LOG, STAMPS, draft).filter(
      (message) => message.role === 'toolResult'
    );
    expect(results.map((message) => message.content)).toEqual([
      STALE_READ,
      'l1: suggested. Checks: none.',
    ]);
  });
});
