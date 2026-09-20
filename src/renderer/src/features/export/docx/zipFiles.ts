/**
 * A zip archive, written the plain way Word's own files are: each file deflated, UTF-8
 * names, one central directory. Only what a .docx needs; the importer's `openZip` reads it.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deflate without a zlib wrapper, as zip keeps it; Chromium and Node both have it built in. */
async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Little-endian fields, written in order. */
function encodeFields(...values: [bytes: 2 | 4, value: number][]): number[] {
  return values.flatMap(([size, value]) =>
    Array.from({ length: size }, (_, i) => (value >>> (8 * i)) & 0xff)
  );
}

/** DOS time and date: every file is stamped 1980-01-01, so the same resume zips the same. */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

/** A zip holding these files, by path, in this order. */
export async function zipFiles(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const directory: number[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const packed = await deflateRaw(data);
    const nameBytes = [...encoder.encode(name)];
    const common: [2 | 4, number][] = [
      [2, 20], // version needed: 2.0, for deflate
      [2, 0x0800], // flags: the name is UTF-8
      [2, 8], // method: deflate
      [2, DOS_TIME],
      [2, DOS_DATE],
      [4, computeCrc32(data)],
      [4, packed.length],
      [4, data.length],
      [2, nameBytes.length],
      [2, 0], // extra field length
    ];
    const header = new Uint8Array([...encodeFields([4, 0x04034b50], ...common), ...nameBytes]);
    chunks.push(header, packed);
    directory.push(
      ...encodeFields(
        [4, 0x02014b50],
        [2, 20], // made by: 2.0
        ...common,
        [2, 0], // comment length
        [2, 0], // disk number
        [2, 0], // internal attributes
        [4, 0], // external attributes
        [4, offset]
      ),
      ...nameBytes
    );
    offset += header.length + packed.length;
  }
  const count = Object.keys(files).length;
  const end = encodeFields(
    [4, 0x06054b50],
    [2, 0],
    [2, 0],
    [2, count],
    [2, count],
    [4, directory.length],
    [4, offset],
    [2, 0] // comment length
  );
  const archive = new Uint8Array(offset + directory.length + end.length);
  let at = 0;
  for (const chunk of [...chunks, new Uint8Array(directory), new Uint8Array(end)]) {
    archive.set(chunk, at);
    at += chunk.length;
  }
  return archive;
}
