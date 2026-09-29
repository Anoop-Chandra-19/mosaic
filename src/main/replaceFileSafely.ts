import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
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

const isWhole = (content: FileContent): content is string | Uint8Array =>
  typeof content === 'string' || content instanceof Uint8Array;

/** Replaces `filePath` with `content`, or leaves it as it was. */
export async function replaceFileSafely(filePath: string, content: FileContent): Promise<void> {
  const temporary = temporarySibling(filePath);
  try {
    const handle = await fsp.open(temporary, 'wx');
    try {
      if (isWhole(content)) await handle.writeFile(content);
      else for (const piece of content) await handle.write(piece);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rename(temporary, filePath);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

/** Writes a new file at `filePath`; fails with `EEXIST`, touching nothing, if one is there. */
export function writeNewFileSafely(filePath: string, content: FileContent): void {
  const temporary = temporarySibling(filePath);
  try {
    const fd = fs.openSync(temporary, 'wx');
    try {
      if (isWhole(content)) fs.writeFileSync(fd, content);
      else for (const piece of content) fs.writeSync(fd, piece);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    publishWithoutReplacing(temporary, filePath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

/**
 * A hard link claims the name only if it is free. Where the filesystem can't link (FAT on a
 * USB stick, some network shares) it checks first instead, which leaves a small race.
 */
function publishWithoutReplacing(temporary: string, filePath: string): void {
  try {
    fs.linkSync(temporary, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (!['EPERM', 'ENOTSUP', 'ENOSYS', 'EXDEV'].includes(code)) throw error;
    if (fs.existsSync(filePath)) {
      throw Object.assign(new Error(`${filePath} already exists`), { code: 'EEXIST' });
    }
    fs.renameSync(temporary, filePath);
  }
}
