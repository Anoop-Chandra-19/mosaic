/**
 * A small XML reader, enough for the parts of a Word file: elements, attributes, text,
 * character references, comments, CDATA, processing instructions. Names are resolved to
 * their namespaces, so `w:t` and a drawing's `a:t` stay apart whatever prefixes a file
 * uses. Elements it doesn't know are kept as they are — an unfamiliar Word feature is for
 * the reader above to ignore, not for this to refuse.
 *
 * It is strict about the text being well-formed, and bounded in what it will build: the
 * files are untrusted, and a small one can otherwise ask for a great deal of work. Document
 * type declarations are refused, so no entity can expand into more than one character and
 * nothing is ever fetched.
 */

export interface XmlElement {
  /** The namespace of the element's name; '' when it has none. */
  ns: string;
  /** The name without its prefix. */
  name: string;
  attributes: XmlAttribute[];
  children: XmlNode[];
}

export interface XmlAttribute {
  ns: string;
  name: string;
  value: string;
}

export type XmlNode = XmlElement | string;

/** Text that isn't well-formed XML, or uses what this reader leaves out. */
export class XmlError extends Error {}

/** Well-formed, but larger or deeper than this reader will build. */
export class XmlLimitError extends XmlError {}

/** What one part may come to: past any of these, reading stops with an `XmlLimitError`. */
export const XML_LIMITS = {
  /** Elements and runs of text together. A long resume comes to a few tens of thousands. */
  nodes: 500_000,
  /** How deeply elements may nest. Word nests tables a few levels, not hundreds. */
  depth: 256,
  /** Characters in one element's text. */
  text: 4_000_000,
  /** Attributes on one element. */
  attributes: 256,
} as const;

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

/** The five entities XML defines itself; no file may add to them. */
const NAMED_ENTITIES = new Map([
  ['lt', '<'],
  ['gt', '>'],
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
]);

/** The longest a reference may be between its & and its ;: "#x10FFFF" and room to spare. */
const MAX_REFERENCE = 16;

/** XML's whitespace, which is narrower than JavaScript's `\s`. */
const IS_SPACE = /^[ \t\r\n]*$/;

const NAME_START =
  'A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';
// The combining marks come first, where they can't read as marks on the character before.
const NAME_PART = `[${NAME_START}][\\u0300-\\u036F${NAME_START}.0-9\\u00B7\\u203F-\\u2040-]*`;
/** A name without a prefix, as XML defines one. */
const LOCAL_NAME = new RegExp(`^${NAME_PART}$`, 'u');
/** A name with at most one prefix. */
const NAME = new RegExp(`^${NAME_PART}(?::${NAME_PART})?$`, 'u');

/** Anything outside `isXmlCharacter`, written as itself. */
const NOT_XML_CHARACTER = new RegExp(
  '[^\\t\\n\\r\\u0020-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]',
  'u'
);

const XML_DECLARATION =
  /^xml[ \t\n]+version[ \t\n]*=[ \t\n]*(["'])1\.\d+\1(?:[ \t\n]+encoding[ \t\n]*=[ \t\n]*(["'])[A-Za-z][\w.-]*\2)?(?:[ \t\n]+standalone[ \t\n]*=[ \t\n]*(["'])(?:yes|no)\3)?[ \t\n]*$/;

/**
 * The characters XML allows: tab, newline, carriage return, and the rest of Unicode bar
 * the control characters, the surrogate halves, and the two that are never characters.
 */
const isXmlCharacter = (code: number) =>
  code === 0x9 ||
  code === 0xa ||
  code === 0xd ||
  (code >= 0x20 && code <= 0xd7ff) ||
  (code >= 0xe000 && code <= 0xfffd) ||
  (code >= 0x10000 && code <= 0x10ffff);

