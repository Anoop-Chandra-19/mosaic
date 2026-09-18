import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paragraphsOf, type DocxParagraph, type DocxTable } from '../docxModel';
import { NotADocxError, readDocxContent } from '../readDocx';
import { XmlError } from '../parseXml';
import { ZipError } from '../openZip';
import { markLink, replaceMarkedLinksWithText } from '../../../parsing/importLines';
import {
  cell,
  deleted,
  docx,
  hyperlink,
  hyperlinkField,
  inserted,
  para,
  picture,
  run,
  table,
  textBox,
  zip,
} from './buildDocx';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const read = async (body: string, options?: Parameters<typeof docx>[1]) =>
  readDocxContent(await docx(body, options));

const textsOf = async (body: string, options?: Parameters<typeof docx>[1]) =>
  paragraphsOf((await read(body, options)).blocks).map((p) => p.text);

/** Reading is extraction only: what the file holds, not what any of it means. */
describe('readDocxContent', () => {
  it('reads paragraphs in the order the file holds them', async () => {
    expect(await textsOf([para('One'), para(''), para('Two')].join(''))).toEqual([
      'One',
      '',
      'Two',
    ]);
  });

  it('reads tabs and line breaks as they are written', async () => {
    expect(await textsOf(para('Engineer\tAcme\nLondon'))).toEqual(['Engineer\tAcme\nLondon']);
  });

  describe('reads the same text however the file writes it', () => {
    it('split across runs, or in one', async () => {
      const split = para([run('Analyst at '), run('Babbage'), run(' & Co')]);
      expect(await textsOf(split)).toEqual(await textsOf(para('Analyst at Babbage & Co')));
    });

    it('with any namespace prefix', async () => {
      const renamed = (await zip({
        '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
        'word/document.xml': `<?xml version="1.0"?><word:document xmlns:word="${W}" xmlns:rel="${R}"><word:body><word:p><word:r><word:t>Ada Lovelace</word:t></word:r></word:p></word:body></word:document>`,
      })) as Uint8Array;
      const { blocks } = await readDocxContent(renamed);
      expect(paragraphsOf(blocks).map((p) => p.text)).toEqual(['Ada Lovelace']);
    });

    it('formatted directly, or by a style that says the same', async () => {
      const direct = paragraphsOf((await read(para('Bold words', { bold: true }))).blocks);
      const styled = paragraphsOf(
        (await read(para('Bold words', { paragraphStyle: 'Heading2' }))).blocks
      );
      const inherited = paragraphsOf(
        (await read(para([run('Bold words', { style: 'Strong' })]))).blocks
      );
      expect(direct[0].bold).toBe(true);
      expect(styled[0].bold).toBe(true);
      expect(inherited[0].bold).toBe(true);
    });
  });

  it('takes the evidence of how a paragraph is set, not what it means', async () => {
    const { blocks } = await read(
      [
        para('Experience', { paragraphStyle: 'Heading2', spaceBefore: 240 }),
        para('Engineer\t2020', { rightTab: true, italic: true, size: 28 }),
        para('Did the work', { list: 1 }),
        para('Numbered', { list: 2 }),
        para('No marker', { list: 3 }),
      ].join('')
    );
    const paragraphs = paragraphsOf(blocks) as DocxParagraph[];
    expect(paragraphs[0]).toMatchObject({ style: 'Heading2', outline: 1, spaceBefore: 240 });
    expect(paragraphs[1]).toMatchObject({ rightTab: true, italic: true, size: 28 });
    expect(paragraphs[2].list).toMatchObject({ level: 0, marker: true });
    expect(paragraphs[3].list).toMatchObject({ marker: true });
    expect(paragraphs[4].list).toMatchObject({ marker: false });
  });

  it('keeps a table as a table, with where each cell sits in the grid', async () => {
    const body = table([
      [cell(para('Wide heading'), { span: 2 })],
      [para('Left'), para('Right')],
      [para('Below'), cell('', { merged: true })],
    ]);
    const [block] = (await read(body)).blocks;
    expect(block.kind).toBe('table');
    const rows = (block as DocxTable).rows;
    expect(rows.map((row) => row.columns)).toEqual([2, 2, 2]);
    expect(rows[0].cells[0]).toMatchObject({ column: 0, span: 2 });
    expect(rows[1].cells.map((c) => c.column)).toEqual([0, 1]);
    expect(rows[2].cells[1].continued).toBe(true);
  });

  it('reads rows and cells a content control wraps', async () => {
    const tc = (text: string) => `<w:tc>${para(text)}</w:tc>`;
    const body =
      `<w:tbl><w:sdt><w:sdtPr/><w:sdtContent><w:tr>${tc('Wrapped row')}</w:tr></w:sdtContent></w:sdt>` +
      `<w:tr>${tc('Plain cell')}<w:sdt><w:sdtContent>${tc('Wrapped cell')}</w:sdtContent></w:sdt>` +
      `<w:customXml>${tc('Custom cell')}</w:customXml></w:tr></w:tbl>`;
    const [block] = (await read(body)).blocks;
    expect(paragraphsOf([block]).map((p) => p.text)).toEqual([
      'Wrapped row',
      'Plain cell',
      'Wrapped cell',
      'Custom cell',
    ]);
    expect((block as DocxTable).rows[1].cells.map((c) => c.column)).toEqual([0, 1, 2]);
  });

  it('takes a cell’s span only as a count of columns a table could have', async () => {
    const body = table([
      [cell(para('Huge'), { span: 4294967296 }), para('After')],
      [cell(para('Broken'), { span: -3 }), cell(para('Half'), { span: 1.5 })],
    ]);
    const rows = ((await read(body)).blocks[0] as DocxTable).rows;
    expect(rows[0].cells[0].span).toBeLessThanOrEqual(63);
    expect(rows[1].cells.map((c) => c.span)).toEqual([1, 1]);
  });

  it('reads a table inside a table', async () => {
    const inner = table([[para('Inner')]]);
    const [block] = (await read(table([[inner]]))).blocks;
    const nested = (block as DocxTable).rows[0].cells[0].blocks[0];
    expect(nested.kind).toBe('table');
    expect(paragraphsOf([nested]).map((p) => p.text)).toEqual(['Inner']);
  });

  it('says where each block came from', async () => {
    const { blocks } = await read([para('Name'), table([[para('Left'), para('Right')]])].join(''), {
      header: para('Header line'),
    });
    const sources = paragraphsOf(blocks).map((p) => `${p.source.part} ${p.source.at}`);
    expect(sources).toEqual([
      'header header/p[1]',
      'body body/p[1]',
      'body body/tbl[1]/tr[1]/tc[1]/p[1]',
      'body body/tbl[1]/tr[1]/tc[2]/p[1]',
    ]);
  });

  describe('page headers and footers', () => {
    it('reads the first section’s header, not the last section’s', async () => {
      const body = [
        para('Ada Lovelace'),
        para('', { section: '<w:headerReference w:type="default" r:id="rFirst"/>' }),
        para('Later section'),
      ].join('');
      const file = await zip({
        '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
        'word/headerFirst.xml': `<w:hdr xmlns:w="${W}">${para('first section header')}</w:hdr>`,
        'word/headerLast.xml': `<w:hdr xmlns:w="${W}">${para('last section header')}</w:hdr>`,
        'word/_rels/document.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rFirst" Type="${R}/header" Target="headerFirst.xml"/><Relationship Id="rLast" Type="${R}/header" Target="headerLast.xml"/></Relationships>`,
        'word/document.xml': `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rLast"/></w:sectPr></w:body></w:document>`,
      });
      const texts = paragraphsOf((await readDocxContent(file)).blocks).map((p) => p.text);
      expect(texts).toContain('first section header');
      expect(texts).not.toContain('last section header');
    });

    it('takes the first-page header when the section has one of its own', async () => {
      const texts = await textsOf(para('Body'), {
        header: para('every other page'),
        firstHeader: para('first page only'),
      });
      expect(texts).toContain('first page only');
      expect(texts).not.toContain('every other page');
    });

    it('leaves out a first-page header the section doesn’t turn on', async () => {
      const texts = await textsOf(para('Body'), {
        firstHeader: para('dormant'),
        section: '<w:headerReference w:type="first" r:id="rFirstHeader"/>',
      });
      expect(texts).toEqual(['Body']);
    });

    it('reads the footer, and says which part each came from', async () => {
      const { blocks } = await read(para('Body'), {
        header: para('Head'),
        footer: para('Foot'),
      });
      expect(paragraphsOf(blocks).map((p) => [p.source.part, p.text])).toEqual([
        ['header', 'Head'],
        ['body', 'Body'],
        ['footer', 'Foot'],
      ]);
    });
  });

  it('says how a paragraph is aligned: its own setting, then its style’s, then Word’s left', async () => {
    const styles = `<w:style w:type="paragraph" w:styleId="Contact"><w:pPr><w:jc w:val="center"/></w:pPr></w:style>`;
    const { blocks } = await read(
      [
        para('Ada Lovelace', { align: 'center' }),
        para('555-0100 | ada@example.com', { paragraphStyle: 'Contact' }),
        para('London, UK', { paragraphStyle: 'Contact', align: 'left' }),
        para('Education', { align: 'both' }),
        para('Mathematics'),
      ].join(''),
      { styles }
    );
    expect(paragraphsOf(blocks).map((p) => p.align)).toEqual([
      'center',
      'center',
      'left',
      'justify',
      'left',
    ]);
  });

  describe('links', () => {
    it('marks a link’s words with its address', async () => {
      const body = para([hyperlink('rLink', 'LinkedIn')]);
      const texts = await textsOf(body, { links: { rLink: 'https://linkedin.com/in/ada' } });
      expect(texts).toEqual([markLink('LinkedIn', 'https://linkedin.com/in/ada')]);
    });

    it('reads a link written as a field', async () => {
      expect(await textsOf(para([hyperlinkField('https://ada.dev', 'my site')]))).toEqual([
        markLink('my site', 'https://ada.dev'),
      ]);
    });

    it('keeps an address written as its own words, for the parser to write once', async () => {
      const texts = await textsOf(para([hyperlink('rLink', 'github.com/ada')]), {
        links: { rLink: 'https://github.com/ada' },
      });
      expect(texts).toEqual([markLink('github.com/ada', 'https://github.com/ada')]);
      expect(replaceMarkedLinksWithText(texts[0])).toBe('https://github.com/ada');
    });

    it('keeps the address when the words name only part of it', async () => {
      const texts = await textsOf(para([hyperlink('rLink', 'linkedin.com')]), {
        links: { rLink: 'https://www.linkedin.com/in/ada-lovelace' },
      });
      expect(texts).toEqual([markLink('linkedin.com', 'https://www.linkedin.com/in/ada-lovelace')]);
    });

    it('reads a field’s address with or without quotes', async () => {
      const simple = `<w:fldSimple w:instr=" HYPERLINK https://ada.dev ">${run('my site')}</w:fldSimple>`;
      const complex =
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK https://ada.blog \\o "tip"</w:instrText></w:r>` +
        `<w:r><w:fldChar w:fldCharType="separate"/></w:r>${run('my blog')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
      const bookmark = `<w:fldSimple w:instr='HYPERLINK \\l "top"'>${run('back to top')}</w:fldSimple>`;
      expect(await textsOf([para([simple]), para([complex]), para([bookmark])].join(''))).toEqual([
        markLink('my site', 'https://ada.dev'),
        markLink('my blog', 'https://ada.blog'),
        'back to top',
      ]);
    });
  });

  it('reads a file saved as Strict Open XML, as Word can save one', async () => {
    const SW = 'http://purl.oclc.org/ooxml/wordprocessingml/main';
    const SR = 'http://purl.oclc.org/ooxml/officeDocument/relationships';
    const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const file = await zip({
      '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="r1" Type="${SR}/officeDocument" Target="word/document.xml"/></Relationships>`,
      'word/_rels/document.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rS" Type="${SR}/styles" Target="styles.xml"/><Relationship Id="rL" Type="${SR}/hyperlink" Target="https://ada.dev" TargetMode="External"/></Relationships>`,
      'word/styles.xml': `<w:styles xmlns:w="${SW}"><w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b w:val="true"/></w:rPr></w:style></w:styles>`,
      'word/document.xml': `<w:document xmlns:w="${SW}" xmlns:r="${SR}"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Ada Lovelace</w:t></w:r></w:p><w:p><w:hyperlink r:id="rL"><w:r><w:t>my site</w:t></w:r></w:hyperlink></w:p></w:body></w:document>`,
    });
    const paragraphs = paragraphsOf((await readDocxContent(file)).blocks);
    expect(paragraphs[0]).toMatchObject({ text: 'Ada Lovelace', bold: true, outline: 0 });
    expect(paragraphs[1].text).toBe(markLink('my site', 'https://ada.dev'));
  });

  describe('formatting a style turns on, and a style it builds on turns off again', () => {
    const styles =
      `<w:style w:type="paragraph" w:styleId="Quiet"><w:rPr><w:vanish/><w:b/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Loud"><w:basedOn w:val="Quiet"/><w:rPr><w:vanish/><w:b/></w:rPr></w:style>` +
      `<w:style w:type="paragraph" w:styleId="Firm"><w:basedOn w:val="Quiet"/><w:rPr><w:vanish w:val="0"/></w:rPr></w:style>`;

    it('toggles, rather than repeats, what the base style set', async () => {
      const { blocks, notes } = await read(para('Seen after all', { paragraphStyle: 'Loud' }), {
        styles,
      });
      expect(paragraphsOf(blocks)[0]).toMatchObject({ text: 'Seen after all', bold: false });
      expect(notes).toEqual([]);
    });

    it('leaves the setting as it was when a style turns it off', async () => {
      const { blocks } = await read(para('Still hidden', { paragraphStyle: 'Firm' }), { styles });
      expect(paragraphsOf(blocks)[0].text).toBe('');
    });

    it('toggles between a paragraph’s style and a run’s', async () => {
      const { blocks } = await read(
        para([run('Plain again', { style: 'Strong' })], { paragraphStyle: 'Heading2' })
      );
      expect(paragraphsOf(blocks)[0].bold).toBe(false);
    });

    it('but takes direct formatting as it is written', async () => {
      const { blocks } = await read(para('Bold', { paragraphStyle: 'Heading2', bold: true }));
      expect(paragraphsOf(blocks)[0].bold).toBe(true);
    });
  });

  it('reads the chosen content of block-level alternate content', async () => {
    const body = `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="w14">${para('Chosen')}</mc:Choice><mc:Fallback>${para('Fallback')}</mc:Fallback></mc:AlternateContent>`;
    expect(await textsOf(body)).toEqual(['Chosen']);
  });

  it('follows a list defined through a numbering style', async () => {
    const styles = `<w:style w:type="numbering" w:styleId="PlainList"><w:pPr><w:numPr><w:numId w:val="11"/></w:numPr></w:pPr></w:style>`;
    const numbering =
      `<w:abstractNum w:abstractNumId="10"><w:numStyleLink w:val="PlainList"/></w:abstractNum>` +
      `<w:abstractNum w:abstractNumId="11"><w:styleLink w:val="PlainList"/><w:lvl w:ilvl="0"><w:numFmt w:val="none"/><w:lvlText w:val=""/></w:lvl></w:abstractNum>` +
      `<w:num w:numId="10"><w:abstractNumId w:val="10"/></w:num><w:num w:numId="11"><w:abstractNumId w:val="11"/></w:num>`;
    const { blocks } = await read(para('Indented, no marker', { list: 10 }), { styles, numbering });
    expect(paragraphsOf(blocks)[0].list).toMatchObject({ marker: false });
  });

  describe('what it leaves out, and says so', () => {
    it('text a tracked change took out, keeping what one added', async () => {
      const { blocks, notes } = await read(
        para([run('Wrote '), deleted('some of '), inserted('the first program')])
      );
      expect(paragraphsOf(blocks)[0].text).toBe('Wrote the first program');
      expect(notes).toContainEqual(
        expect.objectContaining({
          kind: 'excluded',
          message: expect.stringContaining('tracked changes'),
        })
      );
    });

    it('hidden text', async () => {
      const { blocks, notes } = await read(
        para([run('Shown '), run('hidden note', { hidden: true })])
      );
      expect(paragraphsOf(blocks)[0].text).toBe('Shown ');
      expect(notes).toContainEqual(
        expect.objectContaining({ kind: 'excluded', message: expect.stringContaining('hidden') })
      );
    });

    it('pictures, counted', async () => {
      const { notes } = await read(para([run('See '), picture(), picture()]));
      expect(notes).toContainEqual(
        expect.objectContaining({
          kind: 'unreadable',
          message: expect.stringContaining('2 pictures'),
        })
      );
    });
  });

  it('reads a text box once, and marks it as floating', async () => {
    const { blocks } = await read(para([run('Anchor'), textBox(para('Boxed line'))]));
    const paragraphs = paragraphsOf(blocks);
    expect(paragraphs.map((p) => p.text)).toEqual(['Anchor', 'Boxed line']);
    expect(paragraphs[1].source.floating).toBe(true);
    expect(paragraphs[1].source.at).toContain('txbx');
  });

  it('reads a file with no styles or numbering part', async () => {
    expect(await textsOf(para('Plain'), { bare: true })).toEqual(['Plain']);
  });

  it('refuses what is not a Word file', async () => {
    await expect(readDocxContent(await zip({ 'a.txt': 'hi' }))).rejects.toThrow(NotADocxError);
    await expect(readDocxContent(new TextEncoder().encode('nope'))).rejects.toThrow(ZipError);
    const broken = await zip({
      '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
      'word/document.xml': '<w:document><w:body><w:p></w:body></w:document>',
    });
    await expect(readDocxContent(broken)).rejects.toThrow(XmlError);
  });

  describe('files written by other programs', () => {
    const fixture = (name: string) =>
      new Uint8Array(readFileSync(new URL(`./documents/${name}`, import.meta.url)));

    it('reads the one LibreOffice wrote', async () => {
      const { blocks } = await readDocxContent(fixture('libreoffice-resume.docx'));
      const texts = paragraphsOf(blocks).map((p) => p.text.trim());
      expect(texts).toContain('Ada Lovelace');
      expect(texts).toContain('Work History');
      expect(texts.some((t) => t.includes('\t1842 to 1843'))).toBe(true);
      expect(blocks.some((block) => block.kind === 'table')).toBe(true);
    });

    it('reads the one Word wrote', async () => {
      const { blocks } = await readDocxContent(fixture('word-resume.docx'));
      const paragraphs = paragraphsOf(blocks);
      expect(paragraphs[0]).toMatchObject({ text: 'Ada Lovelace', style: 'Heading1', outline: 0 });
      // Section headings Word left unstyled, in plain bold.
      expect(paragraphs.find((p) => p.text === 'Work History')).toMatchObject({
        bold: true,
        outline: undefined,
      });
      // An entry that is a list item with a date after a right-aligned tab stop.
      const degree = paragraphs.find((p) => p.text.startsWith('M.S.'))!;
      expect(degree.list?.marker).toBe(true);
      expect(degree.rightTab).toBe(true);
      expect(degree.text).toContain('\t1843');
    });
  });
});
