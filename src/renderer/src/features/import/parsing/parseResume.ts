import {
  ENTRY_HEADING_SEPARATOR,
  splitEntryHeading,
  type EntryHeadingFields,
} from '@shared/resume/entryHeading';
import {
  HEADER_SEPARATORS,
  createHeaderItem,
  createHeaderLine,
  resolveHeaderItemHref,
} from '@shared/resume/resumeHeader';
import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type {
  Bullet,
  ContactInfo,
  HeaderAlign,
  HeaderItemKind,
  HeaderLine,
  HeaderSeparator,
  ResumeData,
  ResumeEntry,
  ResumeSection,
  SectionKind,
  SectionLayout,
} from '@shared/types/resume';
import {
  DATE_LIKE,
  findMarkedLinkUrl,
  removeLinkMarks,
  replaceMarkedLinksWithText,
  textToLines,
  type ImportLine,
} from './importLines';
import { matchSectionHeader } from './sectionHeaders';

export interface ParsedResume {
  resume: ResumeData;
  warnings: string[];
  /**
   * Lines Mosaic read but found no place for — a heading with nothing under it — as they
   * were in the file. The review step lists them, so nothing is dropped without saying so.
   */
  leftOut: string[];
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\(?\+?\d[\d\s().-]{6,}\d)/;
/** A web address: a name with a dot and a top-level domain of letters ("U.S." isn't one). */
const WEB_RE = /(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[\w#%&./=?~+-]*)?/i;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w#%&./=?~+-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w#%&./=?~+-]+/i;
const LOCATION_RE = /^[A-Za-z][\w.\s'-]+,\s*[A-Za-z][\w.\s'-]+$/;
/** Words a work-authorization status uses: "US Citizen", "F-1 STEM OPT, work authorized…". */
const STATUS_RE =
  /\b(?:citizen(?:ship)?|resident|green card|visa|h-?1b|opt|cpt|ead|authori[sz](?:ed|ation)|sponsorship|clearance|permit)\b/i;
/** Between a contact line's fields: "a | b", "a · b", "a • b", "a — b", or a run of spaces. */
const FIELD_SEPARATOR = /\s+[|·•—]\s+|\s{2,}/;

interface ParseOptions {
  /**
   * The source marks its lines itself — entries, bullets, headings — and gives one logical
   * line per item (a DOCX, a PDF, Mosaic's Markdown). A section's shape then comes from its
   * marks. Off for plain text, whose lines are as the author broke them: a known heading
   * gives the shape, "heading | dates" splits, a line after bullets starts the next entry,
   * and a summary's wrapped lines join.
   */
  marked?: boolean;
}

/** A line's text, and its aside as a line of its own. */
const textsOf = (line: ImportLine) => (line.aside ? [line.text, line.aside] : [line.text]);

function newBullet(text: string): Bullet {
  return { id: crypto.randomUUID(), text: text.trim(), selected: true };
}

/**
 * A section body split where an entry starts: at a line marked as one, or at a gap — in a
 * marked source, not a gap before bullets, which still belong to the entry above. Plain
 * text marks no entries, so there a line that follows a bullet starts one too.
 */
function splitBlocks(lines: ImportLine[], marked: boolean): ImportLine[][] {
  const blocks: ImportLine[][] = [];
  let current: ImportLine[] = [];
  for (const line of lines) {
    const isBullet = line.role === 'bullet';
    const atGap = line.gapBefore && !(marked && isBullet);
    const afterBullets = !marked && !isBullet && current.at(-1)?.role === 'bullet';
    if ((line.role === 'entry' || atGap || afterBullets) && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/** Plain text's "Heading | Dates", as Mosaic's text export writes an entry's first line. */
const TITLE_SEPARATOR = ' | ';

/** A line's left side and its dates: its aside, or in plain text what follows the last " | ". */
function titleOf(line: ImportLine, marked: boolean): [string, string] {
  if (marked || line.aside) return [line.text, line.aside ?? ''];
  const at = line.text.lastIndexOf(TITLE_SEPARATOR);
  return at < 0
    ? [line.text, '']
    : [line.text.slice(0, at).trim(), line.text.slice(at + TITLE_SEPARATOR.length).trim()];
}

const fieldsOf = (line: string) =>
  line
    .split(FIELD_SEPARATOR)
    .map((field) => field.trim())
    .filter(Boolean);

/** A way to reach the person: an address, a number, a link. */
const isReach = (text: string) =>
  [EMAIL_RE, PHONE_RE, LINKEDIN_RE, GITHUB_RE, WEB_RE].some((re) => re.test(text));

/** What a contact field is about, by its words. Only meaning: it prints as written. */
function guessHeaderItemKind(field: string): HeaderItemKind {
  if (EMAIL_RE.test(field)) return 'email';
  // A profile written as its address, or as its name, the way the example resume has it.
  if (LINKEDIN_RE.test(field) || /^linkedin\b/i.test(field)) return 'linkedin';
  if (GITHUB_RE.test(field) || /^github\b/i.test(field)) return 'github';
  if (STATUS_RE.test(field)) return 'auth';
  if (WEB_RE.test(field)) return 'site';
  if (PHONE_RE.test(field)) return 'phone';
  if (LOCATION_RE.test(field)) return 'location';
  return 'custom';
}

/** The separator a line's fields are written apart with; Mosaic's own when it has none. */
function detectHeaderSeparator(line: string): HeaderSeparator {
  const mark = FIELD_SEPARATOR.exec(line)?.[0].trim();
  const known = HEADER_SEPARATORS.find(({ value }) => value.trim() === mark);
  return known?.value ?? HEADER_SEPARATORS[0].value;
}

/** "LinkedIn https://linkedin.com/in/ada": words, then the full address they stand for. */
const WORDS_THEN_ADDRESS = /^(.*\S)\s+((?:https?:\/\/|mailto:)\S+)$/i;
/** "LinkedIn (linkedin.com/in/ada)": how Mosaic's plain text writes a link after its words. */
const WORDS_THEN_BRACKETED = /^(.*\S)\s+\((\S+)\)$/;

/** A contact-block line, with where it sat when the source could say. */
interface ContactLine {
  text: string;
  align?: HeaderAlign;
}

/** A field's words and its link, as the source gave them — or as its words spell one out. */
function splitFieldTextAndLink(field: string, marked: boolean): { text: string; url: string } {
  const text = removeLinkMarks(field);
  const url = findMarkedLinkUrl(field);
  if (url) return { text, url };
  for (const pattern of [WORDS_THEN_BRACKETED, WORDS_THEN_ADDRESS]) {
    const [, words, address] = pattern.exec(text) ?? [];
    if (words && resolveHeaderItemHref({ url: address })) return { text: words, url: address };
  }
  // Plain text can't mark a link, so an address on its own is taken to link to itself.
  if (!marked && isReach(text) && resolveHeaderItemHref({ url: text })) return { text, url: text };
  return { text, url: '' };
}

/** A contact field as an item, its kind from its words and its link together. */
function createHeaderItemFromField(field: string, marked: boolean) {
  const { text, url } = splitFieldTextAndLink(field, marked);
  return createHeaderItem(guessHeaderItemKind(url ? `${text} ${url}` : text), { text, url });
}

/** A contact-block line as a header line: each field an item, kept as written. */
function createHeaderLineFromContactLine(
  { text, align = 'center' }: ContactLine,
  marked: boolean
): HeaderLine {
  const items = fieldsOf(text).map((field) => createHeaderItemFromField(field, marked));
  // Two fields and one of them a status or a place: the other is the other one.
  if (items.length === 2) {
    const kinds = items.map((item) => item.kind);
    const other = items.find((item) => item.kind === 'custom');
    if (other && kinds.includes('auth')) other.kind = 'location';
    else if (other && kinds.includes('location')) other.kind = 'auth';
  }
  return createHeaderLine(items, {
    separator: detectHeaderSeparator(removeLinkMarks(text)),
    align,
  });
}

/**
 * The name and the header: the name is the block's first line that is one field and nothing
 * else a header holds, and every other line of the block is a header line — Mosaic's own
 * files write "phone | email | links" and "status | location", and many resumes the same.
 */
function parseContact(preamble: ContactLine[], fullText: string, marked: boolean): ContactInfo {
  const shown = preamble.map((line) => removeLinkMarks(line.text));
  const nameAt = shown.findIndex(
    (line) =>
      fieldsOf(line).length === 1 &&
      !isReach(line) &&
      !STATUS_RE.test(line) &&
      !LOCATION_RE.test(line)
  );
  const lines = preamble
    .filter((line, index) => index !== nameAt && line.text.trim())
    .map((line) => createHeaderLineFromContactLine(line, marked));

  // With no contact block, the address and number can be anywhere.
  if (!shown.some((line) => line.trim())) {
    const found = [EMAIL_RE, PHONE_RE, LINKEDIN_RE, GITHUB_RE]
      .map((re) => fullText.match(re)?.[0].trim() ?? '')
      .filter(Boolean);
    if (found.length > 0) {
      lines.push(
        createHeaderLine(found.map((text) => createHeaderItem(guessHeaderItemKind(text), { text })))
      );
    }
  }

  return {
    name: nameAt < 0 ? '' : shown[nameAt].trim(),
    header: { linkStyle: 'plain', lines },
  };
}

function textEntry(text: string): ResumeEntry {
  return { id: crypto.randomUUID(), selected: true, text, bullets: [] };
}

/**
 * A lines section: one item per line. A wrapped summary's lines join until one ends a
 * sentence or a gap comes.
 */
function parseLineSection(body: ImportLine[], joinWrapped: boolean): ResumeEntry[] {
  const texts: string[] = [];
  let open = false;
  for (const { text, gapBefore } of body) {
    if (!text) continue;
    if (joinWrapped && open && !gapBefore) texts[texts.length - 1] += ` ${text}`;
    else texts.push(text);
    open = !/[.!?]["')\]]?$/.test(text);
  }
  return texts.map(textEntry);
}

function titledEntry(
  { title, organization, location }: EntryHeadingFields,
  dates: string,
  bullets: string[] = []
): ResumeEntry {
  const entry: ResumeEntry = {
    id: crypto.randomUUID(),
    selected: true,
    bullets: bullets.map(newBullet),
  };
  if (title) entry.title = title;
  if (organization) entry.organization = organization;
  if (location) entry.location = location;
  if (dates) entry.dates = dates;
  return entry;
}

const DATE_WORDS = new RegExp(DATE_LIKE.source, 'gi');

/** Text that says when and nothing else: "Jan 2021 – Present", "2019 - 2021". */
const isOnlyDates = (text: string) =>
  DATE_LIKE.test(text) && !/\p{L}/u.test(text.replace(DATE_WORDS, ''));

/** Between words and the dates written after them: a dash, a bar, or a dot. */
const BEFORE_DATES = /\s+[—–|·-]\s+/g;

/**
 * A line's left side and its dates, when nothing sat on its right: dates written after it
 * ("Acme Corp — Jan 2021 – Present"), or a line that is only dates, come apart from it.
 */
function splitTrailingDates([text, dates]: [string, string]): [string, string] {
  if (dates || !text) return [text, dates];
  if (isOnlyDates(text)) return ['', text];
  for (const separator of text.matchAll(BEFORE_DATES)) {
    const words = text.slice(0, separator.index).trim();
    const after = text.slice(separator.index + separator[0].length).trim();
    if (words && isOnlyDates(after)) return [words, after];
  }
  return [text, dates];
}

/** A one-line entry: its parts as the reader found them, or as its left side splits. */
function lineEntry(line: ImportLine, marked: boolean): ResumeEntry {
  if (line.fields) return titledEntry(line.fields, titleOf(line, marked)[1]);
  const [heading, dates] = splitTrailingDates(titleOf(line, marked));
  return titledEntry(splitEntryHeading(heading), dates);
}

/**
 * An entries section: each block is an entry — its line, maybe more lines under it, then
 * bullets. A line under the first is more of the left side ("Acme Corp, Detroit" under a
 * job title), and anything on its right more of the dates.
 */
function parseEntrySection(body: ImportLine[], marked: boolean): ResumeEntry[] {
  const entries: ResumeEntry[] = [];

  for (const block of splitBlocks(body, marked)) {
    const headerLines = block.filter((line) => line.role !== 'bullet');
    const bullets = block
      .filter((line) => line.role === 'bullet')
      .map((line) => line.text)
      .filter(Boolean);

    // A block of only unmarked lines with no bullets is a list (e.g. certifications):
    // an entry per line.
    const plainList = headerLines.every((line) => line.role === undefined);
    if (bullets.length === 0 && headerLines.length > 1 && plainList) {
      for (const line of headerLines) {
        if (line.text || line.aside) entries.push(lineEntry(line, marked));
      }
      continue;
    }

    const [first, ...rest] = headerLines;
    const firstParts: [string, string] = first ? titleOf(first, marked) : ['', ''];
    const parts = [
      // The reader's own parts stand as they are.
      first?.fields ? firstParts : splitTrailingDates(firstParts),
      ...rest.map((line) => splitTrailingDates([line.text, line.aside ?? ''])),
    ];
    const left = parts.map(([text]) => text).filter(Boolean);
    const dates = parts
      .map(([, aside]) => aside)
      .filter(Boolean)
      .join(' — ');
    if (left.length === 0 && !dates && bullets.length === 0) continue;
    const fields =
      first?.fields && rest.length === 0
        ? first.fields
        : splitEntryHeading(left.join(ENTRY_HEADING_SEPARATOR));
    entries.push(titledEntry(fields, dates, bullets));
  }

  return entries;
}

/**
 * A section's shape from its marks: entries when a line is an entry's — marked as one, or
 * with dates beside it. Bullets alone are a list. Plain text marks no entries, so
 * there its bullets, or a "heading | dates" line, make them.
 */
function layoutOf(body: ImportLine[], marked: boolean): SectionLayout {
  const entryLine = marked
    ? (line: ImportLine) => line.role === 'entry' || Boolean(line.aside)
    : (line: ImportLine) => line.role === 'bullet' || line.text.includes(TITLE_SEPARATOR);
  return body.some(entryLine) ? 'entries' : 'lines';
}

/**
 * Build a resume from lines. Lines before the first heading are the contact block; each
 * heading starts a section — a built-in kind when its words are a name Mosaic knows,
 * otherwise a custom section keeping the heading as its name. Imperfect by design: the
 * import dialog shows what was found before anything is written.
 */
export function parseResumeLines(
  lines: ImportLine[],
  { marked = true }: ParseOptions = {}
): ParsedResume {
  const warnings: string[] = [];
  const headings = lines.flatMap((line, index) => (line.role === 'heading' ? [index] : []));
  const contactEnd = headings[0] ?? lines.length;

  // The contact block makes its links into header items; anywhere else, a link reads as its
  // words and then its address.
  const preamble = lines
    .slice(0, contactEnd)
    .flatMap((line) => textsOf(line).map((text) => ({ text, align: line.align })));
  lines = lines.map((line, index) =>
    index < contactEnd
      ? line
      : {
          ...line,
          text: replaceMarkedLinksWithText(line.text),
          ...(line.aside !== undefined && { aside: replaceMarkedLinksWithText(line.aside) }),
          ...(line.fields && {
            fields: {
              title: replaceMarkedLinksWithText(line.fields.title),
              organization: replaceMarkedLinksWithText(line.fields.organization),
              location: replaceMarkedLinksWithText(line.fields.location),
            },
          }),
        }
  );
  const fullText = lines.flatMap(textsOf).map(replaceMarkedLinksWithText).join('\n');
  const contact = parseContact(preamble, fullText, marked);
  const leftOut: string[] = [];

  const sections: ResumeSection[] = [];
  headings.forEach((index, i) => {
    const body = lines.slice(index + 1, headings[i + 1] ?? lines.length);
    const known = matchSectionHeader(lines[index].text);
    const kind: SectionKind = known ?? 'custom';
    const layout = known && !marked ? SECTION_PRESETS[known].layout : layoutOf(body, marked);
    const items =
      layout === 'lines'
        ? parseLineSection(body, !marked && kind === 'summary')
        : parseEntrySection(body, marked);
    if (items.length === 0) {
      leftOut.push(lines[index].text);
      return;
    }
    sections.push({
      id: crypto.randomUUID(),
      kind,
      layout,
      // The heading as written, so a resume keeps its own names ("Work History").
      label: lines[index].text,
      order: sections.length,
      items,
    });
  });

  if (sections.length === 0) {
    warnings.push(
      'No recognizable resume sections were found. Make sure section headings like "Experience", "Education", or "Skills" are on their own lines.'
    );
  }
  if (!contact.name) {
    warnings.push('Could not detect a name — add it after importing.');
  }

  return {
    resume: { schemaVersion: 1, contact, sections },
    warnings,
    leftOut,
  };
}

/** Pasted or typed text: its lines as the author broke them. */
export function parseResumeText(input: string): ParsedResume {
  return parseResumeLines(textToLines(input), { marked: false });
}
