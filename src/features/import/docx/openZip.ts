import { MAX_FILE_BYTES } from '@/types/files';

/** A file that isn't a zip Mosaic can read: damaged, encrypted, or packed an unusual way. */
export class ZipError extends Error {}

/** A zip whose entries unpack to more than Mosaic will hold. */
export class ZipLimitError extends ZipError {}

const END_OF_DIRECTORY = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_END_OF_DIRECTORY = 0x06064b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
/** Where a Zip64 file keeps a size or offset too large for its 32-bit field. */
const ZIP64_EXTRA = 0x0001;
const STORED = 0;
const DEFLATED = 8;
const ENCRYPTED_FLAG = 0x1;
const END_OF_DIRECTORY_SIZE = 22;
const DIRECTORY_ENTRY_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;

interface Entry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  size: number;
  headerOffset: number;
}

export interface Zip {
  /** Every entry's name, as stored. */
  names: string[];
  /**
   * An entry's contents, or null when there is none by that name (matched ignoring case).
   * Throws a `ZipError` if the entry is damaged — its checksum is checked — and a
   * `ZipLimitError` if it unpacks past `limit`, or past what is left of the zip's budget.
   */
  read(name: string, limit?: number): Promise<Uint8Array | null>;
}

const CRC_TABLE = /* @__PURE__ */ (() =>
  Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }))();

/** The checksum a zip stores for each entry, to tell damaged contents from sound ones. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let at = 0; at < bytes.length; at++) crc = CRC_TABLE[(crc ^ bytes[at]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Little-endian reads that fail as a damaged zip rather than out of range. */
function reader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const check = (at: number, length: number) => {
    if (!(at >= 0) || at + length > bytes.length) throw new ZipError('The file is cut short.');
  };
  return {
    u16: (at: number) => (check(at, 2), view.getUint16(at, true)),
    u32: (at: number) => (check(at, 4), view.getUint32(at, true)),
    u64: (at: number) => (check(at, 8), Number(view.getBigUint64(at, true))),
    slice: (at: number, length: number) => (check(at, length), bytes.subarray(at, at + length)),
    /** Whether a four-byte signature sits at `at`, without failing off the end. */
    signed: (at: number, signature: number) =>
      at >= 0 && at + 4 <= bytes.length && view.getUint32(at, true) === signature,
  };
}

type Reader = ReturnType<typeof reader>;

/**
 * The zip's entries, from its end-of-central-directory record. A zip's comment may hold
 * something shaped like that record, so it is searched for from the end, and a candidate
 * counts only if the whole directory it describes reads: its comment reaches exactly the
 * end of the file, and its entries fill exactly the space before it — or before its Zip64
 * record — with nothing left over.
 */
function readDirectory(bytes: Uint8Array, read: Reader): Entry[] {
  const last = bytes.length - END_OF_DIRECTORY_SIZE;
  for (let at = last; at >= Math.max(0, last - 0xffff); at--) {
    if (!read.signed(at, END_OF_DIRECTORY)) continue;
    if (at + END_OF_DIRECTORY_SIZE + read.u16(at + 20) !== bytes.length) continue;
    const entries = directoryOf(read, at);
    if (entries) return entries;
  }
  throw new ZipError('The file isn’t a zip.');
}

