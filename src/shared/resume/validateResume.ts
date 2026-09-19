import type { ResumeData, SectionKind, SectionLayout } from '../types/resume';
import {
  BUILT_IN_HEADER_KINDS,
  HEADER_ALIGNS,
  HEADER_SEPARATORS,
  LINK_STYLES,
} from './resumeHeader';
import { BUILT_IN_KINDS } from './sectionPresets';

const SECTION_KINDS: ReadonlySet<string> = new Set<SectionKind>([...BUILT_IN_KINDS, 'custom']);
const SECTION_LAYOUTS: ReadonlySet<string> = new Set<SectionLayout>(['lines', 'entries']);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isBullet(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.selected === 'boolean'
  );
}

function isResumeEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.selected === 'boolean' &&
    Array.isArray(value.bullets) &&
    value.bullets.every(isBullet) &&
    isOptionalString(value.title) &&
    isOptionalString(value.organization) &&
    isOptionalString(value.location) &&
    isOptionalString(value.dates) &&
    isOptionalString(value.text)
  );
}

function isResumeSection(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    // Unknown kinds and layouts are refused: the icon and exports read the kind, and
    // everything that prints a section switches on its layout.
    typeof value.kind === 'string' &&
    SECTION_KINDS.has(value.kind) &&
    typeof value.layout === 'string' &&
    SECTION_LAYOUTS.has(value.layout) &&
    typeof value.order === 'number' &&
    (value.hidden === undefined || typeof value.hidden === 'boolean') &&
    Array.isArray(value.items) &&
    value.items.every(isResumeEntry)
  );
}

const HEADER_KIND_IDS: ReadonlySet<string> = new Set([...BUILT_IN_HEADER_KINDS, 'custom']);
const SEPARATORS: ReadonlySet<string> = new Set(HEADER_SEPARATORS.map((s) => s.value));
const ALIGNS: ReadonlySet<string> = new Set(HEADER_ALIGNS.map((a) => a.value));
const STYLES: ReadonlySet<string> = new Set(LINK_STYLES.map((s) => s.value));

const isOneOf = (value: unknown, allowed: ReadonlySet<string>) =>
  typeof value === 'string' && allowed.has(value);

function isHeaderItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isOneOf(value.kind, HEADER_KIND_IDS) &&
    typeof value.text === 'string' &&
    typeof value.url === 'string' &&
    typeof value.shown === 'boolean'
  );
}

function isHeaderLine(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isOneOf(value.separator, SEPARATORS) &&
    isOneOf(value.align, ALIGNS) &&
    Array.isArray(value.items) &&
    value.items.every(isHeaderItem)
  );
}

function isContact(value: unknown): boolean {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  const header = value.header;
  return (
    isRecord(header) &&
    isOneOf(header.linkStyle, STYLES) &&
    Array.isArray(header.lines) &&
    header.lines.every(isHeaderLine)
  );
}

/** Structural check for a ResumeData document read from outside the app (a file, IPC). */
export function isResumeData(value: unknown): value is ResumeData {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== 'number') return false;
  if (!isContact(value.contact)) return false;
  return Array.isArray(value.sections) && value.sections.every(isResumeSection);
}
