import path from 'node:path';

export interface DatabaseFolderInputs {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  /** The folder name inside the OS's data folder: `Mosaic`. */
  appName: string;
  userDataDir: string;
  /** Dev and the e2e tests point userData at a profile of their own. */
  isUserDataRedirected: boolean;
}

type LocalDataFolder = (inputs: DatabaseFolderInputs) => string;

/**
 * Each OS's place for data that stays on this computer. userData would roam on Windows
 * (`%APPDATA%` is the roaming profile, copied to a server and back on managed computers)
 * and is the settings folder on Linux (`~/.config`); a live SQLite file belongs in
 * neither. macOS's userData is already Application Support, the right place.
 */
const LOCAL_DATA_FOLDER: Record<'win32' | 'darwin' | 'other', LocalDataFolder> = {
  win32: ({ env, homeDir, appName }) =>
    path.win32.join(env.LOCALAPPDATA || path.win32.join(homeDir, 'AppData', 'Local'), appName),
  darwin: ({ userDataDir }) => userDataDir,
  // XDG: a relative XDG_DATA_HOME is invalid and is ignored.
  other: ({ env, homeDir, appName }) => {
    const dataHome = env.XDG_DATA_HOME;
    return path.posix.join(
      dataHome && path.posix.isAbsolute(dataHome)
        ? dataHome
        : path.posix.join(homeDir, '.local', 'share'),
      appName
    );
  },
};

/**
 * Where `mosaic.db` lives. A redirected profile keeps it, so dev and the tests never
 * touch the real one; otherwise the OS's local data folder.
 */
export function chooseDatabaseFolder(inputs: DatabaseFolderInputs): string {
  if (inputs.isUserDataRedirected) return inputs.userDataDir;
  const platform =
    inputs.platform === 'win32' || inputs.platform === 'darwin' ? inputs.platform : 'other';
  return LOCAL_DATA_FOLDER[platform](inputs);
}
