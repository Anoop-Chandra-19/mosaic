import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contextBridge, ipcRenderer } from 'electron';
import { DB_METHODS, dbChannel } from '@shared/ipc/dbMethods';
import '../index';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), send: vi.fn() },
}));

const [name, bridge] = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0] as [
  string,
  { db: Record<string, unknown> },
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