/** The directory an end record describes, or null when it doesn't hold together. */
function directoryOf(read: Reader, end: number): Entry[] | null {
  let count = read.u16(end + 10);
  let size = read.u32(end + 12);
  let offset = read.u32(end + 16);
  let directoryEnd = end;
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    const locator = end - 20;
    if (!read.signed(locator, ZIP64_LOCATOR)) return null;
    const record = read.u64(locator + 8);
    if (!read.signed(record, ZIP64_END_OF_DIRECTORY) || record + 56 > locator) return null;
    count = read.u64(record + 32);
    size = read.u64(record + 40);
    offset = read.u64(record + 48);
    directoryEnd = record;
  }
  if (offset + size !== directoryEnd || count * DIRECTORY_ENTRY_SIZE > size) return null;

  const entries: Entry[] = [];
  let at = offset;
  for (let i = 0; i < count; i++) {
    if (at + DIRECTORY_ENTRY_SIZE > directoryEnd || !read.signed(at, DIRECTORY_ENTRY)) return null;
    const nameLength = read.u16(at + 28);
    const extraLength = read.u16(at + 30);
    const commentLength = read.u16(at + 32);
    const next = at + DIRECTORY_ENTRY_SIZE + nameLength + extraLength + commentLength;
    if (next > directoryEnd) return null;
    const entry: Entry = {
      name: new TextDecoder().decode(read.slice(at + DIRECTORY_ENTRY_SIZE, nameLength)),
      flags: read.u16(at + 8),
      method: read.u16(at + 10),
      crc: read.u32(at + 16),
      compressedSize: read.u32(at + 20),
      size: read.u32(at + 24),
      headerOffset: read.u32(at + 42),
    };
    // Zip64 puts the full value of each maxed-out field in an extra field, in this order.
    const extras = at + DIRECTORY_ENTRY_SIZE + nameLength;
    for (let extra = extras; extra + 4 <= extras + extraLength; ) {
      const id = read.u16(extra);
      const length = read.u16(extra + 2);
      if (id === ZIP64_EXTRA) {
        let value = extra + 4;
        for (const field of ['size', 'compressedSize', 'headerOffset'] as const) {
          if (entry[field] === 0xffffffff) {
            if (value + 8 > extra + 4 + length) return null;
            entry[field] = read.u64(value);
            value += 8;
          }
        }
      }
      extra += 4 + length;
    }
    entries.push(entry);
    at = next;
  }
  return at === directoryEnd ? entries : null;
}

/** Inflate raw deflate data, stopping once it grows past `limit` bytes. */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const chunks: Uint8Array[] = [];
  let total = 0;
  const streamReader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await streamReader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await streamReader.cancel();
        throw new ZipLimitError('The zip unpacks to more than it says.');
      }
      chunks.push(value);
    }
  } catch (error) {
    throw error instanceof ZipError ? error : new ZipError('The zip is damaged.');
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Open a zip — a Word file is one — to read its entries. Everything read from one zip
 * together may unpack to no more than `MAX_FILE_BYTES`, so a small file built to inflate
 * without end is stopped. Throws a `ZipError` when the file isn't a zip it can read.
 */
export function openZip(bytes: Uint8Array): Zip {
  const read = reader(bytes);
  const entries = readDirectory(bytes, read);
  const byName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]));
  let budget = MAX_FILE_BYTES;

  async function unpack(entry: Entry): Promise<Uint8Array> {
    const header = entry.headerOffset;
    if (!read.signed(header, LOCAL_HEADER)) throw new ZipError('The zip is damaged.');
    const start = header + LOCAL_HEADER_SIZE + read.u16(header + 26) + read.u16(header + 28);
    const data = read.slice(start, entry.compressedSize);

    let contents: Uint8Array;
    if (entry.method === STORED) {
      // Checked before copying: only the unpacked size was held to the limits.
      if (entry.compressedSize !== entry.size) throw new ZipError('The zip is damaged.');
      contents = data.slice();
    }
    // An entry that unpacks past the size it gives is stopped there, not at the budget.
    else if (entry.method === DEFLATED) contents = await inflate(data, entry.size);
    else throw new ZipError('The zip is packed a way Mosaic can’t unpack.');
    if (contents.length !== entry.size) throw new ZipError('The zip is damaged.');
    if (crc32(contents) !== entry.crc) throw new ZipError(`${entry.name} is damaged.`);
    return contents;
  }

  return {
    names: entries.map((entry) => entry.name),
    async read(name, limit = MAX_FILE_BYTES) {
      const entry = byName.get(name.toLowerCase());
      if (!entry) return null;
      if (entry.flags & ENCRYPTED_FLAG) throw new ZipError('The zip is encrypted.');
      if (entry.size > Math.min(limit, budget)) {
        throw new ZipLimitError(`${entry.name} unpacks to too much.`);
      }
      // Taken from the budget before unpacking, so reads at the same time can't spend it twice.
      budget -= entry.size;
      try {
        const contents = await unpack(entry);
        budget += entry.size - contents.length;
        return contents;
      } catch (error) {
        budget += entry.size;
        throw error;
      }
    },
  };
}
