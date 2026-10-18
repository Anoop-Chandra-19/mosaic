import path from 'node:path';
import { app } from 'electron';

// Unpackaged runs (`bun run dev`, `preview`) keep their data in the repo's gitignored
// .dev-data/, apart from an installed Mosaic's; `bun run dev:reset` wipes it. An explicit
// --user-data-dir (the e2e tests) wins.

/** Must run before the single-instance lock, which lives in the profile. */
export function redirectDevProfile(): void {
  if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
    app.setPath('userData', path.join(app.getAppPath(), '.dev-data'));
  }
}

/** Dev and the e2e tests point userData at a profile of their own. */
export function isUserDataRedirected(): boolean {
  return !app.isPackaged || app.commandLine.hasSwitch('user-data-dir');
}
