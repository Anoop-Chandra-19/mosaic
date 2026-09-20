import { HEADLESS_LAYOUT, PAPER_SIZE_PT } from '@/lib/resume/headlessLayout';
import { LINK_BLUE } from '@shared/resume/resumeHeader';
import type { PaperSize } from '@/types/paper';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import { zipFiles } from './zipFiles';

/*
 * The resume as a Word file, in the "Headless Headhunter" format the PDF prints: the same
 * margins, sizes, and 1.5-line body grid, which were measured off that format's own Word
 * template (`headlessLayout.ts`). Everything is set through named paragraph styles (Title,
 * Heading 1, List Bullet, and two of Mosaic's own) so the file stays easy to edit in Word,
 * and header links are real Word hyperlinks.
 */

const LYT = HEADLESS_LAYOUT;

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Points as twips, Word's twentieths of a point. */
const toTwips = (points: number) => Math.round(points * 20);
/** Points as half-points, which Word sizes text in. */
const toHalfPoints = (points: number) => Math.round(points * 2);

/**
 * Word's line spacing in 240ths of a single line. The body is "1.5 lines" (18pt at
 * 10.5pt); the name is single-spaced and the contact lines "1.15 lines", as the template
 * sets them.
 */
const LINE_SINGLE = 240;
const LINE_ONE_AND_HALF = 360;
const LINE_HEADER = 276;

