import type {
  BuiltInHeaderKind,
  HeaderAlign,
  HeaderItem,
  HeaderItemKind,
  HeaderLine,
  HeaderSeparator,
  LinkStyle,
  ResumeHeader,
} from '../types/resume';

/**
 * The built-in header items: a kind with a name and an example of what goes in it. Any of
 * them can be added any number of times, and they print and link only by their own text and
 * link — exactly as a custom item does.
 */
export const HEADER_PRESETS: Record<BuiltInHeaderKind, { label: string; placeholder: string }> = {
  phone: { label: 'Phone', placeholder: '(555) 010-0100' },
  email: { label: 'Email', placeholder: 'you@example.com' },
  linkedin: { label: 'LinkedIn', placeholder: 'linkedin.com/in/you' },
  github: { label: 'GitHub', placeholder: 'github.com/you' },
  site: { label: 'Website', placeholder: 'yoursite.dev' },
  location: { label: 'Location', placeholder: 'City, State' },
  auth: { label: 'Work authorization', placeholder: 'US Citizen' },
};

/** Every built-in kind, in the order menus list them. */
export const BUILT_IN_HEADER_KINDS = Object.keys(HEADER_PRESETS) as BuiltInHeaderKind[];

/** A custom item: whatever the user writes, named by nothing but its text. */
export const CUSTOM_HEADER_ITEM = { label: 'Custom item', placeholder: 'Any text' };

/** An item's kind as the editor names it. */
export const getHeaderKindInfo = (kind: HeaderItemKind) =>
  kind === 'custom' ? CUSTOM_HEADER_ITEM : HEADER_PRESETS[kind];

export const HEADER_SEPARATORS: { value: HeaderSeparator; label: string }[] = [
  { value: ' | ', label: '|' },
  { value: ' · ', label: '·' },
  { value: ' — ', label: '—' },
  { value: ' • ', label: '•' },
  { value: '    ', label: 'Space' },
];

export const HEADER_ALIGNS: { value: HeaderAlign; label: string }[] = [
  { value: 'center', label: 'Centered' },
  { value: 'left', label: 'Left' },
];

export const LINK_STYLES: { value: LinkStyle; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'underline', label: 'Underlined' },
];

const EXPLICIT_SCHEME = /^(?:https?:|mailto:|tel:)/i;
const EMAIL_ADDRESS = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
/** A number to call: digits and the marks numbers are written with, seven digits or more. */
const PHONE_NUMBER = /^\+?[\d\s().-]+$/;
const MIN_PHONE_DIGITS = 7;
/** Something with a dot or a slash in it and no spaces: a domain or a path. */
const WEB_ADDRESS = /^[^\s]*[./][^\s]*$/;

/**
 * The link written into a file for an item, or '' for none — from what was typed as its
 * link alone: an address is mailed, a number called, anything else with a dot or a slash
 * opened on the web. Derived when printing, never stored: the field keeps exactly what was
 * typed, and nothing is rewritten under the user.
 */
export function resolveHeaderItemHref({ url }: Pick<HeaderItem, 'url'>): string {
  const typed = url.trim();
  if (!typed) return '';
  if (EXPLICIT_SCHEME.test(typed)) return typed;
  if (EMAIL_ADDRESS.test(typed)) return `mailto:${typed}`;
  const digits = typed.replace(/\D/g, '');
  if (PHONE_NUMBER.test(typed) && digits.length >= MIN_PHONE_DIGITS) {
    return `tel:${typed.startsWith('+') ? '+' : ''}${digits}`;
  }
  if (WEB_ADDRESS.test(typed)) return `https://${typed.replace(/^\/+/, '')}`;
  return '';
}

/** An address as a reader would say it: no scheme, no "www.", no trailing slash, any case. */
const normalizeAddress = (text: string) =>
  text
    .trim()
    .replace(/^(?:mailto:|tel:|[a-z][a-z\d+.-]*:\/\/)/i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();

/** A link without the part only software reads: `mailto:` and `tel:` go, a web link stays. */
export const stripMailtoOrTelScheme = (href: string) => href.replace(/^(?:mailto|tel):/i, '');

/**
 * Whether two pieces of text name the same address: "github.com/ada" and
 * "https://github.com/ada/", or "(555) 010-0100" and "tel:5550100100".
 */
export function isSameAddress(a: string, b: string): boolean {
  const digits = (text: string) => text.replace(/\D/g, '');
  if (/^tel:/i.test(a) || /^tel:/i.test(b)) return digits(a) !== '' && digits(a) === digits(b);
  return normalizeAddress(a) !== '' && normalizeAddress(a) === normalizeAddress(b);
}

export interface PrintedHeaderItem {
  id: string;
  kind: HeaderItemKind;
  text: string;
  href: string;
}

export interface PrintedHeaderLine {
  id: string;
  separator: HeaderSeparator;
  align: HeaderAlign;
  items: PrintedHeaderItem[];
}

/**
 * What prints: shown items that have text, in lines that still have any. Two ways off the
 * page, meaning different things — a hidden item keeps its data, an item with no text has
 * nothing to print.
 */
export function getPrintableHeaderLines(header: ResumeHeader): PrintedHeaderLine[] {
  return header.lines
    .map(({ id, separator, align, items }) => ({
      id,
      separator,
      align,
      items: items
        .filter((item) => item.shown && item.text.trim())
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          text: item.text.trim(),
          href: resolveHeaderItemHref(item),
        })),
    }))
    .filter((line) => line.items.length > 0);
}

/** A printed line as the page reads it. */
export function formatHeaderLineText(line: Pick<PrintedHeaderLine, 'separator' | 'items'>): string {
  return line.items.map((item) => item.text).join(line.separator);
}

export function createHeaderItem(
  kind: HeaderItemKind,
  { text = '', url = '' }: Partial<Pick<HeaderItem, 'text' | 'url'>> = {}
): HeaderItem {
  return { id: crypto.randomUUID(), kind, text, url, shown: true };
}

export function createHeaderLine(
  items: HeaderItem[] = [],
  { separator = ' | ', align = 'center' }: Partial<Pick<HeaderLine, 'separator' | 'align'>> = {}
): HeaderLine {
  return { id: crypto.randomUUID(), separator, align, items };
}
