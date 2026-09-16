/**
 * Zips and Word files built in memory for tests, so no binary fixture is committed. The
 * zips are real — CRCs and all — and the Word files have the parts Word itself writes
 * for a document like it.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Little-endian fields, written in order. */
function fields(...values: [bytes: 2 | 4, value: number][]): number[] {
  return values.flatMap(([size, value]) =>
    Array.from({ length: size }, (_, i) => (value >>> (8 * i)) & 0xff)
  );
}

export interface ZipOptions {
  /** Deflate each entry (the default), or store it as it is. */
  deflate?: boolean;
  /** A comment after the directory, as some tools write: text, or bytes as they are. */
  comment?: string | number[];
}

/** A zip holding these files. */
export async function zip(
  files: Record<string, string | Uint8Array>,
  { deflate = true, comment = '' }: ZipOptions = {}
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const directory: number[] = [];
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const packed = deflate ? await deflateRaw(data) : data;
    const nameBytes = [...encoder.encode(name)];
    const common: [2 | 4, number][] = [
      [2, 20], // version needed
      [2, 0x0800], // flags: UTF-8 names
      [2, deflate ? 8 : 0],
      [2, 0], // time
      [2, 0x21], // date: 1980-01-01
      [4, crc32(data)],
      [4, packed.length],
      [4, data.length],
      [2, nameBytes.length],
      [2, 0], // extra field length
    ];
    const offset = local.length;
    local.push(...fields([4, 0x04034b50], ...common), ...nameBytes, ...packed);
    directory.push(
      ...fields([4, 0x02014b50], [2, 20], ...common, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]),
      ...nameBytes
    );
  }
  const commentBytes = typeof comment === 'string' ? [...encoder.encode(comment)] : comment;
  const count = Object.keys(files).length;
  const end = fields(
    [4, 0x06054b50],
    [2, 0],
    [2, 0],
    [2, count],
    [2, count],
    [4, directory.length],
    [4, local.length],
    [2, commentBytes.length]
  );
  return new Uint8Array([...local, ...directory, ...end, ...commentBytes]);
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Styles like Word's: Normal at 11pt, headings with outline levels, a bullet list style. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
  <w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Dated"><w:name w:val="Dated"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs></w:pPr></w:style>
  <w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/><w:rPr><w:b/></w:rPr></w:style>
</w:styles>`;

/** List 1 shows bullets; list 2 numbers; list 3 is indented with no marker at all. */
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}">
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="●"/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="none"/><w:lvlText w:val=""/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;

export interface RunOptions {
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  hidden?: boolean;
  /** In half-points. */
  size?: number;
  /** A character style. */
  style?: string;
}

function runProps({ bold, italic, caps, hidden, size, style }: RunOptions): string {
  const props = [
    style && `<w:rStyle w:val="${style}"/>`,
    bold && '<w:b/><w:bCs/>',
    italic && '<w:i/>',
    caps && '<w:caps/>',
    hidden && '<w:vanish/>',
    size && `<w:sz w:val="${size}"/>`,
  ]
    .filter(Boolean)
    .join('');
  return props ? `<w:rPr>${props}</w:rPr>` : '';
}

/** A run of text: "\t" becomes a tab and "\n" a line break, as Word writes them. */
export function run(text: string, options: RunOptions = {}): string {
  const content = text
    .split(/([\t\n])/)
    .filter(Boolean)
    .map((part) =>
      part === '\t'
        ? '<w:tab/>'
        : part === '\n'
          ? '<w:br/>'
          : `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`
    )
    .join('');
  return `<w:r>${runProps(options)}${content}</w:r>`;
}

export interface ParaOptions extends RunOptions {
  /** A paragraph style. */
  paragraphStyle?: string;
  /** A list item in this list (see NUMBERING). */
  list?: number;
  /** A right-aligned tab stop at the right margin. */
  rightTab?: boolean;
  /** Space above the paragraph, in twips. */
  spaceBefore?: number;
  /** The section this paragraph ends, as Word keeps it: its settings, as XML. */
  section?: string;
}

/** A paragraph of one run — or of the given runs' XML, when `text` is an array. */
export function para(text: string | string[], options: ParaOptions = {}): string {
  const { paragraphStyle, list, rightTab, spaceBefore, section, ...runOptions } = options;
  const pPr = [
    paragraphStyle && `<w:pStyle w:val="${paragraphStyle}"/>`,
    list && `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${list}"/></w:numPr>`,
    rightTab && '<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>',
    spaceBefore !== undefined && `<w:spacing w:before="${spaceBefore}"/>`,
    section && `<w:sectPr>${section}</w:sectPr>`,
  ]
    .filter(Boolean)
    .join('');
  const runs = Array.isArray(text) ? text.join('') : text ? run(text, runOptions) : '';
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
}

/** A hyperlink to `url` around these words; `id` is its relationship, listed in `links`. */
export const hyperlink = (id: string, words: string) =>
  `<w:hyperlink r:id="${id}">${run(words, { style: 'Hyperlink' })}</w:hyperlink>`;

/** A hyperlink written as a field, the way older documents keep one. */
export const hyperlinkField = (url: string, words: string) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
  `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${escapeXml(url)}" </w:instrText></w:r>` +
  `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(words)}` +
  `<w:r><w:fldChar w:fldCharType="end"/></w:r>`;

