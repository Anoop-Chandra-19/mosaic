/**
 * Section category used for icons, import heading matching, JSON Resume mapping, and
 * assistant context. It does not control the printed layout; `SectionLayout` does.
 * Built-in kinds are defined in `src/shared/resume/sectionPresets.ts`.
 * `custom` is a user-defined category.
 */
export type SectionKind =
  | 'summary'
  | 'education'
  | 'experience'
  | 'internships'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'volunteering'
  | 'awards'
  | 'publications'
  | 'languages'
  | 'interests'
  | 'custom';

export type BuiltInSectionKind = Exclude<SectionKind, 'custom'>;

/**
 * Printed layout for section items. `lines` uses each item's plain `text`, as in a summary
 * or skills list. `entries` uses an italic heading with title, organization, and location
 * on the left and dates on the right, followed by bullets.
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
  /** Role, qualification, or project name, such as "Analyst" or "M.S. in Physics". */
  title?: string;
  /** Company, school, or issuing organization. */
  organization?: string;
  location?: string;
  /** Free-form date text, such as "Jan 2021 to Current" or "2025", printed on the right. */
  dates?: string;
  /** Item text for a section with `layout: 'lines'`. */
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
  /**
   * Excludes the section from the preview, content exports, and word count without deleting
   * its data. Backups keep the full section. Omitted means visible. Entry `selected` values
   * are preserved, so showing the section again restores the previous selection.
   */
  hidden?: boolean;
}

/**
 * Header category used for the editor icon and placeholder, JSON Resume mapping, and
 * import matching. Printed content and links use the item's own text and URL, not its kind.
 * Built-in kinds are defined in `src/shared/resume/resumeHeader.ts`.
 * `custom` is a user-defined category.
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

/** Header link color: black like the page text, or blue. Does not affect other text. */
export type LinkColor = 'ink' | 'blue';

export interface HeaderItem {
  id: string;
  kind: HeaderItemKind;
  /** Printed text. Empty text hides the item and its link without deleting the URL. */
  text: string;
  /** URL as typed by the user. Exports derive the link destination from this value. */
  url: string;
  /** When false, hides the item without deleting its data. */
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
  /** Defaults to `ink` when omitted. */
  linkColor?: LinkColor;
  lines: HeaderLine[];
}

/** Page header: the name followed by the contact lines. */
export interface ContactInfo {
  name: string;
  header: ResumeHeader;
}

export interface ResumeData {
  schemaVersion: number;
  contact: ContactInfo;
  sections: ResumeSection[];
}
