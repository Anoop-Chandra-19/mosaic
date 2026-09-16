import {
  type DocxBlock,
  type DocxCell,
  type DocxDocument,
  type DocxNote,
  type DocxParagraph,
  type DocxPart,
  type DocxRow,
  type DocxSource,
  type DocxTable,
} from './docxModel';
import { docxLines } from './docxLines';
import { linkText } from '../importLines';
import { parseResumeLines, type ParsedResume } from '../parseResume';
import {
  attribute,
  childNamed,
  childrenNamed,
  decodeXml,
  descendantsNamed,
  isElement,
  parseXml,
  textOf,
  type XmlElement,
} from './parseXml';
import { openZip, type Zip } from './openZip';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Strict Open XML's names for the same namespaces, which Word can also save a file in. */
const STRICT = new Map([
  ['http://purl.oclc.org/ooxml/wordprocessingml/main', W],
  ['http://purl.oclc.org/ooxml/officeDocument/relationships', R],
]);

/**
 * The most one part of a Word file may unpack to. A long resume's text comes to a few
 * hundred kilobytes; this stops a small file that unpacks into far more than any document.
 */
export const MAX_PART_BYTES = 16 * 1024 * 1024;

/** The most columns Word lets a table have, and so the most one cell can span. */
const MAX_TABLE_COLUMNS = 63;

/** Properties a style flips rather than sets. */
const TOGGLES = ['bold', 'italic', 'caps', 'hidden'] as const;

/** How text is set: each field is left out when the part that sets it doesn't say. */
interface RunProps {
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  hidden?: boolean;
  /** In half-points. */
  size?: number;
}

interface Style {
  basedOn?: string;
  outline?: number;
  numbering?: { id?: string; level?: number };
  rightTab: boolean;
  spaceBefore?: number;
  run: RunProps;
}

interface Styles {
  paragraph: Map<string, Style>;
  character: Map<string, Style>;
  /** Numbering style id → the list it stands for, which a list may point to instead of levels. */
  lists: Map<string, string>;
  defaultParagraph?: string;
  defaults: RunProps;
}

/** For each list, which of its levels show a marker. */
type Numbering = Map<string, Map<number, boolean>>;

interface Relationship {
  type: string;
  target: string;
  external: boolean;
}

/** What the reader met but does not put on the page. */
interface Left {
  pictures: number;
  objects: number;
  deletions: number;
  hidden: number;
}

interface Context {
  styles: Styles;
  numbering: Numbering;
  /** Relationship id → where a hyperlink points, for the part being read. */
  links: Map<string, string>;
  part: DocxPart;
  path: string;
  left: Left;
}

/** A Word file with nothing in it Mosaic can read as a document. */
export class NotADocxError extends Error {}

async function readPart(zip: Zip, path: string): Promise<XmlElement | null> {
  const bytes = await zip.read(path, MAX_PART_BYTES);
  return bytes ? toTransitional(parseXml(decodeXml(bytes))) : null;
}

/** A part with Strict namespaces renamed to the usual ones, so one reader reads both. */
function toTransitional(root: XmlElement): XmlElement {
  const stack = [root];
  while (stack.length) {
    const element = stack.pop()!;
    element.ns = STRICT.get(element.ns) ?? element.ns;
    for (const attr of element.attributes) attr.ns = STRICT.get(attr.ns) ?? attr.ns;
    for (const child of element.children) if (isElement(child)) stack.push(child);
  }
  return root;
}

const isAlternateContent = (node: XmlElement) => node.ns === MC && node.name === 'AlternateContent';

/** Of content written two ways, the richer choice — or the fallback, when that is all there is. */
const alternativeOf = (node: XmlElement) =>
  childNamed(node, MC, 'Choice') ?? childNamed(node, MC, 'Fallback');

/** "word/document.xml" → "word/_rels/document.xml.rels". */
function relationshipsPath(part: string): string {
  const slash = part.lastIndexOf('/') + 1;
  return `${part.slice(0, slash)}_rels/${part.slice(slash)}.rels`;
}

