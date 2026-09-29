import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceFileSafely, writeNewFileSafely } from '../replaceFileSafely';

let folder: string;
const file = () => path.join(folder, 'mosaic-backup.json');
const failWith = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-writes-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(folder, { recursive: true, force: true });
});

describe('replaceFileSafely', () => {
  it('replaces the file, and leaves nothing else behind', async () => {
    fs.writeFileSync(file(), 'old backup');
    await replaceFileSafely(file(), new TextEncoder().encode('new backup'));
    expect(fs.readFileSync(file(), 'utf8')).toBe('new backup');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('keeps the old file whole when the write fails partway', async () => {
    fs.writeFileSync(file(), 'old backup');
    const open = fsp.open.bind(fsp);
    vi.spyOn(fsp, 'open').mockImplementation(async (...args) => {
      const handle = await open(...(args as Parameters<typeof open>));
      handle.writeFile = async () => {
        await fs.promises.appendFile(args[0] as string, 'half of the new');
        throw failWith('ENOSPC');
      };
      return handle;
    });

    await expect(replaceFileSafely(file(), 'new backup')).rejects.toThrow('ENOSPC');
    expect(fs.readFileSync(file(), 'utf8')).toBe('old backup');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('keeps the old file when it cannot be replaced', async () => {
    fs.writeFileSync(file(), 'old backup');
    vi.spyOn(fsp, 'rename').mockRejectedValue(failWith('EBUSY'));

    await expect(replaceFileSafely(file(), 'new backup')).rejects.toThrow('EBUSY');
    expect(fs.readFileSync(file(), 'utf8')).toBe('old backup');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });
});

describe('writeNewFileSafely', () => {
  it('writes a new file', () => {
    writeNewFileSafely(file(), 'backup');
    expect(fs.readFileSync(file(), 'utf8')).toBe('backup');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('refuses a name already taken, leaving that file alone', () => {
    fs.writeFileSync(file(), 'yesterday');
    expect(() => writeNewFileSafely(file(), 'today')).toThrow(
      expect.objectContaining({ code: 'EEXIST' })
    );
    expect(fs.readFileSync(file(), 'utf8')).toBe('yesterday');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('never publishes a half-written file under the final name', () => {
    vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
      throw failWith('ENOSPC');
    });
    expect(() => writeNewFileSafely(file(), 'backup')).toThrow('ENOSPC');
    expect(fs.readdirSync(folder)).toEqual([]);
  });

  it('works where the filesystem cannot link, still refusing a taken name', () => {
    vi.spyOn(fs, 'linkSync').mockImplementation(() => {
      throw failWith('EPERM');
    });
    writeNewFileSafely(file(), 'backup');
    expect(fs.readFileSync(file(), 'utf8')).toBe('backup');
    expect(() => writeNewFileSafely(file(), 'again')).toThrow(
      expect.objectContaining({ code: 'EEXIST' })
    );
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });
});
