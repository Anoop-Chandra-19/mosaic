import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDevToolRuns, readRecentDevRuns, saveRecentDevRuns } from '../devHandlers';

let folder: string;
let file: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-dev-'));
  file = path.join(folder, 'dev-tools.json');
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

describe('developer tools handlers', () => {
  it('keep Recent across reads, choices included', async () => {
    const runs = [
      { toolId: 'stageSuggestions', args: {} },
      { toolId: 'history', args: { template: 'Tailored for Kestrel', version: 12, isPage: true } },
    ];
    await saveRecentDevRuns(file, runs);
    expect(await readRecentDevRuns(file)).toEqual(runs);
  });

  it('read nothing from a missing or unreadable file', async () => {
    expect(await readRecentDevRuns(file)).toEqual([]);
    fs.writeFileSync(file, '{ not json');
    expect(await readRecentDevRuns(file)).toEqual([]);
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