/** A relationship's target as a path in the zip, from the part it belongs to. */
function resolveTarget(part: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const path = part.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') path.pop();
    else if (segment !== '.' && segment !== '') path.push(segment);
  }
  return path.join('/');
}

async function readRelationships(zip: Zip, part: string): Promise<Map<string, Relationship>> {
  const root = await readPart(zip, relationshipsPath(part));
  const relationships = new Map<string, Relationship>();
  for (const rel of childrenNamed(root ?? undefined, PACKAGE_RELATIONSHIPS, 'Relationship')) {
    const id = attribute(rel, '', 'Id');
    const type = attribute(rel, '', 'Type') ?? '';
    const target = attribute(rel, '', 'Target') ?? '';
    const external = attribute(rel, '', 'TargetMode') === 'External';
    if (id) {
      relationships.set(id, {
        type,
        target: external ? target : resolveTarget(part, target),
        external,
      });
    }
  }
  return relationships;
}

/** A part inside the file — never an external target, which Mosaic doesn't fetch. */
const partOfType = (relationships: Map<string, Relationship>, type: string) =>
  [...relationships.values()].find((rel) => !rel.external && rel.type.endsWith(`/${type}`))?.target;

const hyperlinks = (relationships: Map<string, Relationship>) =>
  new Map(
    [...relationships]
      .filter(([, rel]) => rel.type.endsWith('/hyperlink'))
      .map(([id, rel]) => [id, rel.target])
  );

/** A toggle such as `<w:b/>`: on unless its value says off. */
function onOff(element: XmlElement | undefined): boolean | undefined {
  if (!element) return undefined;
  const value = attribute(element, W, 'val');
  return value === undefined || !['0', 'false', 'off'].includes(value);
}

function runPropsOf(rPr: XmlElement | undefined): RunProps {
  const props: RunProps = {};
  const set = <K extends keyof RunProps>(key: K, value: RunProps[K] | undefined) => {
    if (value !== undefined) props[key] = value;
  };
  set('bold', onOff(childNamed(rPr, W, 'b')));
  set('italic', onOff(childNamed(rPr, W, 'i')));
  set('caps', onOff(childNamed(rPr, W, 'caps')));
  set('hidden', onOff(childNamed(rPr, W, 'vanish')));
  const size = Number(attribute(childNamed(rPr, W, 'sz'), W, 'val'));
  set('size', size > 0 ? size : undefined);
  return props;
}

/**
 * Run properties through a chain of styles. Bold, italic, caps and hidden are toggles: a
 * style that turns one on flips what came before it, and one that turns it off leaves it
 * be. Direct formatting, laid over the result, sets them outright.
 */
function throughStyles(start: RunProps, styles: Style[]): RunProps {
  const props = { ...start };
  for (const { run } of styles) {
    for (const key of TOGGLES) if (run[key]) props[key] = !props[key];
    if (run.size !== undefined) props.size = run.size;
  }
  return props;
}

function numberingOf(pPr: XmlElement | undefined): Style['numbering'] {
  const numPr = childNamed(pPr, W, 'numPr');
  if (!numPr) return undefined;
  const level = Number(attribute(childNamed(numPr, W, 'ilvl'), W, 'val'));
  return {
    id: attribute(childNamed(numPr, W, 'numId'), W, 'val'),
    level: Number.isFinite(level) ? level : undefined,
  };
}

const hasRightTab = (pPr: XmlElement | undefined) =>
  childrenNamed(childNamed(pPr, W, 'tabs'), W, 'tab').some((tab) =>
    ['right', 'end'].includes(attribute(tab, W, 'val') ?? '')
  );

const spaceBeforeOf = (pPr: XmlElement | undefined) => {
  const before = Number(attribute(childNamed(pPr, W, 'spacing'), W, 'before'));
  return Number.isFinite(before) && before >= 0 ? before : undefined;
};

