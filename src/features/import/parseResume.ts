import { HEADER_SEPARATORS, createHeaderItem, createHeaderLine } from '@/lib/resume/resumeHeader';
import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import type {
  Bullet,
  ContactInfo,
  HeaderItemKind,
  HeaderLine,
  HeaderSeparator,
  ResumeData,
  ResumeEntry,
  ResumeSection,
  SectionKind,
  SectionLayout,
} from '@/types/resume';
import { textToLines, type ImportLine } from './importLines';
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
   * gives the shape, "title | subtitle" splits, a line after bullets starts the next entry,
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

/** Plain text's "Title | Subtitle", as Mosaic's text export writes an entry's first line. */
const TITLE_SEPARATOR = ' | ';

/** A line's title and subtitle: its aside, or in plain text what follows the last " | ". */
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
function kindOf(field: string): HeaderItemKind {
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
function separatorOf(line: string): HeaderSeparator {
  const mark = FIELD_SEPARATOR.exec(line)?.[0].trim();
  const known = HEADER_SEPARATORS.find(({ value }) => value.trim() === mark);
  return known?.value ?? HEADER_SEPARATORS[0].value;
}

/** "LinkedIn https://linkedin.com/in/ada": words, then the full address they stand for. */
const WORDS_THEN_ADDRESS = /^(.*\S)\s+((?:https?:\/\/|mailto:)\S+)$/i;

/** A contact field as an item: its words, and the address written after them as its link. */
function headerItemOf(field: string) {
  const [, words, address] = WORDS_THEN_ADDRESS.exec(field) ?? [];
  return createHeaderItem(kindOf(field), words ? { text: words, url: address } : { text: field });
}

/** A contact-block line as a header line: each field an item, kept as written. */
function headerLineOf(line: string): HeaderLine {
  const items = fieldsOf(line).map(headerItemOf);
  // Two fields and one of them a status or a place: the other is the other one.
  if (items.length === 2) {
    const kinds = items.map((item) => item.kind);
    const other = items.find((item) => item.kind === 'custom');
    if (other && kinds.includes('auth')) other.kind = 'location';
    else if (other && kinds.includes('location')) other.kind = 'auth';
  }
  return createHeaderLine(items, { separator: separatorOf(line) });
}

/**
 * The name and the header: the name is the block's first line that is one field and nothing
 * else a header holds, and every other line of the block is a header line — Mosaic's own
 * files write "phone | email | links" and "status | location", and many resumes the same.
 */
function parseContact(preamble: string[], fullText: string): ContactInfo {
  const nameAt = preamble.findIndex(
    (line) =>
      fieldsOf(line).length === 1 &&
      !isReach(line) &&
      !STATUS_RE.test(line) &&
      !LOCATION_RE.test(line)
  );
  const lines = preamble.filter((line, index) => index !== nameAt && line.trim()).map(headerLineOf);

  // With no contact block, the address and number can be anywhere.
  if (!preamble.some((line) => line.trim())) {
    const found = [EMAIL_RE, PHONE_RE, LINKEDIN_RE, GITHUB_RE]
      .map((re) => fullText.match(re)?.[0].trim() ?? '')
      .filter(Boolean);
    if (found.length > 0) {
      lines.push(createHeaderLine(found.map((text) => createHeaderItem(kindOf(text), { text }))));
    }
  }

  return {
    name: nameAt < 0 ? '' : preamble[nameAt].trim(),
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

function titledEntry(title: string, subtitle: string, bullets: string[] = []): ResumeEntry {
  const entry: ResumeEntry = {
    id: crypto.randomUUID(),
    selected: true,
    bullets: bullets.map(newBullet),
  };
  if (title) entry.title = title;
  if (subtitle) entry.subtitle = subtitle;
  return entry;
}

/** An entries section: each block is an entry — a title line, maybe a subtitle, bullets. */
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
        if (line.text || line.aside) entries.push(titledEntry(...titleOf(line, marked)));
      }
      continue;
    }

    const [first, ...rest] = headerLines;
    const [title, aside] = first ? titleOf(first, marked) : ['', ''];
    const subtitle = [aside, ...rest.flatMap(textsOf)].filter(Boolean).join(' — ');
    if (!title && !subtitle && bullets.length === 0) continue;
    entries.push(titledEntry(title, subtitle, bullets));
  }

  return entries;
}

/**
 * A section's shape from its marks: entries when a line is an entry's — marked as one, or
 * with a subtitle beside it. Bullets alone are a list. Plain text marks no entries, so
 * there its bullets, or a "title | subtitle" line, make them.
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

  const preamble = lines.slice(0, headings[0] ?? lines.length).flatMap(textsOf);
  const contact = parseContact(preamble, lines.flatMap(textsOf).join('\n'));
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
