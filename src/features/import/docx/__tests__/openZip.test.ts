import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES } from '@/types/files';
import { openZip, ZipError, ZipLimitError } from '../openZip';
import { zip } from './buildDocx';

/** The end-of-central-directory record's signature, as a comment may hold it. */
const SIGNATURE = [0x50, 0x4b, 0x05, 0x06];

const text = (bytes: Uint8Array | null) => (bytes ? new TextDecoder().decode(bytes) : null);

/** Where the central directory starts, from the end record. */
function directoryAt(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer);
  for (let at = bytes.length - 22; at >= 0; at--) {
    if (view.getUint32(at, true) === 0x06054b50) return view.getUint32(at + 16, true);
  }
  throw new Error('no end record');
}

describe('openZip', () => {
  it('reads stored and deflated entries', async () => {
    const files = { 'word/document.xml': '<doc>résumé</doc>', 'a.txt': 'x'.repeat(5000) };
    for (const deflate of [true, false]) {
      const archive = openZip(await zip(files, { deflate }));
      expect(archive.names).toEqual(['word/document.xml', 'a.txt']);
      expect(text(await archive.read('word/document.xml'))).toBe('<doc>résumé</doc>');
      expect(text(await archive.read('a.txt'))).toBe('x'.repeat(5000));
    }
  });

  it('reads a zip written by another program', async () => {
    // LibreOffice packed this one; see documents/README.md.
    const bytes = new Uint8Array(
      readFileSync(new URL('./documents/libreoffice-resume.docx', import.meta.url))
    );
    const archive = openZip(bytes);
    expect(archive.names).toContain('word/document.xml');
    expect(text(await archive.read('word/document.xml'))).toContain('Ada Lovelace');
  });

  it('matches names ignoring case, and gives null for a missing entry', async () => {
    const archive = openZip(await zip({ '[Content_Types].xml': '<Types/>' }));
    expect(text(await archive.read('[content_types].XML'))).toBe('<Types/>');
    expect(await archive.read('word/document.xml')).toBeNull();
  });

  it('reads a zip whose directory is described by a Zip64 record', async () => {
    const plain = await zip({ 'a.txt': 'hi', 'b.txt': 'there' });
    const directory = directoryAt(plain);
    const end = plain.length - 22;
    const bytes = new Uint8Array(end + 56 + 20 + 22);
    bytes.set(plain.subarray(0, end));
    const view = new DataView(bytes.buffer);
    // The Zip64 end record: where the directory is and how much of it there is.
    view.setUint32(end, 0x06064b50, true);
    view.setBigUint64(end + 4, 44n, true);
    view.setBigUint64(end + 24, 2n, true);
    view.setBigUint64(end + 32, 2n, true);
    view.setBigUint64(end + 40, BigInt(end - directory), true);
    view.setBigUint64(end + 48, BigInt(directory), true);
    // Its locator, then a plain end record whose fields all say to look there.
    view.setUint32(end + 56, 0x07064b50, true);
    view.setBigUint64(end + 64, BigInt(end), true);
    view.setUint32(end + 72, 1, true);
    view.setUint32(end + 76, 0x06054b50, true);
    bytes.fill(0xff, end + 84, end + 96);
    const archive = openZip(bytes);
    expect(archive.names).toEqual(['a.txt', 'b.txt']);
    expect(text(await archive.read('b.txt'))).toBe('there');
  });

  it('finds its directory past a comment at the end', async () => {
    const archive = openZip(await zip({ 'a.txt': 'hi' }, { comment: 'made by a tool' }));
    expect(text(await archive.read('a.txt'))).toBe('hi');
  });

  describe('is not fooled by a comment that holds an end-of-directory record', () => {
    const decoys = {
      'one too long to be the record': new Array(30).fill(0),
      // A whole record, claiming the zip holds nothing at all.
      'one claiming an empty zip': new Array(18).fill(0),
    };
    for (const [what, tail] of Object.entries(decoys)) {
      it(what, async () => {
        const archive = openZip(await zip({ 'a.txt': 'hi' }, { comment: [...SIGNATURE, ...tail] }));
        expect(archive.names).toEqual(['a.txt']);
        expect(text(await archive.read('a.txt'))).toBe('hi');
      });
    }

    it('one that says its directory is in a Zip64 record', async () => {
      const tail = [0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff, ...new Array(8).fill(0xff), 0, 0];
      const archive = openZip(await zip({ 'a.txt': 'hi' }, { comment: [...SIGNATURE, ...tail] }));
      expect(archive.names).toEqual(['a.txt']);
    });

    it('one that points at only part of the real directory', async () => {
      const files = { 'a.txt': 'hi', 'b.txt': 'there' };
      const plain = await zip(files);
      const directory = directoryAt(plain);
      const first = 46 + 'a.txt'.length;
      const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, n >>> 24];
      const tail = [0, 0, 0, 0, 1, 0, 1, 0, ...u32(first), ...u32(directory), 0, 0];
      const archive = openZip(await zip(files, { comment: [...SIGNATURE, ...tail] }));
      expect(archive.names).toEqual(['a.txt', 'b.txt']);
    });

    it('and still reads a zip that really is empty', async () => {
      expect(openZip(await zip({})).names).toEqual([]);
    });
  });

  it('refuses a file that is not a zip, or is cut short', async () => {
    expect(() => openZip(new TextEncoder().encode('not a zip at all, just text'))).toThrow(
      ZipError
    );
    expect(() => openZip(new Uint8Array())).toThrow(ZipError);
    const whole = await zip({ 'a.txt': 'hello' });
    expect(() => openZip(whole.slice(0, whole.length - 30))).toThrow(ZipError);
  });

  it('refuses encrypted entries', async () => {
    const bytes = await zip({ 'a.txt': 'secret' });
    const view = new DataView(bytes.buffer);
    const entry = directoryAt(bytes);
    view.setUint16(entry + 8, view.getUint16(entry + 8, true) | 1, true);
    await expect(openZip(bytes).read('a.txt')).rejects.toThrow(ZipError);
  });

  describe('checks each entry against its checksum', () => {
    it('for a stored entry whose length did not change', async () => {
      const bytes = await zip({ 'a.txt': 'hello there, the original text' }, { deflate: false });
      const at = bytes.indexOf('hello'.charCodeAt(0));
      bytes[at] = 'H'.charCodeAt(0);
      await expect(openZip(bytes).read('a.txt')).rejects.toThrow(ZipError);
    });

    it('for a deflated entry whose checksum was written wrong', async () => {
      const bytes = await zip({ 'a.txt': 'hello there, the original text' });
      new DataView(bytes.buffer).setUint32(directoryAt(bytes) + 16, 0x12345678, true);
      await expect(openZip(bytes).read('a.txt')).rejects.toThrow(ZipError);
    });

    it('and passes sound contents through', async () => {
      const archive = openZip(await zip({ 'a.txt': 'hello there, the original text' }));
      expect(text(await archive.read('a.txt'))).toBe('hello there, the original text');
    });
  });

  describe('stops an entry that unpacks to too much', () => {
    it('past what the entry itself says', async () => {
      const bytes = await zip({ 'bomb.xml': '0'.repeat(100_000) });
      new DataView(bytes.buffer).setUint32(directoryAt(bytes) + 24, 1000, true);
      await expect(openZip(bytes).read('bomb.xml')).rejects.toThrow(ZipLimitError);
    });

    it('past what a file may hold, before unpacking any of it', async () => {
      const bytes = await zip({ 'big.xml': 'small' });
      new DataView(bytes.buffer).setUint32(directoryAt(bytes) + 24, MAX_FILE_BYTES + 1, true);
      await expect(openZip(bytes).read('big.xml')).rejects.toThrow(ZipLimitError);
    });

    it('stored, with more data than the size it gives', async () => {
      const bytes = await zip({ 'a.txt': 'x'.repeat(5000) }, { deflate: false });
      new DataView(bytes.buffer).setUint32(directoryAt(bytes) + 24, 1, true);
      const copying = vi.spyOn(Uint8Array.prototype, 'slice');
      await expect(openZip(bytes).read('a.txt', 10)).rejects.toThrow(ZipError);
      expect(copying).not.toHaveBeenCalled();
      copying.mockRestore();
    });

    it('past the limit the caller asks for', async () => {
      const archive = openZip(await zip({ 'a.txt': 'x'.repeat(5000) }));
      await expect(archive.read('a.txt', 1000)).rejects.toThrow(ZipLimitError);
      expect(text(await archive.read('a.txt', 5000))).toBe('x'.repeat(5000));
    });
  });

  it('refuses damaged compressed data', async () => {
    const bytes = await zip({ 'a.txt': 'some text to deflate, some text to deflate' });
    bytes.fill(0xff, 30 + 'a.txt'.length, 30 + 'a.txt'.length + 6);
    await expect(openZip(bytes).read('a.txt')).rejects.toThrow(ZipError);
  });
});