function decodeReference(name: string): string {
  const named = NAMED_ENTITIES.get(name);
  if (named !== undefined) return named;
  const code = /^#x[0-9a-f]+$/i.test(name)
    ? parseInt(name.slice(2), 16)
    : /^#\d+$/.test(name)
      ? parseInt(name.slice(1), 10)
      : NaN;
  if (!isXmlCharacter(code)) {
    throw new XmlError(`&${name}; isn’t a character this reader knows.`);
  }
  return String.fromCodePoint(code);
}

/** Text with its references decoded, in one pass. */
function decodeEntities(text: string): string {
  let at = text.indexOf('&');
  if (at < 0) return text;
  let out = '';
  let from = 0;
  while (at >= 0) {
    const end = text.indexOf(';', at + 1);
    if (end < 0 || end - at - 1 > MAX_REFERENCE) {
      throw new XmlError('An “&” is not part of a character reference.');
    }
    out += text.slice(from, at) + decodeReference(text.slice(at + 1, end));
    from = end + 1;
    at = text.indexOf('&', from);
  }
  return out + text.slice(from);
}

function after(text: string, marker: string, from: number): number {
  const at = text.indexOf(marker, from);
  if (at < 0) throw new XmlError(`Expected ${marker}`);
  return at + marker.length;
}

/** Where the tag starting at `from` ends: its `>`, skipping any inside quoted values. */
function tagEnd(text: string, from: number): number {
  let quote = '';
  for (let at = from; at < text.length; at++) {
    const char = text[at];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return at;
    }
  }
  throw new XmlError('A tag is never closed.');
}

/**
 * A tag's attributes, every one of them: a name, `=`, and a quoted value. Anything else in
 * the tag is malformed — an unquoted value would otherwise be dropped without a word.
 */
function parseAttributes(body: string, from: number): [string, string][] {
  const attributes: [string, string][] = [];
  let at = from;
  let spaced = true;
  while (at < body.length) {
    if (IS_SPACE.test(body[at])) {
      at++;
      spaced = true;
      continue;
    }
    // Attributes are separated by whitespace; `x="1"y="2"` is not two of them.
    if (!spaced) throw new XmlError('Two attributes run together.');
    const equals = body.indexOf('=', at);
    if (equals < 0) throw new XmlError(`“${body.slice(at).trim()}” is not an attribute.`);
    const name = body.slice(at, equals).trim();
    if (!NAME.test(name)) throw new XmlError(`“${name}” is not an attribute name.`);
    let value = equals + 1;
    while (value < body.length && IS_SPACE.test(body[value])) value++;
    const quote = body[value];
    if (quote !== '"' && quote !== "'") {
      throw new XmlError(`The value of “${name}” is not in quotes.`);
    }
    const end = body.indexOf(quote, value + 1);
    if (end < 0) throw new XmlError(`The value of “${name}” is never closed.`);
    const raw = body.slice(value + 1, end);
    // A value may hold markup only as a reference, never as itself.
    if (raw.includes('<')) throw new XmlError(`The value of “${name}” holds a “<”.`);
    if (attributes.length >= XML_LIMITS.attributes) {
      throw new XmlLimitError('An element has more attributes than this reader reads.');
    }
    // Whitespace written in a value reads as a space; a reference to it stays what it names.
    attributes.push([name, decodeEntities(raw.replace(/[\t\n]/g, ' '))]);
    at = end + 1;
    spaced = false;
  }
  return attributes;
}

interface Open {
  element: XmlElement;
  /** The name as written, to match its closing tag. */
  tag: string;
  /** The namespaces this element declared, and what they hid, to put back when it closes. */
  undo: [prefix: string, was: string | undefined][];
}

/**
 * The document element of an XML text. Throws an `XmlError` when the text isn't well-formed
 * and an `XmlLimitError` when it is larger or deeper than `XML_LIMITS` allows.
 */
