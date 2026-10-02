import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

/*
 * Writing straight to a file truncates it first, so a write that fails partway leaves
 * neither the old file nor the new one. These write a flushed sibling first and only then
 * put it in place.
 */

function temporarySibling(filePath: string): string {
  return path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
}

/** A whole file, or its pieces in order, so a large one is never held as one string. */
export type FileContent = string | Uint8Array | Iterable<string>;

/**
 * A stream, because a write may take only some of the bytes it is given: the stream writes
 * the rest, and fails if the disk stops taking any.
 */
async function writeFlushed(filePath: string, content: FileContent): Promise<void> {
  const pieces = typeof content === 'string' || content instanceof Uint8Array ? [content] : content;
  await pipeline(pieces, fs.createWriteStream(filePath, { flags: 'wx', flush: true }));
}

/** Replaces `filePath` with `content`, or leaves it as it was. */
export async function replaceFileSafely(filePath: string, content: FileContent): Promise<void> {
  const temporary = temporarySibling(filePath);
  try {
    await writeFlushed(temporary, content);
    await fsp.rename(temporary, filePath);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

/** Writes a new file at `filePath`; fails with `EEXIST`, touching nothing, if one is there. */
export async function writeNewFileSafely(filePath: string, content: FileContent): Promise<void> {
  const temporary = temporarySibling(filePath);
  try {
    await writeFlushed(temporary, content);
    await publishWithoutReplacing(temporary, filePath);
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

/**
 * A hard link claims the name only if it is free. Where the filesystem can't link (FAT on a
 * USB stick, some network shares) it checks first instead, which leaves a small race.
 */
async function publishWithoutReplacing(temporary: string, filePath: string): Promise<void> {
  try {
    await fsp.link(temporary, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (!['EPERM', 'ENOTSUP', 'ENOSYS', 'EXDEV'].includes(code)) throw error;
    if (fs.existsSync(filePath)) {
      throw Object.assign(new Error(`${filePath} already exists`), { code: 'EEXIST' });
    }
    await fsp.rename(temporary, filePath);
  }
}
