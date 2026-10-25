import { describe, expect, it } from 'vitest';
import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelMessage, ToolResultMessage } from '../../model-providers/modelProvider';
import { createScriptedModelProvider } from '../scriptedModelProvider';

async function playStep(messages: ModelMessage[]): Promise<ModelStreamEvent[]> {
  const events: ModelStreamEvent[] = [];
  const signal = new AbortController().signal;
  const request = { model: 'scripted', system: '', messages, tools: [], cacheKey: 'c1', signal };
  for await (const event of createScriptedModelProvider().streamReply(request)) events.push(event);
  return events;
}

const ASK: ModelMessage = { role: 'user', text: 'Tighten my bullets.' };

const readResult = (content: string): ToolResultMessage => ({
  role: 'toolResult',
  callId: 'scripted-1-1',
  toolName: 'read_document',
  content,
});

const calls = (events: ModelStreamEvent[]) =>
  events.flatMap((event) => (event.type === 'toolCall' ? [[event.name, event.args]] : []));

describe('the scripted model', () => {
  it('reads, suggests from what it read, then says it’s done', async () => {
    expect(calls(await playStep([ASK]))).toEqual([['read_document', {}]]);

    const read = readResult(
      '## Experience (s1)\n### Engineer, Harbor (e1)\n- b1: Led the billing move.\n- b2 (hidden): Wrote the runbook'
    );
    expect(calls(await playStep([ASK, read]))).toEqual([
      ['propose_rewrite', { id: 'b1', text: 'Led the billing move', reason: 'Scripted.' }],
      ['propose_select', { id: 'b2', show: true, reason: 'Scripted.' }],
    ]);

    const proposed: ModelMessage = { ...read, toolName: 'propose_select', content: 'Staged.' };
    const done = await playStep([ASK, read, proposed]);
    expect(calls(done)).toEqual([]);
    expect(done.at(-1)).toMatchObject({ type: 'finish', reason: 'complete' });
  });

  it('suggests nothing when the read has no bullets', async () => {
    const events = await playStep([
      ASK,
      readResult('No resume is open. Ask the user to open one.'),
    ]);
    expect(calls(events)).toEqual([]);
    expect(events[0]).toEqual({ type: 'textDelta', text: 'There are no bullets to change.' });
  });
});