export function parseXml(source: string): XmlElement {
  const bad = NOT_XML_CHARACTER.exec(source);
  if (bad) {
    const code = bad[0].codePointAt(0)!.toString(16).toUpperCase();
    throw new XmlError(`U+${code.padStart(4, '0')} isn’t a character XML allows.`);
  }
  // XML reads every line ending as a newline, before anything else.
  const text = source.replace(/\r\n?/g, '\n');

  // One map for the whole read, with each element's declarations undone as it closes.
  const scope = new Map<string, string>([['xml', XML_NS]]);
  const stack: Open[] = [];
  let root: XmlElement | undefined;
  let nodes = 0;

  const unscope = (undo: Open['undo']) => {
    for (const [prefix, was] of undo.reverse()) {
      if (was === undefined) scope.delete(prefix);
      else scope.set(prefix, was);
    }
  };

  const bind = (prefix: string, ns: string, undo: Open['undo']) => {
    if (prefix === 'xmlns' || ns === XMLNS_NS) {
      throw new XmlError('The xmlns prefix and namespace can’t be declared.');
    }
    if ((prefix === 'xml') !== (ns === XML_NS)) {
      throw new XmlError('The xml prefix and namespace belong only to each other.');
    }
    if (prefix && !ns) throw new XmlError(`The prefix “${prefix}” is bound to no namespace.`);
    undo.push([prefix, scope.get(prefix)]);
    scope.set(prefix, ns);
  };

  const resolve = (qualified: string, isAttribute: boolean) => {
    const colon = qualified.indexOf(':');
    if (colon < 0) return { ns: isAttribute ? '' : (scope.get('') ?? ''), name: qualified };
    const prefix = qualified.slice(0, colon);
    const ns = scope.get(prefix);
    if (ns === undefined) throw new XmlError(`The prefix “${prefix}” is not declared.`);
    return { ns, name: qualified.slice(colon + 1) };
  };

  const add = (node: XmlNode) => {
    if (++nodes > XML_LIMITS.nodes) {
      throw new XmlLimitError('The document has more parts than this reader reads.');
    }
    const top = stack[stack.length - 1];
    if (top) top.element.children.push(node);
    else if (typeof node !== 'string') {
      if (root) throw new XmlError('The document has more than one document element.');
      root = node;
    }
  };

  const addText = (raw: string, decode: boolean) => {
    if (raw.length > XML_LIMITS.text) {
      throw new XmlLimitError('A run of text is longer than this reader reads.');
    }
    if (stack.length === 0) {
      // Whitespace around the document element is allowed; anything else is not.
      if (!decode || !IS_SPACE.test(raw)) {
        throw new XmlError('There is text outside the document element.');
      }
      return;
    }
    if (decode && raw.includes(']]>')) throw new XmlError('Text holds “]]>”.');
    add(decode ? decodeEntities(raw) : raw);
  };

  let at = 0;
  while (at < text.length) {
    const lt = text.indexOf('<', at);
    if (lt < 0) {
      addText(text.slice(at), true);
      break;
    }
    if (lt > at) addText(text.slice(at, lt), true);

    if (text.startsWith('<?', lt)) {
      at = after(text, '?>', lt);
      const instruction = text.slice(lt + 2, at - 2);
      const target = /^[^ \t\n]*/.exec(instruction)![0];
      if (target === 'xml') {
        // The XML declaration, which may only open the text.
        if (lt !== 0 || !XML_DECLARATION.test(instruction)) {
          throw new XmlError('The XML declaration is malformed or out of place.');
        }
      } else if (!LOCAL_NAME.test(target) || target.toLowerCase() === 'xml') {
        throw new XmlError('A processing instruction has no proper target.');
      }
    } else if (text.startsWith('<!--', lt)) {
      at = after(text, '-->', lt + 4);
      const comment = text.slice(lt + 4, at - 3);
      if (comment.includes('--') || comment.endsWith('-')) {
        throw new XmlError('A comment holds “--”.');
      }
    } else if (text.startsWith('<![CDATA[', lt)) {
      at = after(text, ']]>', lt);
      addText(text.slice(lt + 9, at - 3), false);
    } else if (text.startsWith('<!', lt)) {
      throw new XmlError('Document type declarations aren’t read.');
    } else if (text.startsWith('</', lt)) {
      const gt = tagEnd(text, lt);
      // Whitespace may follow the name, but not come before it.
      const tag = text.slice(lt + 2, gt).replace(/[ \t\n]+$/, '');
      const open = stack[stack.length - 1];
      if (!open || open.tag !== tag) throw new XmlError(`Unexpected </${tag}>.`);
      stack.pop();
      unscope(open.undo);
      at = gt + 1;
    } else {
      const gt = tagEnd(text, lt);
      const selfClosing = text[gt - 1] === '/';
      const body = text.slice(lt + 1, selfClosing ? gt - 1 : gt);
      const tag = /^[^\s/>]+/.exec(body)?.[0];
      if (!tag || !NAME.test(tag)) throw new XmlError('A tag has no name.');
      if (stack.length >= XML_LIMITS.depth) {
        throw new XmlLimitError('The document nests deeper than this reader reads.');
      }
      const raw = parseAttributes(body, tag.length);
      const names = new Set(raw.map(([name]) => name));
      if (names.size !== raw.length) throw new XmlError(`<${tag}> repeats an attribute.`);
      const undo: Open['undo'] = [];
      for (const [name, value] of raw) {
        if (name === 'xmlns') bind('', value, undo);
        else if (name.startsWith('xmlns:')) bind(name.slice(6), value, undo);
      }
      const attributes = raw
        .filter(([name]) => name !== 'xmlns' && !name.startsWith('xmlns:'))
        .map(([name, value]) => ({ ...resolve(name, true), value }));
      // Two prefixes for one namespace name the same attribute twice.
      const expanded = new Set(attributes.map(({ ns, name }) => `${ns} ${name}`));
      if (expanded.size !== attributes.length) {
        throw new XmlError(`<${tag}> repeats an attribute.`);
      }
      const element: XmlElement = { ...resolve(tag, false), attributes, children: [] };
      add(element);
      if (selfClosing) {
        unscope(undo);
      } else {
        stack.push({ element, tag, undo });
      }
      at = gt + 1;
    }
  }

  if (stack.length) throw new XmlError(`<${stack[stack.length - 1].tag}> is never closed.`);
  if (!root) throw new XmlError('There is no document element.');
  return root;
}

