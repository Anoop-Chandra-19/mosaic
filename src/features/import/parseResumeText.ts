import type { Bullet, ContactInfo, ResumeData, ResumeEntry, ResumeSection } from '@/types/resume';
import { SECTION_LABELS, matchSectionHeader } from './sectionHeaders';

export interface ParsedResume {
  resume: ResumeData;
  warnings: string[];
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
const BULLET_RE = /^\s*(?:[•·▪◦‣∙*+–—-]|\d+[.)])\s+/;

function newBullet(text: string): Bullet {
  return { id: crypto.randomUUID(), text: text.trim(), selected: true };
}

function stripBulletMarker(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

function isBulletLine(line: string): boolean {
  return BULLET_RE.test(line);
}

/** Split a section body into blocks separated by one or more blank lines. */
function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
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

  for (const raw of preamble) {
    const line = raw.trim();
    if (line && LOCATION_RE.test(line) && !EMAIL_RE.test(line)) {
      contact.location = line;
      break;
    }
  }

  // Name: first preamble line that is not itself contact data.
  for (const raw of preamble) {
    const line = raw.trim();
    if (!line) continue;
    if (EMAIL_RE.test(line) || PHONE_RE.test(line) || /https?:\/\/|\.\w{2,}\//.test(line)) continue;
    if (line === contact.location) continue;
    contact.name = line;
    break;
  }

  return contact;
}

function parseSummarySection(body: string[]): ResumeEntry[] {
  const text = body
    .map((line) => stripBulletMarker(line).trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!text) return [];
  return [{ id: crypto.randomUUID(), selected: true, text, bullets: [] }];
}

function parseSkillsSection(body: string[]): ResumeEntry[] {
  return body
    .map((line) => stripBulletMarker(line).trim())
    .filter(Boolean)
    .map((text) => ({ id: crypto.randomUUID(), selected: true, text, bullets: [] }));
}

/** Experience/education/projects/internships/certifications: block = entry. */
function parseEntrySection(body: string[]): ResumeEntry[] {
  const entries: ResumeEntry[] = [];

  for (const block of splitBlocks(body)) {
    const headerLines = block.filter((line) => !isBulletLine(line)).map((line) => line.trim());
    const bulletLines = block.filter(isBulletLine).map(stripBulletMarker).filter(Boolean);

    // A block of only header lines with no bullets is a list (e.g. certifications):
    // emit one title-only entry per line.
    if (bulletLines.length === 0 && headerLines.length > 1) {
      for (const title of headerLines) {
        if (title) entries.push({ id: crypto.randomUUID(), selected: true, title, bullets: [] });
      }
      continue;
    }

    const [title, ...restHeader] = headerLines;
    if (!title && bulletLines.length === 0) continue;

    const entry: ResumeEntry = {
      id: crypto.randomUUID(),
      selected: true,
      bullets: bulletLines.map(newBullet),
    };
    if (title) entry.title = title;
    if (restHeader.length) entry.subtitle = restHeader.join(' — ');

    entries.push(entry);
  }

  return entries;
}

function buildSectionEntries(type: ResumeSection['type'], body: string[]): ResumeEntry[] {
  if (type === 'summary') return parseSummarySection(body);
  if (type === 'skills') return parseSkillsSection(body);
  return parseEntrySection(body);
}

/**
 * Heuristically parse pasted plain-text resume content into Mosaic's ResumeData shape.
 * Pure and deterministic apart from generated ids. Imperfect by design — the import UI
 * shows a review step so the user can correct the mapping before applying.
 */
export function parseResumeText(input: string): ParsedResume {
  const warnings: string[] = [];
  const lines = input.replace(/\r\n?/g, '\n').split('\n');

  // Locate section headers.
  const headers: { index: number; type: ResumeSection['type'] }[] = [];
  lines.forEach((line, index) => {
    const type = matchSectionHeader(line);
    if (type) headers.push({ index, type });
  });

  const firstHeaderIndex = headers.length ? headers[0].index : lines.length;
  const preamble = lines.slice(0, firstHeaderIndex);
  const contact = parseContact(preamble, input);

  const sections: ResumeSection[] = [];
  headers.forEach((header, i) => {
    const bodyStart = header.index + 1;
    const bodyEnd = i + 1 < headers.length ? headers[i + 1].index : lines.length;
    const body = lines.slice(bodyStart, bodyEnd);
    const items = buildSectionEntries(header.type, body);
    if (items.length === 0) return;
    sections.push({
      id: crypto.randomUUID(),
      type: header.type,
      label: SECTION_LABELS[header.type],
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
  };
}
