import { describe, expect, it } from 'vitest';
import {
  attribute,
  childNamed,
  childrenNamed,
  decodeXml,
  descendantsNamed,
  parseXml,
  textOf,
  XmlError,
  XmlLimitError,
  XML_LIMITS,
} from '../parseXml';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

describe('parseXml', () => {
  it('resolves names to namespaces, whatever the prefix', () => {
    const root = parseXml(
      `<?xml version="1.0"?><doc xmlns="urn:d" xmlns:w="${W}" xmlns:x="${W}" xmlns:a="urn:a"><w:t>one</w:t><x:t>two</x:t><a:t>not this</a:t><t>nor this</t></doc>`
    );
    expect(root).toMatchObject({ ns: 'urn:d', name: 'doc' });
    expect(childrenNamed(root, W, 't').map(textOf)).toEqual(['one', 'two']);
    expect(textOf(childNamed(root, 'urn:d', 't'))).toBe('nor this');
  });

  it('puts a prefix back as it was when the element that declared it closes', () => {
    const root = parseXml(
      `<doc xmlns:p="urn:outer"><a><b xmlns:p="urn:inner"><p:x/></b><p:y/></a></doc>`
    );
    const a = childNamed(root, 'urn:outer', 'a') ?? childNamed(root, '', 'a');
    const inner = childNamed(a, '', 'b');
    expect(childNamed(inner, 'urn:inner', 'x')).toBeDefined();
    expect(childNamed(a, 'urn:outer', 'y')).toBeDefined();
  });

  it('reads attributes by namespace, and unprefixed ones as having none', () => {
    const root = parseXml(
      `<w:p xmlns:w="${W}" id='plain' w:val="a &gt; b" data="x>y"><w:br/></w:p>`
    );
    expect(attribute(root, '', 'id')).toBe('plain');
    expect(attribute(root, W, 'val')).toBe('a > b');
    expect(attribute(root, '', 'data')).toBe('x>y');
    expect(attribute(root, W, 'id')).toBeUndefined();
    expect(childNamed(root, W, 'br')).toMatchObject({ children: [] });
  });

  it('decodes references, keeps CDATA, and skips comments and instructions', () => {
    const root = parseXml(
      '<t>&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos; &#233;&#x1F600;<!-- note --><?pi x?><![CDATA[<raw> & ]]></t>'
    );
    expect(textOf(root)).toBe('<a> & "b" \'c\' é😀<raw> & ');
  });

  it('keeps whitespace inside elements, and allows it around the document element', () => {
    expect(textOf(parseXml('<t xml:space="preserve">  two  spaces </t>'))).toBe('  two  spaces ');
    expect(parseXml('\n  <t/>\n ').name).toBe('t');
  });

  it('ends lines with a newline however the file ends them, as XML says to', () => {
    expect(textOf(parseXml('<a>one\r\ntwo\rthree\nfour</a>'))).toBe('one\ntwo\nthree\nfour');
    // A carriage return written as a reference is the character itself.
    expect(textOf(parseXml('<a>one&#13;two</a>'))).toBe('one\rtwo');
  });

  it('reads whitespace written in an attribute value as spaces, but not referenced whitespace', () => {
    const root = parseXml('<a v="one\ttwo\r\nthree\nfour" w="one&#10;two&#9;three"/>');
    expect(attribute(root, '', 'v')).toBe('one two three four');
    expect(attribute(root, '', 'w')).toBe('one\ntwo\tthree');
  });

  it('accepts what XML allows: its own prefix, names in any script, a declaration first', () => {
    const root = parseXml(
      `<?xml version="1.0" encoding="UTF-8" standalone='yes'?><résumé xmlns:xml="${XML_NS}" xml:lang="fr" _a.b-c="1"><!-- a - comment --><?target data?><名前>Ada</名前></résumé>`
    );
    expect(root.name).toBe('résumé');
    expect(attribute(root, XML_NS, 'lang')).toBe('fr');
    expect(textOf(childNamed(root, '', '名前'))).toBe('Ada');
  });

  it('finds elements at any depth, in order, without looking inside a match', () => {
    const root = parseXml('<a><b><c>1</c></b><c>2<c>inner</c></c></a>');
    expect(descendantsNamed(root, '', 'c').map(textOf)).toEqual(['1', '2']);
  });

  it('keeps elements it has never heard of, so an unfamiliar feature is not an error', () => {
    const root = parseXml(
      `<w:p xmlns:w="${W}" xmlns:w19="urn:later"><w19:futureThing w19:how="new"><w:t>text</w:t></w19:futureThing></w:p>`
    );
    const future = childNamed(root, 'urn:later', 'futureThing');
    expect(attribute(future, 'urn:later', 'how')).toBe('new');
    expect(descendantsNamed(root, W, 't').map(textOf)).toEqual(['text']);
  });

  describe('refuses text that is not well-formed', () => {
    const bad: [string, string][] = [
      ['two document elements', '<a/><b/>'],
      ['an unquoted attribute value', '<a broken=unquoted/>'],
      ['attributes with no space between them', '<a x="1"y="2"/>'],
      ['markup inside an attribute value', '<a x="<b>"/>'],
      [
        'one attribute twice under two prefixes for one namespace',
        '<a xmlns:p="u" xmlns:q="u" p:x="1" q:x="2"/>',
      ],
      ['a character reference XML forbids', '<a>&#0;</a>'],
      ['a vertical tab, which is not an XML character', '<a>&#xB;</a>'],
      ['an attribute with no value', '<a broken/>'],
      ['an unclosed attribute value', '<a broken="x/>'],
      ['the same attribute twice', '<a dup="1" dup="2"/>'],
      ['text outside the document element', 'outside<a/>after'],
      ['a closing tag that does not match', '<a><b></a></b>'],
      ['a tag that is never closed', '<a>'],
      ['no document element at all', ''],
      ['an undeclared prefix', '<p:a/>'],
      ['an unknown entity', '<a>&nope;</a>'],
      ['an inherited property as an entity', '<a>&constructor;</a>'],
      ['a bare ampersand', '<a>this & that</a>'],
      ['a character that is not one', '<a>&#x110000;</a>'],
      ['half of a surrogate pair', '<a>&#xD800;</a>'],
      ['a document type declaration', '<!DOCTYPE t [<!ENTITY a "aaaa">]><t>&a;</t>'],
      ['a NUL written as itself', `<a>${String.fromCharCode(0)}</a>`],
      ['a control character in an attribute', `<a x="${String.fromCharCode(1)}"/>`],
      ['a lone surrogate written as itself', '<a>\uD800</a>'],
      ['the xml prefix bound elsewhere', '<a xmlns:xml="urn:x"/>'],
      ['another prefix bound to the xml namespace', `<a xmlns:p="${XML_NS}"/>`],
      ['the xmlns prefix declared', '<a xmlns:xmlns="urn:x"/>'],
      ['the xmlns namespace bound to a prefix', '<a xmlns:p="http://www.w3.org/2000/xmlns/"/>'],
      ['a prefix bound to no namespace', '<a xmlns:p=""/>'],
      ['an element named with the xmlns prefix', '<xmlns:a/>'],
      ['a name starting with a digit', '<1a/>'],
      ['a name starting with a hyphen', '<-a/>'],
      ['an attribute name with a character names cannot hold', '<a b@c="1"/>'],
      ['a closing tag with a space before its name', '<a></ a>'],
      ['two hyphens inside a comment', '<a><!-- one -- two --></a>'],
      ['a comment ending in three hyphens', '<a><!-- one ---></a>'],
      ['an XML declaration that is not at the start', ' <?xml version="1.0"?><a/>'],
      ['an XML declaration inside the document', '<a><?xml version="1.0"?></a>'],
      ['a malformed XML declaration', '<?xml version="1.0" nonsense?><a/>'],
      ['an instruction with no target', '<a><? x?></a>'],
      ['"]]>" in text', '<a>]]></a>'],
      ['CDATA outside the document element', '<![CDATA[ ]]><a/>'],
    ];
    for (const [why, text] of bad) {
      it(why, () => expect(() => parseXml(text)).toThrow(XmlError));
    }
  });

  describe('stops, rather than working without end, on', () => {
    it('ampersands that never become references', () => {
      const started = performance.now();
      expect(() => parseXml(`<t>${'&'.repeat(200_000)}</t>`)).toThrow(XmlError);
      // Linear: the length of the text, not its square.
      expect(performance.now() - started).toBeLessThan(2000);
    });

    it('more parts than the limit', () => {
      const many = `<r>${'<e/>'.repeat(XML_LIMITS.nodes + 1)}</r>`;
      expect(() => parseXml(many)).toThrow(XmlLimitError);
    });

    it('nesting deeper than the limit', () => {
      const deep = XML_LIMITS.depth + 1;
      expect(() => parseXml(`${'<e>'.repeat(deep)}${'</e>'.repeat(deep)}`)).toThrow(XmlLimitError);
      const fine = XML_LIMITS.depth - 1;
      expect(parseXml(`${'<e>'.repeat(fine)}${'</e>'.repeat(fine)}`).name).toBe('e');
    });

    it('more attributes on one element than the limit', () => {
      const attributes = Array.from({ length: XML_LIMITS.attributes + 1 }, (_, i) => `a${i}="1"`);
      expect(() => parseXml(`<e ${attributes.join(' ')}/>`)).toThrow(XmlLimitError);
    });

    it('a namespace declared on every element of a deep document', () => {
      // Each element used to copy every namespace in scope, which squared the work.
      const depth = XML_LIMITS.depth - 1;
      const open = Array.from({ length: depth }, (_, i) => `<e xmlns:p${i}="urn:${i}">`).join('');
      const started = performance.now();
      parseXml(`${open}${'</e>'.repeat(depth)}`);
      expect(performance.now() - started).toBeLessThan(1000);
    });
  });
});

describe('decodeXml', () => {
  it('reads UTF-8, and UTF-16 by its byte-order mark', () => {
    expect(decodeXml(new TextEncoder().encode('<t>é</t>'))).toBe('<t>é</t>');
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'<t/>'].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(decodeXml(utf16)).toBe('<t/>');
  });

  it('refuses bytes that are not the encoding they claim, rather than damaging the text', () => {
    const invalid = new Uint8Array([0x3c, 0x74, 0x3e, 0xff, 0xfe, 0x3c, 0x2f, 0x74, 0x3e]);
    expect(() => decodeXml(invalid)).toThrow(XmlError);
  });
});
