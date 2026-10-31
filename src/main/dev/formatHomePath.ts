import os from 'node:os';
import path from 'node:path';

/** A folder with the home folder as `~`, so what shows it doesn't show the username. */
export function formatHomePath(folder: string): string {
  const home = os.homedir();
  return folder.startsWith(home + path.sep) ? `~${folder.slice(home.length)}` : folder;
}
