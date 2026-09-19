/**
 * What a section is about: its icon, the headings the importer matches to it, where JSON
 * Resume files it, and later what the assistant takes it to be. Never how it prints — that
 * is `SectionLayout`. The built-in kinds are presets (`lib/resume/sectionPresets.ts`);
 * `custom` is a section the user named.
 */
export type SectionKind =
  | 'summary'
  | 'education'
  | 'experience'
  | 'internships'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'custom';

export type BuiltInSectionKind = Exclude<SectionKind, 'custom'>;

/**
 * How a section's items print. `lines`: each item is a line of plain text (`text`), as in a
 * summary or a skills list. `entries`: each item is an italic line — its title,
 * organization, and location on the left, its dates on the right — followed by bullets.
 */
export type SectionLayout = 'lines' | 'entries';

export interface Bullet {
  id: string;
  text: string;
  selected: boolean;
}

export interface ResumeEntry {
  id: string;
  selected: boolean;
  bullets: Bullet[];
  /** What you were: "Analyst", "M.S. in Physics", a project's name. */
  title?: string;
  /** Where or for whom: a company, a school, an issuer. */
  organization?: string;
  location?: string;
  /** When, as written: "Jan 2021 to Current", "2025" — or whatever goes on the right. */
  dates?: string;
  /** A lines section's item. */
  text?: string;
  meta?: Record<string, string>;
}

export interface ResumeSection {
  id: string;
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  items: ResumeEntry[];
  order: number;
}

/**
 * What a header item is about: its icon and placeholder in the editor, where JSON Resume
 * files it, and what the importer took it for. Never how it prints or links — that is its
 * own text and link. The built-in kinds are presets (`lib/resume/resumeHeader.ts`);
 * `custom` is an item the user writes.
 */
export type HeaderItemKind =
  | 'phone'
  | 'email'
  | 'linkedin'
  | 'github'
  | 'site'
  | 'location'
  | 'auth'
  | 'custom';

export type BuiltInHeaderKind = Exclude<HeaderItemKind, 'custom'>;

export type HeaderSeparator = ' | ' | ' · ' | ' — ' | ' • ' | '    ';

export type HeaderAlign = 'center' | 'left';

/** How linked header text looks on the page: like the rest of the text, or underlined. */
export type LinkStyle = 'plain' | 'underline';

export interface HeaderItem {
  id: string;
  kind: HeaderItemKind;
  /** What prints. Empty prints nothing, and its link goes with it — but the link is kept. */
  text: string;
  /** Where it links, as typed. The link written into a file is derived from it. */
  url: string;
  /** false: kept, but left off the page. */
  shown: boolean;
}

export interface HeaderLine {
  id: string;
  separator: HeaderSeparator;
  align: HeaderAlign;
  items: HeaderItem[];
}

export interface ResumeHeader {
  linkStyle: LinkStyle;
  lines: HeaderLine[];
}

/** The top of the page: the name, then the header's lines. */
export interface ContactInfo {
  name: string;
  header: ResumeHeader;
}

export interface ResumeData {
  schemaVersion: number;
  contact: ContactInfo;
  sections: ResumeSection[];
}

export interface PendingTextAiChange {
  id: string;
  createdAt: string;
  target:
    | { kind: 'entry-text'; sectionId: string; entryId: string }
    | { kind: 'bullet-text'; sectionId: string; entryId: string; bulletId: string };
  before: string;
  after: string;
  reason?: string;
}

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  keyStorageMode: 'session' | 'keychain';
}
