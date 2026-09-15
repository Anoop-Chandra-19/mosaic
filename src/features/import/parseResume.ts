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
const PHONE_RE = /(\(?\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /\b((?:https?:\/\/)?[\w-]+\.[\w.-]+(?:\/[\w#%&./=?~+-]*)?)\b/gi;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w#%&./=?~+-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w#%&./=?~+-]+/i;
const LOCATION_RE = /^[A-Za-z][\w.\s'-]+,\s*[A-Za-z][\w.\s'-]+$/;

interface ParseOptions {
  /**
   * The source marks its lines itself — entries, bullets, headings — and gives one logical
   * line per item (a DOCX, a PDF, Mosaic's Markdown). A section's shape then comes from its
   * marks. Off for plain text, whose lines are as the author broke them: the shape comes
   * from the heading's name, and a summary's lines join into one paragraph.
   */
  marked?: boolean;
}

function newBullet(text: string): Bullet {
  return { id: crypto.randomUUID(), text: text.trim(), selected: true };
}

/** A section body split where an entry starts: at a gap, or at a line marked as one. */
function splitBlocks(lines: ImportLine[]): ImportLine[][] {
  const blocks: ImportLine[][] = [];
  let current: ImportLine[] = [];
  for (const line of lines) {
    if ((line.gapBefore || line.role === 'entry') && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function parseContact(preamble: string[], fullText: string): ContactInfo {
  const contact: ContactInfo = { ...EMPTY_CONTACT };
  const joined = preamble.join('\n');
  const source = joined.trim() ? joined : fullText;

  contact.email = source.match(EMAIL_RE)?.[0] ?? '';
  contact.phone = (source.match(PHONE_RE)?.[0] ?? '').trim();
  contact.linkedin = (source.match(LINKEDIN_RE)?.[0] ?? '').replace(/^https?:\/\//, '');
  contact.github = (source.match(GITHUB_RE)?.[0] ?? '').replace(/^https?:\/\//, '');

  // Remove the email and known profile URLs first, so a generic-website scan can't
  // pick up a fragment of the email (e.g. "jane.dev" from "jane.dev@example.com").
  const scrubbed = source
    .replace(new RegExp(EMAIL_RE.source, 'g'), ' ')
    .replace(new RegExp(LINKEDIN_RE.source, 'gi'), ' ')
    .replace(new RegExp(GITHUB_RE.source, 'gi'), ' ');
  const website = (scrubbed.match(URL_RE) ?? []).find((url) => !EMAIL_RE.test(url));
  contact.website = website ? website.replace(/^https?:\/\//, '') : '';

  for (const line of preamble) {
    if (LOCATION_RE.test(line) && !EMAIL_RE.test(line)) {
      contact.location = line;
      break;
    }
  }

  // Name: first preamble line that is not itself contact data.
  for (const line of preamble) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || /https?:\/\/|\.\w{2,}\//.test(line)) continue;
    if (line === contact.location) continue;
    contact.name = line;
    break;
  }

  return contact;
}

/** Contact-block lines that none of the contact's fields came from. */
function unusedContactLines(preamble: string[], contact: ContactInfo): string[] {
  const values = Object.values(contact).filter(
    (value): value is string => typeof value === 'string' && value !== ''
  );
  return preamble.filter((line) => line.trim() && !values.some((value) => line.includes(value)));
}

function textEntry(text: string): ResumeEntry {
  return { id: crypto.randomUUID(), selected: true, text, bullets: [] };
}

/** A lines section: one item per line — or, for a wrapped summary, one for all of it. */
function parseLineSection(body: ImportLine[], joinAll: boolean): ResumeEntry[] {
  const texts = body.map((line) => line.text).filter(Boolean);
  if (!joinAll) return texts.map(textEntry);
  const text = texts.join(' ').trim();
  return text ? [textEntry(text)] : [];
}

/** An entries section: each block is an entry — a title line, maybe a subtitle, bullets. */
function parseEntrySection(body: ImportLine[]): ResumeEntry[] {
  const entries: ResumeEntry[] = [];

  for (const block of splitBlocks(body)) {
    const headerLines = block.filter((line) => line.role !== 'bullet');
    const bullets = block
      .filter((line) => line.role === 'bullet')
      .map((line) => line.text)
      .filter(Boolean);

    // A block of only unmarked lines with no bullets is a list (e.g. certifications):
    // one title-only entry per line.
    const plainList = headerLines.every((line) => line.role === undefined && !line.aside);
    if (bullets.length === 0 && headerLines.length > 1 && plainList) {
      for (const { text } of headerLines) {
        if (text)
          entries.push({ id: crypto.randomUUID(), selected: true, title: text, bullets: [] });
      }
      continue;
    }

    const [first, ...rest] = headerLines;
    const title = first?.text ?? '';
    const subtitle = [first?.aside, ...rest.map((line) => line.text)].filter(Boolean).join(' — ');
    if (!title && !subtitle && bullets.length === 0) continue;

    const entry: ResumeEntry = {
      id: crypto.randomUUID(),
      selected: true,
      bullets: bullets.map(newBullet),
    };
    if (title) entry.title = title;
    if (subtitle) entry.subtitle = subtitle;
    entries.push(entry);
  }

  return entries;
}

/** A section's shape from its marks: entries if anything is an entry line or a bullet. */
function layoutOf(body: ImportLine[]): SectionLayout {
  return body.some((line) => line.role === 'bullet' || line.role === 'entry' || line.aside)
    ? 'entries'
    : 'lines';
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

  const preamble = lines.slice(0, headings[0] ?? lines.length).map((line) => line.text);
  const contact = parseContact(preamble, lines.map((line) => line.text).join('\n'));
  const leftOut = unusedContactLines(preamble, contact);

  const sections: ResumeSection[] = [];
  headings.forEach((index, i) => {
    const body = lines.slice(index + 1, headings[i + 1] ?? lines.length);
    const known = matchSectionHeader(lines[index].text);
    const kind: SectionKind = known ?? 'custom';
    const layout = known && !marked ? SECTION_PRESETS[known].layout : layoutOf(body);
    const items =
      layout === 'lines'
        ? parseLineSection(body, !marked && kind === 'summary')
        : parseEntrySection(body);
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
