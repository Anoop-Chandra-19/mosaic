import fs from 'node:fs';
import { AsyncEntry } from '@napi-rs/keyring';
import type { Keyring } from './apiKeys';

/**
 * The OS keychain: Keychain on macOS, Credential Manager on Windows, the Secret Service
 * (GNOME Keyring, KWallet) on Linux. Async, so a keychain prompt never blocks main.
 *
 * With no Secret Service running, @napi-rs/keyring quietly writes to the Linux kernel
 * keyring instead, which forgets everything at logout. Settings would then promise the
 * keychain and lose the key at the next reboot, so on Linux every write is checked, and one
 * that landed in the kernel keyring is undone and refused — Mosaic keeps the key for the
 * session and says so.
 */
export function osKeyring(service: string): Keyring {
  const entry = (account: string) => new AsyncEntry(service, account);
  return {
    get: (account) => entry(account).getPassword(),
    set: async (account, secret) => {
      await entry(account).setPassword(secret);
      if (process.platform === 'linux' && isKernelKeyringEntry(readProcKeys(), service, account)) {
        await entry(account).deletePassword();
        throw new Error(
          'No keychain service is running; the kernel keyring forgets keys at logout'
        );
      }
    },
    delete: (account) => entry(account).deletePassword(),
  };
}

function readProcKeys(): string {
  try {
    return fs.readFileSync('/proc/keys', 'utf8');
  } catch {
    return '';
  }
}

/**
 * Whether `/proc/keys` lists a live kernel-keyring entry for this account — keyutils names
 * them `keyring:<account>@<service>`. Invalidated keys (an `i` flag) linger there until the
 * kernel collects them and don't count.
 */
export function isKernelKeyringEntry(procKeys: string, service: string, account: string): boolean {
  const description = ` keyring:${account}@${service}:`;
  return procKeys.split('\n').some((line) => {
    const flags = line.trim().split(/\s+/)[1] ?? '';
    return line.includes(description) && !flags.includes('i');
  });
}
