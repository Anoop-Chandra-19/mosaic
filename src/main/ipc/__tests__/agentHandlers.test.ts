import { describe, expect, it, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { MAX_AGENT_MESSAGE_LENGTH } from '@shared/types/agentBridge';
import type { AgentRuns, RunPage } from '../../agent/agentRuns';
import { createAgentHandlers } from '../agentHandlers';

function setUp() {
  const runs: AgentRuns = {
    start: vi.fn(() => ({ ok: true as const, conversationId: 1, runId: 1 })),
    carryOn: vi.fn(() => ({ ok: true as const, conversationId: 1, runId: 2 })),
    stop: vi.fn(),
    answerTool: vi.fn(),
    stopAll: vi.fn(async () => {}),
  };
  const noDb = () => {
    throw new Error('not read in these tests');
  };
  return { runs, handlers: createAgentHandlers(runs, noDb as () => Database) };
}

const page: RunPage = { sendEvent: () => {}, sendToolCall: () => {} };

const answer = (result: unknown) => ({ ok: true, result });

describe('agent handlers', () => {
  it('pass checked arguments on', () => {
    const { runs, handlers } = setUp();
    handlers.start(page, { conversationId: null, text: 'Tighten it.', templateId: 't1' });
    handlers.carryOn(page, { conversationId: 4, templateId: null });
    handlers.stop(2);
    handlers.answerTool(2, 'c1', answer({ content: '', isError: false, draft: null }));
    handlers.answerTool(2, 'c2', { ok: false, message: 'Error: no view' });

    expect(runs.start).toHaveBeenCalledWith(page, {
      conversationId: null,
      text: 'Tighten it.',
      templateId: 't1',
    });
    expect(runs.carryOn).toHaveBeenCalledWith(page, { conversationId: 4, templateId: null });
    expect(runs.stop).toHaveBeenCalledWith(2);
    expect(vi.mocked(runs.answerTool).mock.calls).toEqual([
      [2, 'c1', { ok: true, result: { content: '', isError: false, draft: null } }],
      [2, 'c2', { ok: false, message: 'Error: no view' }],
    ]);
  });

  it.each<[string, (handlers: ReturnType<typeof setUp>['handlers']) => unknown]>([
    ['a start that isn’t an object', (h) => h.start(page, 'Tighten it.')],
    ['empty text', (h) => h.start(page, { conversationId: null, text: '  ', templateId: null })],
    [
      'a runaway paste',
      (h) =>
        h.start(page, {
          conversationId: null,
          text: 'x'.repeat(MAX_AGENT_MESSAGE_LENGTH + 1),
          templateId: null,
        }),
    ],
    [
      'a conversation id of 0',
      (h) => h.start(page, { conversationId: 0, text: 'Hi', templateId: null }),
    ],
    [
      'a template id that isn’t text',
      (h) => h.start(page, { conversationId: null, text: 'Hi', templateId: 7 }),
    ],
    [
      'carrying on with no conversation',
      (h) => h.carryOn(page, { conversationId: null, templateId: null }),
    ],
    ['a run id as text', (h) => h.stop('2')],
    ['a page of 0 messages', (h) => h.readMessages(1, { limit: 0 })],
    ['an answer that doesn’t say if the tool ran', (h) => h.answerTool(2, 'c1', { content: '' })],
    [
      'an answer without its error flag',
      (h) => h.answerTool(2, 'c1', answer({ content: '', draft: null })),
    ],
    [
      'an answer with a draft rev as text',
      (h) =>
        h.answerTool(
          2,
          'c1',
          answer({ content: '', isError: false, draft: { templateId: 't', rev: '1' } })
        ),
    ],
  ])('refuse %s', (_, call) => {
    const { runs, handlers } = setUp();
    expect(() => call(handlers)).toThrow();
    expect(runs.start).not.toHaveBeenCalled();
    expect(runs.answerTool).not.toHaveBeenCalled();
  });
});