function readStyles(root: XmlElement | null): Styles {
  const styles: Styles = {
    paragraph: new Map(),
    character: new Map(),
    lists: new Map(),
    defaults: {},
  };
  if (!root) return styles;
  const defaults = childNamed(childNamed(root, W, 'docDefaults'), W, 'rPrDefault');
  styles.defaults = runPropsOf(childNamed(defaults, W, 'rPr'));
  for (const element of childrenNamed(root, W, 'style')) {
    const id = attribute(element, W, 'styleId');
    const type = attribute(element, W, 'type');
    const pPr = childNamed(element, W, 'pPr');
    if (id && type === 'numbering') {
      const list = numberingOf(pPr)?.id;
      if (list) styles.lists.set(id, list);
    }
    if (!id || (type !== 'paragraph' && type !== 'character')) continue;
    const outline = Number(attribute(childNamed(pPr, W, 'outlineLvl'), W, 'val'));
    styles[type].set(id, {
      basedOn: attribute(childNamed(element, W, 'basedOn'), W, 'val'),
      // Level 9 is Word's "body text": no level at all.
      outline: Number.isFinite(outline) && outline < 9 ? outline : undefined,
      numbering: numberingOf(pPr),
      rightTab: hasRightTab(pPr),
      spaceBefore: spaceBeforeOf(pPr),
      run: runPropsOf(childNamed(element, W, 'rPr')),
    });
    const isDefault = ['1', 'true', 'on'].includes(attribute(element, W, 'default') ?? '');
    if (type === 'paragraph' && isDefault) styles.defaultParagraph ??= id;
  }
  return styles;
}

/** A style and the styles it's based on, the base first. */
function styleChain(styles: Map<string, Style>, id: string | undefined): Style[] {
  const chain: Style[] = [];
  const seen = new Set<string>();
  for (let at = id; at && !seen.has(at); at = styles.get(at)?.basedOn) {
    seen.add(at);
    const style = styles.get(at);
    if (style) chain.unshift(style);
  }
  return chain;
}

function readNumbering(root: XmlElement | null, styles: Styles): Numbering {
  const numbering: Numbering = new Map();
  if (!root) return numbering;
  const levelsOf = (element: XmlElement, levels = new Map<number, boolean>()) => {
    for (const lvl of childrenNamed(element, W, 'lvl')) {
      const format = attribute(childNamed(lvl, W, 'numFmt'), W, 'val');
      const text = attribute(childNamed(lvl, W, 'lvlText'), W, 'val');
      levels.set(Number(attribute(lvl, W, 'ilvl')), format !== 'none' && text !== '');
    }
    return levels;
  };
  const abstracts = new Map(
    childrenNamed(root, W, 'abstractNum').map((element) => [
      attribute(element, W, 'abstractNumId'),
      element,
    ])
  );
  const nums = new Map(
    childrenNamed(root, W, 'num').map((num) => [attribute(num, W, 'numId'), num])
  );
  const abstractOf = (num: XmlElement | undefined) =>
    abstracts.get(attribute(childNamed(num, W, 'abstractNumId'), W, 'val'));
  // A list may define no levels itself, only name a numbering style whose list has them.
  const levelsThrough = (abstract: XmlElement, seen = new Set<string>()): Map<number, boolean> => {
    const link = attribute(childNamed(abstract, W, 'numStyleLink'), W, 'val');
    const linked = link && !seen.has(link) && abstractOf(nums.get(styles.lists.get(link)));
    return linked ? levelsThrough(linked, seen.add(link)) : levelsOf(abstract);
  };
  for (const [id, num] of nums) {
    const abstract = abstractOf(num);
    if (!id || !abstract) continue;
    const levels = levelsThrough(abstract);
    for (const override of childrenNamed(num, W, 'lvlOverride')) levelsOf(override, levels);
    numbering.set(id, levels);
  }
  return numbering;
}

