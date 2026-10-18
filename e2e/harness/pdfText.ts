import zlib from 'node:zlib';

/**
 * Extracts the visible text of a PDF written by react-pdf, enough to assert on content
 * without a PDF library. react-pdf draws each line as a TJ array of hex strings inside
 * Flate-compressed content streams: `[<59> 100 <6f7572204e> 0 <616d65>] TJ` is "Your Name".
 */
export function extractPdfText(pdf: Buffer): string {
  const lines: string[] = [];
  for (const [, body] of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = zlib.inflateSync(Buffer.from(body, 'latin1')).toString('latin1');
    } catch {
      content = body;
    }
    for (const [, run] of content.matchAll(/\[(.*?)\]\s*TJ/g)) {
      const pieces = [...run.matchAll(/<([0-9a-fA-F]*)>/g)];
      lines.push(pieces.map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1')).join(''));
    }
  }
  return lines.join('\n');
}
