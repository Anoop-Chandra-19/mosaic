import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_DEV_SWITCHES_OFF, type DevToolRun } from '@shared/types/devTools';
import {
  parseDevSwitches,
  parseDevToolRuns,
  readDevToolsFile,
  updateDevToolsFile,
} from '../devHandlers';

let folder: string;
let file: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-dev-'));
  file = path.join(folder, 'dev-tools.json');
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

describe('developer tools handlers', () => {
  it('keep Recent across reads, choices included', async () => {
    const runs: DevToolRun[] = [
      { toolId: 'stageSuggestions', args: {} },
      { toolId: 'history', args: { template: 'Tailored for Kestrel', version: 12, isPage: true } },
    ];
    await updateDevToolsFile(file, { recent: runs });
    expect((await readDevToolsFile(file)).recent).toEqual(runs);
  });

  it('keep each part as it was when another changes, however close together', async () => {
    const switches = { ...ALL_DEV_SWITCHES_OFF, slowMotion: true };
    await Promise.all([
      updateDevToolsFile(file, { recent: [{ toolId: 'stageSuggestions', args: {} }] }),
      updateDevToolsFile(file, { switches }),
      updateDevToolsFile(file, { reopenAddress: 'settings / history' }),
    ]);
    expect(await readDevToolsFile(file)).toEqual({
      recent: [{ toolId: 'stageSuggestions', args: {} }],
      switches,
      reopenAddress: 'settings / history',
    });
  });

  it('read nothing from a missing or unreadable file, and a part that no longer reads as unkept', async () => {
    const nothing = { recent: [], switches: ALL_DEV_SWITCHES_OFF, reopenAddress: null };
    expect(await readDevToolsFile(file)).toEqual(nothing);
    fs.writeFileSync(file, '{ not json');
    expect(await readDevToolsFile(file)).toEqual(nothing);
    fs.writeFileSync(file, JSON.stringify({ recent: 'x', switches: { slowMotion: true } }));
    expect(await readDevToolsFile(file)).toEqual({
      ...nothing,
      switches: { ...ALL_DEV_SWITCHES_OFF, slowMotion: true },
    });
  });

  it('refuse switches that are unknown or not on or off', () => {
    for (const refused of [null, [], { warpSpeed: true }, { slowMotion: 'yes' }]) {
      expect(() => parseDevSwitches(refused)).toThrow();
    }
  });

  it('refuse anything but a short list of plain runs', () => {
    const run = { toolId: 'stageSuggestions', args: {} };
    for (const refused of [
      null,
      'stageSuggestions',
      Array(5).fill(run),
      [{ toolId: '', args: {} }],
      [{ toolId: 'x'.repeat(65), args: {} }],
      [{ toolId: 'history', args: [] }],
      [{ toolId: 'history', args: { version: Number.NaN } }],
      [{ toolId: 'history', args: { template: { name: 'nested' } } }],
      [{ toolId: 'history', args: { template: 'x'.repeat(513) } }],
    ]) {
      expect(() => parseDevToolRuns(refused)).toThrow();
    }
  });
});
