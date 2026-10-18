import { describe, expect, it } from 'vitest';
import { chooseDatabaseFolder, type DatabaseFolderInputs } from '../databaseFolder';

const installed = (
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
  userDataDir: string
): DatabaseFolderInputs => ({
  platform,
  env,
  homeDir,
  appName: 'Mosaic',
  userDataDir,
  isUserDataRedirected: false,
});

describe('chooseDatabaseFolder', () => {
  it.each([
    [
      'Windows: the local, never the roaming, profile',
      installed(
        'win32',
        { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' },
        'C:\\Users\\ada',
        'C:\\Users\\ada\\AppData\\Roaming\\Mosaic'
      ),
      'C:\\Users\\ada\\AppData\\Local\\Mosaic',
    ],
    [
      'Windows without LOCALAPPDATA',
      installed('win32', {}, 'C:\\Users\\ada', 'C:\\Users\\ada\\AppData\\Roaming\\Mosaic'),
      'C:\\Users\\ada\\AppData\\Local\\Mosaic',
    ],
    [
      'Linux: XDG data, not the config folder',
      installed('linux', {}, '/home/ada', '/home/ada/.config/Mosaic'),
      '/home/ada/.local/share/Mosaic',
    ],
    [
      'Linux with XDG_DATA_HOME set',
      installed('linux', { XDG_DATA_HOME: '/data/ada' }, '/home/ada', '/home/ada/.config/Mosaic'),
      '/data/ada/Mosaic',
    ],
    [
      'Linux with a relative XDG_DATA_HOME, which the spec says to ignore',
      installed('linux', { XDG_DATA_HOME: 'data' }, '/home/ada', '/home/ada/.config/Mosaic'),
      '/home/ada/.local/share/Mosaic',
    ],
    [
      'another Unix, as Linux',
      installed('freebsd', {}, '/home/ada', '/home/ada/.config/Mosaic'),
      '/home/ada/.local/share/Mosaic',
    ],
    [
      'macOS: Application Support, as userData already is',
      installed('darwin', {}, '/Users/ada', '/Users/ada/Library/Application Support/Mosaic'),
      '/Users/ada/Library/Application Support/Mosaic',
    ],
  ])('%s', (_, inputs, folder) => {
    expect(chooseDatabaseFolder(inputs)).toBe(folder);
  });

  it('keeps the database in a redirected profile, so dev and the tests never reach the real one', () => {
    const inputs = installed(
      'linux',
      { XDG_DATA_HOME: '/data/ada' },
      '/home/ada',
      '/repo/.dev-data'
    );
    expect(chooseDatabaseFolder({ ...inputs, isUserDataRedirected: true })).toBe('/repo/.dev-data');
  });
});
