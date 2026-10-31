import { formatRelativeTime } from '@shared/time/formatTime';
import type { ModelProviderId } from '@shared/types/modelProviders';
import {
  isKeyedProvider,
  type KeyedProvider,
  type SavedKey,
  type SecretsStatus,
} from '@shared/types/secrets';
import { MODEL_PROVIDER_OPTION_BY_ID } from './modelProviderOptions';

/** Where a provider stands, as its status dot and words say it. */
export type KeyState = 'local' | 'none' | 'refused' | 'unchecked' | 'saved' | 'savedForSession';

/** Null while the status is still loading. */
export function readKeyState(
  provider: ModelProviderId,
  status: SecretsStatus | null
): KeyState | null {
  if (!isKeyedProvider(provider)) return 'local';
  if (!status) return null;
  const saved = status.saved[provider];
  if (!saved) return 'none';
  if (saved.refusedAt !== undefined) return 'refused';
  if (saved.checkedAt === null) return 'unchecked';
  return saved.where === 'session' ? 'savedForSession' : 'saved';
}

/** Keys Forget couldn't confirm gone, and where to look for them. */
export function describeUnconfirmedKeys(providers: KeyedProvider[]): string {
  const labels = providers.map((provider) => MODEL_PROVIDER_OPTION_BY_ID[provider].label);
  const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(labels);
  return `Your keychain wouldn’t let Mosaic clear any ${list} keys left there from before. Look for Mosaic in your keychain app and delete what you find.`;
}

/** "an OpenAI", "a Google". */
export const withArticle = (label: string) => `${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}`;

function describeWhere(saved: SavedKey, keychain: SecretsStatus['keychain']): string {
  if (saved.where === 'keychain') return 'in your keychain';
  // Without a keychain there was no choice, so it isn't put as one.
  return keychain === 'unavailable'
    ? 'until Mosaic closes'
    : 'for this session, forgotten when Mosaic closes';
}

function describeChecked({ checkedAt, refusedAt }: SavedKey, label: string, now: number): string {
  if (refusedAt !== undefined) return `${label} refused it ${formatRelativeTime(refusedAt, now)}`;
  return checkedAt === null ? 'Not checked yet' : `Checked ${formatRelativeTime(checkedAt, now)}`;
}

/** A saved key's two lines: when and where it was saved, and what last said it works or not. */
export function describeSavedKey(
  saved: SavedKey,
  keychain: SecretsStatus['keychain'],
  label: string,
  now: number = Date.now()
): { savedLine: string; checkedLine: string } {
  return {
    savedLine: `Saved ${formatRelativeTime(saved.savedAt, now)} ${describeWhere(saved, keychain)}`,
    checkedLine: describeChecked(saved, label, now),
  };
}