/** A paragraph's list, from its own numbering or its style's, and whether it shows a marker. */
function listOf(
  context: Context,
  pPr: XmlElement | undefined,
  chain: Style[]
): DocxParagraph['list'] {
  const own = numberingOf(pPr);
  // A derived style's numbering wins over its base's.
  const inherited = chain.map((style) => style.numbering);
  const id = own?.id ?? inherited.findLast((n) => n?.id !== undefined)?.id;
  if (!id || id === '0') return undefined;
  const level = own?.level ?? inherited.findLast((n) => n?.level !== undefined)?.level ?? 0;
  const levels = context.numbering.get(id);
  return { id, level, marker: levels?.get(level) ?? true };
}

/** Where a HYPERLINK field points, quoted or not; nothing for a link to a place in the file. */
function fieldAddress(instruction: string): string | undefined {
  const match = /^\s*HYPERLINK\s+(?:"([^"]+)"|([^\s"\\]+))/i.exec(instruction);
  return match?.[1] ?? match?.[2];
}

/** A paragraph's text being gathered, with what its runs are set in. */
interface Gathering {
  text: string;
  runs: RunProps[];
  rightTab: boolean;
  /** Text boxes met inside the paragraph, read after it. */
  boxes: XmlElement[];
  /** Fields being read: their instruction, and where their shown text starts. */
  fields: { instruction: string; start: number }[];
}

function endLink(gathering: Gathering, start: number, url: string | undefined) {
  if (!url) return;
  const words = gathering.text.slice(start);
  gathering.text = gathering.text.slice(0, start) + linkText(words, url);
}

/** Pictures and text boxes: a text box's paragraphs are read; a picture is only counted. */
function readDrawing(context: Context, element: XmlElement, gathering: Gathering) {
  const boxes = descendantsNamed(element, W, 'txbxContent');
  if (boxes.length) gathering.boxes.push(...boxes);
  else if (element.name === 'object') context.left.objects++;
  else context.left.pictures++;
}

function readRun(context: Context, run: XmlElement, base: RunProps, gathering: Gathering) {
  const charStyle = attribute(childNamed(childNamed(run, W, 'rPr'), W, 'rStyle'), W, 'val');
  const props: RunProps = {
    ...throughStyles(base, styleChain(context.styles.character, charStyle)),
    ...runPropsOf(childNamed(run, W, 'rPr')),
  };
  const readContent = (element: XmlElement) => {
    for (const node of element.children) {
      if (!isElement(node)) continue;
      if (isAlternateContent(node)) {
        const chosen = alternativeOf(node);
        if (chosen) readContent(chosen);
        continue;
      }
      if (node.ns !== W) continue;
      const field = gathering.fields.at(-1);
      switch (node.name) {
        case 't':
          if (props.hidden) {
            if (textOf(node).trim()) context.left.hidden++;
            break;
          }
          gathering.text += textOf(node);
          if (textOf(node).trim()) gathering.runs.push(props);
          break;
        case 'tab':
          if (!props.hidden) gathering.text += '\t';
          break;
        case 'ptab':
          gathering.text += '\t';
          if (attribute(node, W, 'alignment') === 'right') gathering.rightTab = true;
          break;
        case 'br':
        case 'cr':
          if (!props.hidden) gathering.text += '\n';
          break;
        case 'noBreakHyphen':
          gathering.text += '-';
          break;
        case 'sym': {
          const code = parseInt(attribute(node, W, 'char') ?? '', 16);
          if (Number.isFinite(code)) gathering.text += String.fromCharCode(code);
          break;
        }
        case 'fldChar': {
          const type = attribute(node, W, 'fldCharType');
          if (type === 'begin') gathering.fields.push({ instruction: '', start: -1 });
          else if (type === 'separate' && field) field.start = gathering.text.length;
          else if (type === 'end' && field) {
            gathering.fields.pop();
            if (field.start >= 0) endLink(gathering, field.start, fieldAddress(field.instruction));
          }
          break;
        }
        case 'instrText':
          if (field) field.instruction += textOf(node);
          break;
        case 'drawing':
        case 'pict':
        case 'object':
          readDrawing(context, node, gathering);
          break;
      }
    }
  };
  readContent(run);
}

