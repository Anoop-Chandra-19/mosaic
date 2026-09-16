import { SECTION_PRESETS } from '@/lib/resume/sectionPresets';
import type {
  Bullet,
  ContactInfo,
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
   * Lines Mosaic read but found no place for — a headline under the name, a heading with
   * nothing under it — as they were in the file. The review step lists them, so nothing
   * is dropped without saying so.
   */
  leftOut: string[];
}

const EMPTY_CONTACT: ContactInfo = {
  name: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  github: '',
  website: '',
  showLinkedin: true,
  showGithub: true,
  showWebsite: true,
};

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
/** Between a contact line's fields: "a | b", "a · b", or a run of spaces. */
const FIELD_SEPARATOR = /\s+[|·•]\s+|\s{2,}/;

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

/**
 * The contact block's fields, one by one: Mosaic's own files write them as
 * "phone | email | links" and "status | location", and many resumes use the same shape.
 * Links are kept as written — Mosaic prints them as the person typed them.
 */
function parseContact(preamble: string[], fullText: string): ContactInfo {
  const contact: ContactInfo = { ...EMPTY_CONTACT };
  // With no contact block, the address and number can be anywhere.
  const source = preamble.join('\n').trim() ? preamble.join('\n') : fullText;
  contact.email = source.match(EMAIL_RE)?.[0] ?? '';
  contact.phone = (source.match(PHONE_RE)?.[0] ?? '').trim();
  contact.linkedin = source.match(LINKEDIN_RE)?.[0] ?? '';
  contact.github = source.match(GITHUB_RE)?.[0] ?? '';

  // Name: the first line that is one field and nothing else the block holds.
  contact.name =
    preamble.find(
      (line) =>
        fieldsOf(line).length === 1 &&
        !isReach(line) &&
        !STATUS_RE.test(line) &&
        !LOCATION_RE.test(line)
    ) ?? '';

  for (const line of preamble) {
    if (line === contact.name) continue;
    const rest: string[] = [];
    for (const field of fieldsOf(line)) {
      if (EMAIL_RE.test(field) || LINKEDIN_RE.test(field) || GITHUB_RE.test(field)) continue;
      const web = field.match(WEB_RE)?.[0];
      if (web) contact.website ||= web;
      else if (PHONE_RE.test(field)) continue;
      // A profile written as its name, the way the example resume has it.
      else if (/^linkedin\b/i.test(field)) contact.linkedin ||= field;
      else if (/^github\b/i.test(field)) contact.github ||= field;
      else rest.push(field);
    }
    const status = rest.find((field) => STATUS_RE.test(field));
    const location = rest.find((field) => field !== status && LOCATION_RE.test(field));
    // Two fields and one of them known: the other is the other one.
    const other = rest.length === 2 ? rest.find((field) => field !== (status ?? location)) : '';
    const foundStatus = status ?? (location ? other : '');
    const foundLocation = location ?? (status ? other : '');
    if (foundStatus && !contact.citizenshipStatus) contact.citizenshipStatus = foundStatus;
    if (foundLocation && !contact.location) contact.location = foundLocation;
  }

  return contact;
}

/** A word that only names a contact field whose value is beside it: "LinkedIn", "Phone:". */
const FIELD_LABEL =
  /^(?:linked-?in|github|gitlab|web(?:site|page)?|site|portfolio|e-?mail|mail|phone|mobile|tel(?:ephone)?|cell|address|location|profile)$/i;

/** What is left of a field once the contact values taken from it are removed. */
function remainderOf(field: string, values: string[]): string {
  let rest = field;
  for (const value of values) rest = rest.split(value).join(' ');
  const words = rest
    .split(/[\s|·•,;:/—–]+/)
    .filter((word) => word && !FIELD_LABEL.test(word.replace(/[.:]+$/, '')));
  const text = words.join(' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return /\p{L}{2}/u.test(text) ? text : '';
}

/**
 * Contact-block text that none of the contact's fields came from, field by field: a line
 * the contact took nothing from is left out whole, and in a line it took something from,
 * only the fields it didn't use — "ada@example.com | Open to relocation" imports the
 * address and leaves out the rest, rather than counting the whole line as read.
 */
function unusedContactText(preamble: string[], contact: ContactInfo): string[] {
  const values = Object.values(contact)
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .sort((a, b) => b.length - a.length);
  const unused: string[] = [];
  for (const line of preamble) {
    if (!line.trim()) continue;
    const fields = fieldsOf(line);
    if (!fields.some((field) => values.some((value) => field.includes(value)))) {
      unused.push(line.trim());
      continue;
    }
    for (const field of fields) {
      if (!values.some((value) => field.includes(value))) unused.push(field);
      else {
        const rest = remainderOf(field, values);
        if (rest) unused.push(rest);
      }
    }
  }
  return unused;
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
  const leftOut = unusedContactText(preamble, contact);

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
