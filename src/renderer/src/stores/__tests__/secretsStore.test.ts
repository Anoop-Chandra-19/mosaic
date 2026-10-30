import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyCheck, SecretsStatus } from '@shared/types/secrets';
import {
  checkApiKey,
  forgetApiKeys,
  loadSecretsStatus,
  removeApiKey,
  saveApiKey,
  useSecretsStore,
} from '../secretsStore';

const statusSavedAt = (savedAt: number): SecretsStatus => ({
  keychain: 'available',
  saved: { openai: { where: 'keychain', savedAt, checkedAt: savedAt } },
});
const NO_KEYS: SecretsStatus = { keychain: 'available', saved: {} };
const OPTIONS = { check: true, forgetOnClose: false };

const secrets = {
  status: vi.fn<() => Promise<SecretsStatus>>(),
  save: vi.fn<() => Promise<KeyCheck>>(),
  check: vi.fn<() => Promise<KeyCheck>>(),
  remove: vi.fn<() => Promise<SecretsStatus>>(),
  forgetAll: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal('window', { mosaic: { secrets } });
  useSecretsStore.setState({ status: statusSavedAt(1), loadFailed: false });
});

afterEach(() => vi.unstubAllGlobals());

describe('the saved keys', () => {
  it('are read again on request, and a failed read keeps what was known', async () => {
    secrets.status.mockResolvedValueOnce(statusSavedAt(2));
    await loadSecretsStatus();
    expect(useSecretsStore.getState()).toEqual({ status: statusSavedAt(2), loadFailed: false });

    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    secrets.status.mockRejectedValueOnce(new Error('No answer'));
    await loadSecretsStatus();
    expect(useSecretsStore.getState()).toEqual({ status: statusSavedAt(2), loadFailed: true });
  });

  it('take the status each change answers with', async () => {
    secrets.save.mockResolvedValueOnce({ ok: true, status: statusSavedAt(2) });
    await saveApiKey('openai', 'a-key', OPTIONS);
    expect(useSecretsStore.getState().status).toEqual(statusSavedAt(2));

    secrets.check.mockResolvedValueOnce({ ok: true, status: statusSavedAt(3) });
    await checkApiKey('openai');
    expect(useSecretsStore.getState().status).toEqual(statusSavedAt(3));

    secrets.remove.mockResolvedValueOnce(NO_KEYS);
    await removeApiKey('openai');
    expect(useSecretsStore.getState().status).toEqual(NO_KEYS);

    secrets.forgetAll.mockResolvedValueOnce({ status: statusSavedAt(4), unconfirmed: [] });
    await expect(forgetApiKeys()).resolves.toMatchObject({ unconfirmed: [] });
    expect(useSecretsStore.getState().status).toEqual(statusSavedAt(4));
  });

  it('stay as they were when a check fails, and the failure goes back to the caller', async () => {
    secrets.save.mockResolvedValueOnce({ ok: false, reason: 'refused' });
    await expect(saveApiKey('openai', 'a-key', OPTIONS)).resolves.toEqual({
      ok: false,
      reason: 'refused',
    });
    expect(useSecretsStore.getState().status).toEqual(statusSavedAt(1));
  });
});