/** A paragraph's runs, through links, fields, content controls and tracked insertions. */
function gather(context: Context, element: XmlElement, base: RunProps, gathering: Gathering) {
  for (const node of element.children) {
    if (!isElement(node)) continue;
    if (isAlternateContent(node)) {
      const chosen = alternativeOf(node);
      if (chosen) gather(context, chosen, base, gathering);
      continue;
    }
    if (node.ns !== W) continue;
    switch (node.name) {
      case 'r':
        readRun(context, node, base, gathering);
        break;
      case 'hyperlink': {
        const start = gathering.text.length;
        gather(context, node, base, gathering);
        endLink(gathering, start, context.links.get(attribute(node, R, 'id') ?? ''));
        break;
      }
      case 'fldSimple': {
        const start = gathering.text.length;
        gather(context, node, base, gathering);
        endLink(gathering, start, fieldAddress(attribute(node, W, 'instr') ?? ''));
        break;
      }
      // Text a tracked change took out: the document reads as if changes were accepted.
      case 'del':
      case 'moveFrom':
        if (descendantsNamed(node, W, 'delText').some((t) => textOf(t).trim())) {
          context.left.deletions++;
        }
        break;
      case 'pPr':
      case 'rPr':
      case 'sdtPr':
        break;
      default:
        gather(context, node, base, gathering);
    }
  }
}

const sourceOf = (context: Context, at: string, floating?: boolean): DocxSource => ({
  path: context.path,
  part: context.part,
  at,
  ...(floating ? { floating: true } : {}),
});

/** A paragraph, and the blocks of any text box anchored in it. */
function readParagraph(context: Context, p: XmlElement, at: string): DocxBlock[] {
  const { styles } = context;
  const pPr = childNamed(p, W, 'pPr');
  const style = attribute(childNamed(pPr, W, 'pStyle'), W, 'val') ?? styles.defaultParagraph;
  const chain = styleChain(styles.paragraph, style);
  const base = throughStyles(styles.defaults, chain);
  const gathering: Gathering = {
    text: '',
    runs: [],
    rightTab: hasRightTab(pPr) || chain.some((s) => s.rightTab),
    boxes: [],
    fields: [],
  };
  gather(context, p, base, gathering);

  const { runs } = gathering;
  const list = listOf(context, pPr, chain);
  const paragraph: DocxParagraph = {
    kind: 'paragraph',
    text: gathering.text,
    style: style ?? '',
    outline: chain.findLast((s) => s.outline !== undefined)?.outline,
    ...(list ? { list } : {}),
    rightTab: gathering.rightTab,
    bold: runs.length > 0 && runs.every((run) => run.bold),
    italic: runs.length > 0 && runs.every((run) => run.italic),
    caps: runs.length > 0 && runs.every((run) => run.caps),
    size: runs.reduce((largest, run) => Math.max(largest, run.size ?? 0), 0),
    spaceBefore:
      spaceBeforeOf(pPr) ?? chain.findLast((s) => s.spaceBefore !== undefined)?.spaceBefore ?? 0,
    source: sourceOf(context, at),
  };

  const blocks: DocxBlock[] = [paragraph];
  gathering.boxes.forEach((box, index) => {
    blocks.push(...readBlocks(context, box, `${at}/txbx[${index + 1}]`, true));
  });
  return blocks;
}