/** Characters XML 1.0 can't hold at all; they can't be typed into a resume either. */
// eslint-disable-next-line no-control-regex
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function escapeXml(text: string): string {
  return text
    .replace(NOT_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A run of text: a tab stays a tab and a line break a break, as Word writes them. */
function writeRun(text: string, props = ''): string {
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
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${content}</w:r>`;
}

function writeParagraph(style: string, content: string, extraProps = ''): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extraProps}</w:pPr>${content}</w:p>`;
}

/** The styles every paragraph is set through. */
function writeStyles(data: NormalizedResumeExport, rightTabTwips: number): string {
  const linkColor = data.contact.linkColor === 'blue' ? LINK_BLUE.slice(1) : '000000';
  const linkUnderline = data.contact.linkStyle === 'underline' ? 'single' : 'none';
  const font = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>';
  const spacing = (before: number, after: number, line: number) =>
    `<w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>`;
  return `${XML_DECLARATION}<w:styles xmlns:w="${W_NS}">
<w:docDefaults>
<w:rPrDefault><w:rPr>${font}<w:color w:val="000000"/><w:sz w:val="${toHalfPoints(LYT.bodyFontSize)}"/><w:szCs w:val="${toHalfPoints(LYT.bodyFontSize)}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr>${spacing(0, 0, LINE_ONE_AND_HALF)}</w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Contact"/><w:qFormat/>
<w:pPr><w:keepNext/>${spacing(toTwips(LYT.nameMarginTop), toTwips(LYT.nameMarginBottom), LINE_SINGLE)}<w:jc w:val="center"/></w:pPr>
<w:rPr><w:b/><w:bCs/><w:sz w:val="${toHalfPoints(LYT.nameFontSize)}"/><w:szCs w:val="${toHalfPoints(LYT.nameFontSize)}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Contact"><w:name w:val="Contact"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr>${spacing(0, 0, LINE_HEADER)}<w:jc w:val="center"/></w:pPr>
<w:rPr><w:sz w:val="${toHalfPoints(LYT.contactFontSize)}"/><w:szCs w:val="${toHalfPoints(LYT.contactFontSize)}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/>${spacing(toTwips(LYT.bodyLeading), 0, LINE_ONE_AND_HALF)}<w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:bCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:customStyle="1" w:styleId="EntryHeading"><w:name w:val="Entry Heading"/><w:basedOn w:val="Normal"/><w:next w:val="ListBullet"/><w:qFormat/>
<w:pPr><w:keepNext/><w:tabs><w:tab w:val="right" w:pos="${rightTabTwips}"/></w:tabs></w:pPr>
<w:rPr><w:i/><w:iCs/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:numPr><w:numId w:val="1"/></w:numPr><w:ind w:left="${toTwips(LYT.bulletTextIndent)}" w:hanging="${toTwips(LYT.bulletTextIndent - LYT.bulletMarkerIndent)}"/></w:pPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${linkColor}"/><w:u w:val="${linkUnderline}"/></w:rPr></w:style>
</w:styles>`;
}

/** One bulleted list, its marker where the PDF draws it: 18pt in, the text at 36pt. */
const NUMBERING = `${XML_DECLARATION}<w:numbering xmlns:w="${W_NS}">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="${toTwips(LYT.bulletTextIndent)}" w:hanging="${toTwips(LYT.bulletTextIndent - LYT.bulletMarkerIndent)}"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

interface DocxBody {
  xml: string;
  /** Each hyperlink's relationship id and address. */
  links: [id: string, href: string][];
}

function writeBody(data: NormalizedResumeExport): DocxBody {
  const links: [string, string][] = [];
  const paragraphs: string[] = [];

  // The PDF prints a placeholder when the name is empty, so the Word file does too.
  paragraphs.push(writeParagraph('Title', writeRun(data.contact.name || 'Mosaic Resume')));
  for (const line of data.contact.lines) {
    const runs = line.items.map((item, index) => {
      const separator = index > 0 ? writeRun(line.separator) : '';
      if (!item.href) return separator + writeRun(item.text);
      const id = `rIdLink${links.length + 1}`;
      links.push([id, item.href]);
      const run = writeRun(item.text, '<w:rStyle w:val="Hyperlink"/>');
      return `${separator}<w:hyperlink r:id="${id}" w:history="1">${run}</w:hyperlink>`;
    });
    const align = line.align === 'left' ? '<w:jc w:val="left"/>' : '';
    paragraphs.push(writeParagraph('Contact', runs.join(''), align));
  }

  for (const section of data.sections) {
    paragraphs.push(writeParagraph('Heading1', writeRun(section.label)));
    for (const entry of section.entries) {
      if (section.layout === 'lines') {
        paragraphs.push(writeParagraph('Normal', writeRun(entry.text)));
        continue;
      }
      if (entry.heading || entry.dates) {
        const text = entry.dates ? `${entry.heading}\t${entry.dates}` : entry.heading;
        // Only a heading with bullets under it has the small gap the PDF leaves there.
        const gap =
          entry.bullets.length > 0
            ? `<w:spacing w:after="${toTwips(LYT.entryHeadingMarginBottom)}"/>`
            : '';
        paragraphs.push(writeParagraph('EntryHeading', writeRun(text), gap));
      }
      for (const bullet of entry.bullets) {
        paragraphs.push(writeParagraph('ListBullet', writeRun(bullet)));
      }
    }
  }
  return { xml: paragraphs.join(''), links };
}

/** A .docx of the resume, on this paper. */
export async function createDocxExport(
  data: NormalizedResumeExport,
  paperSize: PaperSize
): Promise<Uint8Array> {
  const paper = PAPER_SIZE_PT[paperSize];
  const rightTabTwips = toTwips(paper.width - LYT.marginSide * 2);
  const body = writeBody(data);
  const pageSettings =
    `<w:pgSz w:w="${toTwips(paper.width)}" w:h="${toTwips(paper.height)}"/>` +
    `<w:pgMar w:top="${toTwips(LYT.marginTop)}" w:right="${toTwips(LYT.marginSide)}" ` +
    `w:bottom="${toTwips(LYT.marginBottom)}" w:left="${toTwips(LYT.marginSide)}" ` +
    `w:header="720" w:footer="720" w:gutter="0"/>`;
  const documentXml =
    `${XML_DECLARATION}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>` +
    `${body.xml}<w:sectPr>${pageSettings}</w:sectPr></w:body></w:document>`;

  const relationship = (id: string, type: string, target: string, external = false) =>
    `<Relationship Id="${id}" Type="${REL_TYPE}/${type}" Target="${escapeXml(target)}"${
      external ? ' TargetMode="External"' : ''
    }/>`;
  const documentRels = [
    relationship('rIdStyles', 'styles', 'styles.xml'),
    relationship('rIdNumbering', 'numbering', 'numbering.xml'),
    ...body.links.map(([id, href]) => relationship(id, 'hyperlink', href, true)),
  ].join('');

  const title = escapeXml(data.contact.name || 'Mosaic Resume');
  return zipFiles({
    '[Content_Types].xml':
      `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>',
    '_rels/.rels':
      `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELS_NS}">` +
      relationship('rIdDocument', 'officeDocument', 'word/document.xml') +
      '<Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>',
    'docProps/core.xml':
      `${XML_DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<dc:title>${title}</dc:title></cp:coreProperties>`,
    'word/document.xml': documentXml,
    'word/_rels/document.xml.rels': `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELS_NS}">${documentRels}</Relationships>`,
    'word/styles.xml': writeStyles(data, rightTabTwips),
    'word/numbering.xml': NUMBERING,
  });
}
