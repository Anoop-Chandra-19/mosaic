/**
 * `bun run dev:reset`: start development over. Forgets the API keys dev runs saved in the
 * keychain (the `Mosaic (dev)` service, never an installed Mosaic's), then deletes
 * `.dev-data/`, which holds the database and the rest of the dev profile. Quit the app
 * first: it holds the database open.
 */
import fs from 'node:fs';
import path from 'node:path';
// With their extensions, so Node runs this file directly (`npm run dev:reset` or `bun run …`).
import { KEYCHAIN_SERVICE, osKeyring } from '../src/main/secrets/osKeyring.ts';
import { KEYED_PROVIDERS } from '../src/shared/types/secrets.ts';

/** How many keys went; null if the keychain couldn't be reached. */
async function forgetDevKeys(): Promise<number | null> {
  const keyring = osKeyring(KEYCHAIN_SERVICE.dev);
  try {
    const deleted = await Promise.all(KEYED_PROVIDERS.map((provider) => keyring.delete(provider)));
    return deleted.filter(Boolean).length;
  } catch {
    return null;
  }
}

// A few tiles, for fun.
const BANNER = `
   ▚▞▚▞▚▞   mosaic
   ▞▚▞▚▞▚   dev reset
   ▚▞▚▞▚▞
`;

/**
 * A line saying what it waits on, replaced by the result once it answers. Only a terminal
 * can rewrite a line; piped into a log, each is printed as it is.
 */
function showWaiting(text: string): (result: string) => void {
  if (!process.stdout.isTTY) return (result) => console.log(result);
  process.stdout.write(text);
  return (result) => {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(result);
  };
}

console.log(BANNER);

// A locked keychain asks to be unlocked first, so this can wait on the user.
const settleKeys = showWaiting(`   … asking the keychain for "${KEYCHAIN_SERVICE.dev}" keys`);
const removed = await forgetDevKeys();
settleKeys(
  removed === null
    ? `   ! couldn't reach the keychain; any keys under "${KEYCHAIN_SERVICE.dev}" are still there`
    : `   ✓ removed ${removed} API ${removed === 1 ? 'key' : 'keys'} from "${KEYCHAIN_SERVICE.dev}"`
);

const devData = path.resolve(import.meta.dirname, '../.dev-data');
fs.rmSync(devData, { recursive: true, force: true });
console.log('   ✓ deleted .dev-data/');
console.log('\n   ▞ fresh start. `bun run dev` builds it again.\n');