/** A table's rows, or a row's cells, including those a content control or custom XML wraps. */
function tableParts(parent: XmlElement, name: 'tr' | 'tc'): XmlElement[] {
  const found: XmlElement[] = [];
  for (const node of parent.children) {
    if (!isElement(node)) continue;
    if (isAlternateContent(node)) {
      const chosen = alternativeOf(node);
      if (chosen) found.push(...tableParts(chosen, name));
    } else if (node.ns !== W) {
      continue;
    } else if (node.name === name) {
      found.push(node);
    } else if (node.name === 'sdt') {
      found.push(...tableParts(childNamed(node, W, 'sdtContent') ?? node, name));
    } else if (node.name === 'customXml') {
      found.push(...tableParts(node, name));
    }
  }
  return found;
}

/** A table, kept as a table: rows, cells, and where each cell sits in the grid. */
function readTable(context: Context, table: XmlElement, at: string): DocxTable {
  const rows: DocxRow[] = [];
  tableParts(table, 'tr').forEach((tr, rowIndex) => {
    const cells: DocxCell[] = [];
    let column = 0;
    tableParts(tr, 'tc').forEach((tc, cellIndex) => {
      const tcPr = childNamed(tc, W, 'tcPr');
      const declared = Number(attribute(childNamed(tcPr, W, 'gridSpan'), W, 'val'));
      const span =
        Number.isInteger(declared) && declared > 0 ? Math.min(declared, MAX_TABLE_COLUMNS) : 1;
      const vMerge = childNamed(tcPr, W, 'vMerge');
      const continued =
        vMerge !== undefined && (attribute(vMerge, W, 'val') ?? 'continue') === 'continue';
      cells.push({
        blocks: readBlocks(context, tc, `${at}/tr[${rowIndex + 1}]/tc[${cellIndex + 1}]`),
        column,
        span,
        continued,
      });
      column += span;
    });
    rows.push({ cells, columns: column });
  });
  return { kind: 'table', rows, source: sourceOf(context, at) };
}

/** Paragraphs and tables in the order the file holds them, through content controls. */
function readBlocks(
  context: Context,
  container: XmlElement,
  at: string,
  floating = false
): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  const counts = new Map<string, number>();
  for (const node of container.children) {
    if (!isElement(node) || (node.ns !== W && !isAlternateContent(node))) continue;
    const index = (counts.get(node.name) ?? 0) + 1;
    counts.set(node.name, index);
    const path = `${at}/${node.name}[${index}]`;
    if (isAlternateContent(node)) {
      const chosen = alternativeOf(node);
      if (chosen) blocks.push(...readBlocks(context, chosen, path));
    } else if (node.name === 'p') blocks.push(...readParagraph(context, node, path));
    else if (node.name === 'tbl') blocks.push(readTable(context, node, path));
    else if (node.name === 'sdt') {
      blocks.push(...readBlocks(context, childNamed(node, W, 'sdtContent') ?? node, path));
    } else if (['customXml', 'ins', 'moveTo', 'txbxContent'].includes(node.name)) {
      blocks.push(...readBlocks(context, node, path));
    }
  }
  if (floating) for (const block of blocks) markFloating(block);
  return blocks;
}

function markFloating(block: DocxBlock) {
  block.source.floating = true;
  if (block.kind === 'table') {
    for (const row of block.rows) for (const cell of row.cells) cell.blocks.forEach(markFloating);
  }
}

/**
 * The first section's settings. A document's sections each keep theirs in the last
 * paragraph of the section, and only the final section's sit in the body — so the first
 * `sectPr` inside a paragraph belongs to the first section, and the body's to the last.
 */
function firstSectionProperties(body: XmlElement): XmlElement | undefined {
  for (const p of descendantsNamed(body, W, 'p')) {
    const sectPr = childNamed(childNamed(p, W, 'pPr'), W, 'sectPr');
    if (sectPr) return sectPr;
  }
  return childNamed(body, W, 'sectPr');
}

/**
 * The header or footer the first page shows: the one for first pages when the section is
 * set to give them their own, otherwise the section's usual one. Either may be missing, and
 * then the first page shows nothing there — not the part for the other case.
 */
