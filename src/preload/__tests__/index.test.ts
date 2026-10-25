import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contextBridge, ipcRenderer } from 'electron';
import { AGENT_TOOL_ANSWER, AGENT_TOOL_CALL } from '@shared/ipc/agentChannels';
import { DB_METHODS, dbChannel } from '@shared/ipc/dbMethods';
import type { AgentToolCall, MosaicAgent } from '@shared/types/agentBridge';
import '../index';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
}));

const [name, bridge] = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0] as [
  string,
  { db: Record<string, unknown>; agent: MosaicAgent },
];

beforeEach(() => {
  vi.mocked(ipcRenderer.invoke).mockReset();
});

describe('database preload bridge', () => {
  it('exposes nested namespaces rather than dotted property names', () => {
    expect(name).toBe('mosaic');
    expect(Object.keys(bridge.db).sort()).toEqual([
      'boot',
      'bundle',
      'drafts',
      'settings',
      'templates',
      'versions',
    ]);
  });

  it.each(DB_METHODS)(
    '%s forwards its arguments and result over its own channel',
    async (method) => {
      let handler: unknown = bridge.db;
      for (const key of method.split('.')) {
        handler = (handler as Record<string, unknown> | undefined)?.[key];
      }
      expect(handler).toBeTypeOf('function');
      const args = ['test-id', { rev: 2 }];
      const result = { ok: true, value: 'test-result' };
      vi.mocked(ipcRenderer.invoke).mockResolvedValueOnce(result);

      await expect((handler as (...args: unknown[]) => Promise<unknown>)(...args)).resolves.toEqual(
        result
      );
      expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith(dbChannel(method), ...args);
    }
  );
});

describe('agent preload bridge', () => {
  it('answers each tool call, a throw as a failed answer, with one runner at a time', async () => {
    const result = { content: 'Name: Ada', isError: false, draft: null };
    const stopRunning = bridge.agent.onToolCall(async (call) => {
      if (call.callId === 'c2') throw new Error('no view');
      return result;
    });
    expect(() => bridge.agent.onToolCall(async () => result)).toThrow();

    const [channel, receive] = vi.mocked(ipcRenderer.on).mock.calls.at(-1)!;
    expect(channel).toBe(AGENT_TOOL_CALL);
    const call = (callId: string): AgentToolCall => ({ runId: 3, callId, name: 'n', args: {} });
    receive({} as never, call('c1'));
    receive({} as never, call('c2'));
    await vi.waitFor(() => expect(ipcRenderer.invoke).toHaveBeenCalledTimes(2));

    expect(vi.mocked(ipcRenderer.invoke).mock.calls).toEqual([
      [AGENT_TOOL_ANSWER, 3, 'c1', { ok: true, result }],
      [AGENT_TOOL_ANSWER, 3, 'c2', { ok: false, message: 'Error: no view' }],
    ]);
    stopRunning();
    expect(() => bridge.agent.onToolCall(async () => result)).not.toThrow();
  });
});
