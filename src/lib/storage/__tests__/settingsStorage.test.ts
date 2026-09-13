import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  settings: {
    set: vi.fn<(key: string, value: string) => Promise<void>>(async () => {}),
    remove: vi.fn<(key: string) => Promise<void>>(async () => {}),
  },
}));
vi.mock('../mosaicDb', () => ({ getDb: () => db }));

const { seedSettings, settingsStorage } = await import('../settingsStorage');

beforeEach(() => {
  vi.clearAllMocks();
  seedSettings({ ui: '{"darkMode":true}' });
});

describe('settingsStorage', () => {
  it('reads what boot loaded, synchronously', () => {
    expect(settingsStorage.getItem('ui')).toBe('{"darkMode":true}');
    expect(settingsStorage.getItem('ai')).toBeNull();
  });

  it('writes through to the database and reads its own writes', () => {
    settingsStorage.setItem('ui', '{"darkMode":false}');

    expect(settingsStorage.getItem('ui')).toBe('{"darkMode":false}');
    expect(db.settings.set).toHaveBeenCalledWith('ui', '{"darkMode":false}');
  });

  it('skips writes that change nothing', () => {
    settingsStorage.setItem('ui', '{"darkMode":true}');
    settingsStorage.removeItem('ai');

    expect(db.settings.set).not.toHaveBeenCalled();
    expect(db.settings.remove).not.toHaveBeenCalled();
  });

  it('removes a setting', () => {
    settingsStorage.removeItem('ui');

    expect(settingsStorage.getItem('ui')).toBeNull();
    expect(db.settings.remove).toHaveBeenCalledWith('ui');
  });

  it('logs a failed write instead of throwing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.settings.set.mockRejectedValueOnce(new Error('disk full'));

    settingsStorage.setItem('ui', '{}');
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    error.mockRestore();
  });
});