function firstPagePart(
  settings: XmlElement | undefined,
  kind: 'headerReference' | 'footerReference',
  relationships: Map<string, Relationship>
): string | undefined {
  const references = childrenNamed(settings, W, kind);
  const ofType = (type: string) =>
    references.find((reference) => attribute(reference, W, 'type') === type);
  const titlePage = onOff(childNamed(settings, W, 'titlePg')) === true;
  const reference = ofType(titlePage ? 'first' : 'default');
  const id = attribute(reference, R, 'id') ?? '';
  const relationship = relationships.get(id);
  return relationship && !relationship.external ? relationship.target : undefined;
}

/**
 * What a Word file holds: the first page's header, the body, and the first page's footer,
 * each block knowing where it came from. Throws a `ZipError` or `XmlError` when the file is
 * damaged or beyond a reader's limits, and a `NotADocxError` when it is a zip but not a
 * Word document. Nothing outside the file is ever fetched.
 */
export async function readDocxContent(bytes: Uint8Array): Promise<DocxDocument> {
  const zip = openZip(bytes);
  const packageRelationships = await readRelationships(zip, '');
  const documentPath = partOfType(packageRelationships, 'officeDocument') ?? 'word/document.xml';
  const document = await readPart(zip, documentPath);
  const body = childNamed(document ?? undefined, W, 'body');
  if (!body) throw new NotADocxError('The file isn’t a Word document.');

  const relationships = await readRelationships(zip, documentPath);
  const stylesPath = partOfType(relationships, 'styles');
  const numberingPath = partOfType(relationships, 'numbering');
  const styles = readStyles(stylesPath ? await readPart(zip, stylesPath) : null);
  const context: Context = {
    styles,
    numbering: readNumbering(numberingPath ? await readPart(zip, numberingPath) : null, styles),
    links: hyperlinks(relationships),
    part: 'body',
    path: documentPath,
    left: { pictures: 0, objects: 0, deletions: 0, hidden: 0 },
  };

  const settings = firstSectionProperties(body);
  const around = async (part: DocxPart, path: string | undefined): Promise<DocxBlock[]> => {
    const root = path ? await readPart(zip, path) : null;
    if (!path || !root) return [];
    const links = context.links;
    Object.assign(context, {
      part,
      path,
      links: hyperlinks(await readRelationships(zip, path)),
    });
    const blocks = readBlocks(context, root, part);
    Object.assign(context, { part: 'body', path: documentPath, links });
    return blocks;
  };

  const header = await around('header', firstPagePart(settings, 'headerReference', relationships));
  const footer = await around('footer', firstPagePart(settings, 'footerReference', relationships));
  const blocks = [...header, ...readBlocks(context, body, 'body'), ...footer];

  const { left } = context;
  const notes: DocxNote[] = [];
  const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
  if (left.pictures) {
    notes.push({
      kind: 'unreadable',
      message: `The file has ${count(left.pictures, 'a picture', 'pictures')}, which Mosaic doesn’t import.`,
    });
  }
  if (left.objects) {
    notes.push({
      kind: 'unreadable',
      message: `The file has ${count(left.objects, 'an embedded object', 'embedded objects')}, which Mosaic doesn’t import.`,
    });
  }
  if (left.deletions) {
    notes.push({
      kind: 'excluded',
      message: 'This file has tracked changes. Mosaic read it as if they were all accepted.',
    });
  }
  if (left.hidden) {
    notes.push({
      kind: 'excluded',
      message: 'Some text in this file is hidden. Mosaic left it out.',
    });
  }
  return { blocks, notes };
}

/** A Word file as a resume to review. */
export async function readDocx(bytes: Uint8Array): Promise<ParsedResume> {
  const document = await readDocxContent(bytes);
  const { lines, notes, leftOut } = docxLines(document);
  const parsed = parseResumeLines(lines);
  parsed.warnings.push(...notes.map((note) => note.message));
  parsed.leftOut.push(...leftOut);
  return parsed;
}