/** Text a tracked change added, and text one took out. */
export const inserted = (text: string) => `<w:ins>${run(text)}</w:ins>`;
export const deleted = (text: string) =>
  `<w:del><w:r><w:delText xml:space="preserve">${escapeXml(text)}</w:delText></w:r></w:del>`;

/** A picture: a drawing with no text in it. */
export const picture = () =>
  '<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"/></w:drawing></w:r>';

/**
 * A floating text box holding these paragraphs, written as Word writes one: a choice for
 * readers that know drawings, and a fallback that repeats the same text for those that
 * don't.
 */
export const textBox = (paragraphs: string) => {
  const box = `<w:txbxContent>${paragraphs}</w:txbxContent>`;
  return (
    `<w:r><mc:AlternateContent xmlns:mc="${MC_NS}">` +
    `<mc:Choice Requires="wps"><w:drawing><wps:txbx xmlns:wps="urn:wps">${box}</wps:txbx></w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict><v:shape xmlns:v="urn:v"><v:textbox>${box}</v:textbox></v:shape></w:pict></mc:Fallback>` +
    `</mc:AlternateContent></w:r>`
  );
};

export interface CellOptions {
  /** How many grid columns the cell covers. */
  span?: number;
  /** It continues a cell merged from the row above. */
  merged?: boolean;
}

/** A table cell: the XML of its paragraphs, and how it sits in the grid. */
export const cell = (content: string, { span, merged }: CellOptions = {}) => {
  const props = [span && `<w:gridSpan w:val="${span}"/>`, merged && '<w:vMerge w:val="continue"/>']
    .filter(Boolean)
    .join('');
  return `<w:tc>${props ? `<w:tcPr>${props}</w:tcPr>` : ''}${content}</w:tc>`;
};

/** A table: each row a list of cells, each cell the XML of its paragraphs (or a `cell`). */
export const table = (rows: string[][]) =>
  `<w:tbl><w:tblPr/>${rows
    .map(
      (cells) => `<w:tr>${cells.map((c) => (c.startsWith('<w:tc') ? c : cell(c))).join('')}</w:tr>`
    )
    .join('')}</w:tbl>`;

export interface DocxOptions {
  /** The first page's header, as the XML of its paragraphs. */
  header?: string;
  /** The header for first pages, used when a section asks for one of its own. */
  firstHeader?: string;
  /** The first page's footer. */
  footer?: string;
  /** Hyperlink relationships: id → address. */
  links?: Record<string, string>;
  /** Leave out the styles and numbering parts, as a minimal file from another tool might. */
  bare?: boolean;
  /** Parts added as they are, by path. */
  extra?: Record<string, string>;
  /** The last section's settings, as XML; by default its header reference. */
  section?: string;
  /** More style definitions, added to the usual ones. */
  styles?: string;
  /** More lists (`abstractNum` and `num`), added to the usual ones. */
  numbering?: string;
}

/** A Word document whose body is this XML. */
export function docx(
  body: string,
  {
    header,
    firstHeader,
    footer,
    links = {},
    bare = false,
    extra = {},
    section,
    styles = '',
    numbering = '',
  }: DocxOptions = {}
): Promise<Uint8Array> {
  const relationships = [
    ...(bare
      ? []
      : [
          ['rStyles', `${REL_TYPE}/styles`, 'styles.xml'],
          ['rNumbering', `${REL_TYPE}/numbering`, 'numbering.xml'],
        ]),
    ...(header ? [['rHeader', `${REL_TYPE}/header`, 'header1.xml']] : []),
    ...(firstHeader ? [['rFirstHeader', `${REL_TYPE}/header`, 'header2.xml']] : []),
    ...(footer ? [['rFooter', `${REL_TYPE}/footer`, 'footer1.xml']] : []),
    ...Object.entries(links).map(([id, url]) => [id, `${REL_TYPE}/hyperlink`, url, 'External']),
  ]
    .map(
      ([id, type, target, mode]) =>
        `<Relationship Id="${id}" Type="${type}" Target="${escapeXml(target)}"${
          mode ? ` TargetMode="${mode}"` : ''
        }/>`
    )
    .join('');
  const settings =
    section ??
    [
      header && '<w:headerReference w:type="default" r:id="rHeader"/>',
      firstHeader && '<w:headerReference w:type="first" r:id="rFirstHeader"/>',
      firstHeader && '<w:titlePg/>',
      footer && '<w:footerReference w:type="default" r:id="rFooter"/>',
    ]
      .filter(Boolean)
      .join('');
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${body}<w:sectPr>${settings}</w:sectPr></w:body></w:document>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    ...extra,
  };
  if (!bare) {
    files['word/styles.xml'] = STYLES.replace('</w:styles>', `${styles}</w:styles>`);
    files['word/numbering.xml'] = NUMBERING.replace('</w:numbering>', `${numbering}</w:numbering>`);
  }
  const wrap = (tag: string, content: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${W_NS}" xmlns:r="${R_NS}">${content}</w:${tag}>`;
  if (header) files['word/header1.xml'] = wrap('hdr', header);
  if (firstHeader) files['word/header2.xml'] = wrap('hdr', firstHeader);
  if (footer) files['word/footer1.xml'] = wrap('ftr', footer);
  return zip(files);
}
