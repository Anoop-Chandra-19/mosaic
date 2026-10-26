import type { KeyCheck, KeyedProvider } from '@shared/types/secrets';

export type KeyCheckFailure = Extract<KeyCheck, { ok: false }>;

/** What stands in the way of a key, as the message under the key field says it. */
export type KeyProblem =
  /** Caught before sending: keys have no spaces. */
  | { kind: 'spaces' }
  /** Caught before sending: the prefix says another provider's key. */
  | { kind: 'otherProvider'; other: KeyedProvider }
  /** The provider's answer, or the keychain's, for `provider`'s key. */
  | { kind: 'checkFailed'; provider: KeyedProvider; failure: KeyCheckFailure }
  /** Main couldn't do it at all. */
  | { kind: 'error'; text: string };