/** An XML part's bytes as text: UTF-8, or UTF-16 when it starts with that byte-order mark. */
export function decodeXml(bytes: Uint8Array): string {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new XmlError(`The text is not ${encoding} as it says it is.`);
  }
}

export const isElement = (node: XmlNode | undefined): node is XmlElement =>
  typeof node === 'object';

/** The element's child elements with this name, in order. */
export function childrenNamed(element: XmlElement | undefined, ns: string, name: string) {
  return (element?.children ?? []).filter(
    (node): node is XmlElement => isElement(node) && node.ns === ns && node.name === name
  );
}

/** The element's first child element with this name. */
export function childNamed(element: XmlElement | undefined, ns: string, name: string) {
  return childrenNamed(element, ns, name)[0];
}

/**
 * Every element with this name inside `element`, at any depth, in document order. It
 * doesn't look inside a match, and doesn't recurse: the tree may be as deep as its limit.
 */
export function descendantsNamed(element: XmlElement, ns: string, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const stack: XmlNode[] = [...element.children].reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (!isElement(node)) continue;
    if (node.ns === ns && node.name === name) found.push(node);
    else for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return found;
}

export function attribute(
  element: XmlElement | undefined,
  ns: string,
  name: string
): string | undefined {
  return element?.attributes.find((a) => a.ns === ns && a.name === name)?.value;
}

/** The text directly inside an element. */
export const textOf = (element: XmlElement): string =>
  element.children.filter((node): node is string => typeof node === 'string').join('');
