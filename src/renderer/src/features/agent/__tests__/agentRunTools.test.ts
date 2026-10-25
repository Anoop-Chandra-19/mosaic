import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResumeStore } from '@/stores/resumeStore';
import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentRunEnvelope, AgentStart, AgentToolCall } from '@shared/types/agentBridge';
import { makeResume } from '../../suggestions/proposals/__tests__/proposalFixtures';
import { answerAgentToolCalls, askAgent } from '../agentRunTools';

let runTool: (call: AgentToolCall) => Promise<AgentToolResult>;
let follow: (envelope: AgentRunEnvelope) => void;
let finishStart: (start: AgentStart) => void;
let stopAnswering: () => void;

beforeEach(() => {
  vi.stubGlobal('window', {
    mosaic: {
      agent: {
        start: vi.fn(() => new Promise<AgentStart>((resolve) => (finishStart = resolve))),
        onEvent: (given: typeof follow) => {
          follow = given;
          return () => {};
        },
        onToolCall: (given: typeof runTool) => {
          runTool = given;
          return () => {};
        },
      },
    },
  });
  useResumeStore.getState().loadDraft({ templateId: 't1', doc: makeResume(), rev: 3 });
  stopAnswering = answerAgentToolCalls();
});

afterEach(() => {
  stopAnswering();
  vi.unstubAllGlobals();
});

const readCall = (runId: number): AgentToolCall => ({
  runId,
  callId: 'c1',
  name: 'read_document',
  args: {},
});

describe('the page’s side of a run', () => {
  it('answers the calls of a run asked for here, even one that comes before its id', async () => {
    const asked = askAgent('Tighten my bullets.');
    expect(window.mosaic.agent.start).toHaveBeenCalledWith({
      conversationId: null,
      text: 'Tighten my bullets.',
      templateId: 't1',
    });
    const early = runTool(readCall(4));
    finishStart({ ok: true, conversationId: 1, runId: 4 });
    await asked;

    expect(await early).toMatchObject({ isError: false, draft: { templateId: 't1', rev: 3 } });
    expect((await early).content).toContain('Rowan Vale');
  });

  it('fails a call from a run it didn’t ask for, or one that has ended', async () => {
    const asked = askAgent('Tighten my bullets.');
    finishStart({ ok: true, conversationId: 1, runId: 4 });
    await asked;
    await expect(runTool(readCall(9))).rejects.toThrow('Run 9 wasn’t asked for');

    follow({ conversationId: 1, runId: 4, seq: 3, event: { type: 'runEnded' } });
    await Promise.resolve();
    await expect(runTool(readCall(4))).rejects.toThrow('Run 4 wasn’t asked for');
  });
});
