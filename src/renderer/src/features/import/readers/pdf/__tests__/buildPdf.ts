/**
 * PDFs written out by hand, for what react-pdf won't make: a page with no text, a file
 * locked with a password, more pages than Mosaic reads.
 */

export interface PdfOptions {
  /** Each page's drawing instructions. A line is drawn when none are given. */
  pages?: string[];
  /**
   * Lock the file. Only the lock's description is written — the checks against it fail,
   * so a reader has to ask for the password, which is all a test needs.
   */
  locked?: boolean;
}

const LETTER = '[0 0 612 792]';

export function buildPdf({ pages = ['72 72 m 540 720 l S'], locked = false }: PdfOptions = {}) {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);

  const pageIds = pages.map((_, i) => 3 + i * 2);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );
  pages.forEach((content, i) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox ${LETTER} /Contents ${pageIds[i] + 1} 0 R >>`);
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const hex = (byte: string) => `<${byte.repeat(32)}>`;
  if (locked) add(`<< /Filter /Standard /V 1 /R 2 /O ${hex('4f')} /U ${hex('55')} /P -4 >>`);

  let text = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = text.length;
    text += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  const lock = locked ? ` /Encrypt ${objects.length} 0 R /ID [${hex('ab')} ${hex('ab')}]` : '';
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${lock} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(text);
}
