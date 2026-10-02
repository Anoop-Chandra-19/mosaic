import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceFileSafely, writeNewFileSafely } from '../replaceFileSafely';

let folder: string;
const file = () => path.join(folder, 'mosaic-backup.json');
const failWith = (code: string) => Object.assign(new Error(code), { code });

/** Pieces with characters several bytes long, so a short write can stop inside one. */
const PIECES = ['{"name":"Zoë Ångström",', '"note":"✓ résumé — 日本語",', '"end":true}'];

type WriteCallback = (error: Error | null, bytesWritten?: number, data?: unknown) => void;

/**
 * Each write takes at most `limit` bytes, as a disk may, and after `failAfter` writes the
 * disk is full. Returns how many writes there were.
 */
function limitWrites({ limit, failAfter = Infinity }: { limit: number; failAfter?: number }) {
  const write = fs.write.bind(fs) as (...args: unknown[]) => void;
  let writes = 0;
  const writeSome = (fd: number, bytes: Buffer, position: unknown, done: WriteCallback) => {
    if (writes++ >= failAfter) return done(failWith('ENOSPC'));
    write(fd, bytes, 0, Math.min(limit, bytes.length), position, done);
  };
  vi.spyOn(fs, 'write').mockImplementation(((
    fd: number,
    data: Buffer,
    offset: number,
    length: number,
    position: unknown,
    done: WriteCallback
  ) => writeSome(fd, data.subarray(offset, offset + length), position, done)) as never);
  vi.spyOn(fs, 'writev').mockImplementation(((
    fd: number,
    buffers: Buffer[],
    position: unknown,
    done: WriteCallback
  ) =>
    writeSome(fd, buffers[0], position, (error, bytesWritten) =>
      done(error, bytesWritten, buffers)
    )) as never);
  return () => writes;
}

const TOTAL_BYTES = Buffer.byteLength(PIECES.join(''));

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

  it('writes every byte when the disk takes only a few at a time', async () => {
    fs.writeFileSync(file(), 'old backup');
    const countWrites = limitWrites({ limit: 4 });
    await replaceFileSafely(file(), PIECES);
    expect(fs.readFileSync(file(), 'utf8')).toBe(PIECES.join(''));
    expect(countWrites()).toBe(Math.ceil(TOTAL_BYTES / 4));
  });

  it('keeps the old file whole when the write fails partway', async () => {
    fs.writeFileSync(file(), 'old backup');
    limitWrites({ limit: 4, failAfter: 2 });

    await expect(replaceFileSafely(file(), PIECES)).rejects.toThrow('ENOSPC');
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
  it('writes a new file', async () => {
    await writeNewFileSafely(file(), 'backup');
    expect(fs.readFileSync(file(), 'utf8')).toBe('backup');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('writes every byte when the disk takes only a few at a time', async () => {
    const countWrites = limitWrites({ limit: 4 });
    await writeNewFileSafely(file(), PIECES);
    expect(fs.readFileSync(file(), 'utf8')).toBe(PIECES.join(''));
    expect(countWrites()).toBeGreaterThanOrEqual(Math.ceil(TOTAL_BYTES / 4));
  });

  it('fails, publishing nothing, when the disk takes no bytes at all', async () => {
    limitWrites({ limit: 0 });
    await expect(writeNewFileSafely(file(), PIECES)).rejects.toThrow();
    expect(fs.readdirSync(folder)).toEqual([]);
  });

  it('refuses a name already taken, leaving that file alone', async () => {
    fs.writeFileSync(file(), 'yesterday');
    await expect(writeNewFileSafely(file(), 'today')).rejects.toMatchObject({ code: 'EEXIST' });
    expect(fs.readFileSync(file(), 'utf8')).toBe('yesterday');
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });

  it('never publishes a file it could not flush', async () => {
    vi.spyOn(fs, 'fsync').mockImplementation(((_fd: number, callback: (error: Error) => void) =>
      callback(failWith('ENOSPC'))) as unknown as typeof fs.fsync);
    await expect(writeNewFileSafely(file(), 'backup')).rejects.toThrow('ENOSPC');
    expect(fs.readdirSync(folder)).toEqual([]);
  });

  it('works where the filesystem cannot link, still refusing a taken name', async () => {
    vi.spyOn(fsp, 'link').mockRejectedValue(failWith('EPERM'));
    await writeNewFileSafely(file(), 'backup');
    expect(fs.readFileSync(file(), 'utf8')).toBe('backup');
    await expect(writeNewFileSafely(file(), 'again')).rejects.toMatchObject({ code: 'EEXIST' });
    expect(fs.readdirSync(folder)).toEqual(['mosaic-backup.json']);
  });
});
