/**
 * PDFs written out by hand, for what react-pdf won't make: a page with no text, a file
 * locked with a password, more pages than Mosaic reads, an underline drawn the way Word
 * draws one.
 */

/** A link area on a page, in PDF space: `[left, bottom, right, top]`. */
export interface PdfLinkArea {
  rect: [number, number, number, number];
  url: string;
}

export interface PdfOptions {
  /** Each page's drawing instructions. A line is drawn when none are given. */
  pages?: string[];
  /**
   * Lock the file. Only the lock's description is written — the checks against it fail,
   * so a reader has to ask for the password, which is all a test needs.
   */
  locked?: boolean;
  /** Give every page Helvetica as `/F1`, so its instructions can set text. */
  hasFont?: boolean;
  /** Each page's links, by page. */
  links?: PdfLinkArea[][];
}

const LETTER = '[0 0 612 792]';

export function buildPdf({
  pages = ['72 72 m 540 720 l S'],
  locked = false,
  hasFont = false,
  links = [],
}: PdfOptions = {}) {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const pageIds = pages.map((_, i) => 3 + i * 2);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );
  // Pages and their contents come first, so their ids are known before the rest is added.
  const extras: string[] = [];
  const extraId = (body: string) => {
    extras.push(body);
    return 3 + pages.length * 2 + extras.length - 1;
  };
  const fontId = hasFont ? extraId('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>') : 0;
  pages.forEach((content, i) => {
    const annots = (links[i] ?? []).map((link) =>
      extraId(
        `<< /Type /Annot /Subtype /Link /Rect [${link.rect.join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${link.url}) >> >>`
      )
    );
    const resources = hasFont ? ` /Resources << /Font << /F1 ${fontId} 0 R >> >>` : '';
    const annotations = annots.length
      ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(' ')}]`
      : '';
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox ${LETTER}${resources}${annotations} /Contents ${pageIds[i] + 1} 0 R >>`
    );
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  extras.forEach(add);
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
