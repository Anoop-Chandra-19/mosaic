import { useEffect } from 'react';
import { create } from 'zustand';
import { secretsService } from '@/lib/services/secretsService';
import type {
  ForgetResult,
  KeyCheck,
  KeyedProvider,
  SaveKeyOptions,
  SecretsStatus,
} from '@shared/types/secrets';

/*
 * Which API keys main holds, and what is known about them: one copy, for Settings and the
 * assistant's notice alike. Replaced by the status each change answers with, and read again
 * whenever a screen that shows it opens or a run ends, since a run can find a key refused.
 * Main answers without touching the keychain.
 */

interface SecretsState {
  /** Null until first read. */
  status: SecretsStatus | null;
  loadFailed: boolean;
}

export const useSecretsStore = create<SecretsState>()(() => ({
  status: null,
  loadFailed: false,
}));

const showStatus = (status: SecretsStatus) => useSecretsStore.setState({ status });

export async function loadSecretsStatus(): Promise<void> {
  try {
    useSecretsStore.setState({ status: await secretsService.status(), loadFailed: false });
  } catch (error) {
    console.error('Could not check for saved keys', error);
    useSecretsStore.setState({ loadFailed: true });
  }
}

/** The saved keys as they stand now, read again as the calling screen opens. */
export function useSecretsStatus(): SecretsState {
  useEffect(() => void loadSecretsStatus(), []);
  return useSecretsStore();
}

function keepCheckedStatus(check: KeyCheck): KeyCheck {
  if (check.ok) showStatus(check.status);
  return check;
}

/** Checks the key unless told not to, and keeps it only if that passes. */
export async function saveApiKey(
  provider: KeyedProvider,
  key: string,
  options: SaveKeyOptions
): Promise<KeyCheck> {
  return keepCheckedStatus(await secretsService.save(provider, key, options));
}

export async function checkApiKey(provider: KeyedProvider): Promise<KeyCheck> {
  return keepCheckedStatus(await secretsService.check(provider));
}

export async function removeApiKey(provider: KeyedProvider): Promise<void> {
  showStatus(await secretsService.remove(provider));
}

export async function forgetApiKeys(): Promise<ForgetResult> {
  const result = await secretsService.forgetAll();
  showStatus(result.status);
  return result;
}
