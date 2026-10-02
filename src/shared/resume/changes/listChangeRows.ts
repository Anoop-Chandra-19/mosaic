import type {
  ContactInfo,
  HeaderItemKind,
  ResumeData,
  ResumeEntry,
  ResumeSection,
} from '../../types/resume';
import { formatEntryHeading } from '../entryHeading';
import type { ChangeLine, EntryField } from './resumeChange';

export interface ChangeRow {
  key: string;
  line: ChangeLine;
  text: string;
  isPrinted: boolean;
  /** Emptied, a thing is gone rather than left off the page. */
  hasText: boolean;
  field?: EntryField;
  itemKind?: HeaderItemKind;
  sectionId: string | null;
  entryId: string | null;
  bulletId: string | null;
  where: string;
  label?: string;
  n?: number | null;
}

const ENTRY_FIELDS: EntryField[] = ['title', 'organization', 'location', 'dates'];

const trim = (value: string | undefined) => (value ?? '').trim();

const IN_HEADER = { sectionId: null, entryId: null, bulletId: null, where: 'Header' };

function listHeaderRows(contact: ContactInfo): ChangeRow[] {
  const nameRow: ChangeRow = {
    key: 'name',
    line: 'name',
    text: trim(contact.name),
    isPrinted: true,
    hasText: true,
    ...IN_HEADER,
  };
  const itemRows = contact.header.lines.flatMap((line) =>
    line.items.map((item): ChangeRow => {
      const text = trim(item.text);
      return {
        key: `item:${item.id}`,
        line: 'item',
        itemKind: item.kind,
        text,
        isPrinted: item.shown && !!text,
        hasText: !!text,
        ...IN_HEADER,
      };
    })
  );
  return [nameRow, ...itemRows];
}

interface SectionPlace {
  section: ResumeSection;
  label: string;
  isOn: boolean;
}

/** The app's summary is a text-only section, so each of its lines diffs word by word. */
function listTextLineRows({ section, label, isOn }: SectionPlace): ChangeRow[] {
  const line = section.kind === 'summary' ? 'summary' : 'text';
  let printedCount = 0;
  return section.items.map((entry) => {
    const text = trim(entry.text);
    const isPrinted = isOn && entry.selected && !!text;
    if (isPrinted) printedCount++;
    const isSummary = line === 'summary';
    return {
      key: `entry:${entry.id}`,
      line,
      text,
      isPrinted,
      hasText: !!text,
      sectionId: section.id,
      entryId: entry.id,
      bulletId: null,
      where: isSummary ? label : `${label} › line ${printedCount}`,
      label: isSummary ? 'Summary' : `${label}, line ${printedCount}`,
      n: isPrinted ? printedCount : null,
    };
  });
}

/** An entry's heading, each of its four fields, and its bullets. */
function listEntryRows({ section, label, isOn }: SectionPlace, entry: ResumeEntry): ChangeRow[] {
  const isEntryOn = isOn && entry.selected;
  const fields: Record<EntryField, string> = {
    title: trim(entry.title),
    organization: trim(entry.organization),
    location: trim(entry.location),
    dates: trim(entry.dates),
  };
  const heading = formatEntryHeading(fields);
  const entryName = fields.title || fields.organization;
  const where = entryName ? `${label} › ${entryName}` : label;
  const inEntry = { sectionId: section.id, entryId: entry.id, bulletId: null, where };
  const bullets = entry.bullets.map((bullet) => {
    const text = trim(bullet.text);
    return { id: bullet.id, text, isPrinted: isEntryOn && bullet.selected && !!text };
  });

  const entryRow: ChangeRow = {
    key: `entry:${entry.id}`,
    line: 'entry',
    text: fields.dates ? `${heading}  ·  ${fields.dates}` : heading,
    label: entryName || heading || label,
    isPrinted:
      isEntryOn && !!(heading || fields.dates || bullets.some((bullet) => bullet.isPrinted)),
    hasText: !!(heading || fields.dates || bullets.some((bullet) => bullet.text)),
    ...inEntry,
  };
  const fieldRows = ENTRY_FIELDS.map(
    (field): ChangeRow => ({
      key: `${field}:${entry.id}`,
      line: 'field',
      field,
      text: fields[field],
      isPrinted: isEntryOn,
      hasText: true,
      ...inEntry,
    })
  );
  let printedCount = 0;
  const bulletRows = bullets.map((bullet): ChangeRow => {
    if (bullet.isPrinted) printedCount++;
    return {
      key: `bullet:${bullet.id}`,
      line: 'bullet',
      text: bullet.text,
      isPrinted: bullet.isPrinted,
      hasText: !!bullet.text,
      ...inEntry,
      bulletId: bullet.id,
      where: `${where} › bullet ${printedCount}`,
      n: bullet.isPrinted ? printedCount : null,
    };
  });
  return [entryRow, ...fieldRows, ...bulletRows];
}

function listSectionRows(section: ResumeSection): ChangeRow[] {
  const place = { section, label: trim(section.label), isOn: !section.hidden };
  const sectionRow: ChangeRow = {
    key: `section:${section.id}`,
    line: 'section',
    text: place.label,
    isPrinted: place.isOn,
    hasText: true,
    sectionId: section.id,
    entryId: null,
    bulletId: null,
    where: place.label,
  };
  const contentRows =
    section.layout === 'lines'
      ? listTextLineRows(place)
      : section.items.flatMap((entry) => listEntryRows(place, entry));
  return [sectionRow, ...contentRows];
}

/**
 * Every field of a resume in page order. Rows are listed whether they print or not, so a
 * diff can tell left off from deleted.
 */
export function listChangeRows(resume: ResumeData): ChangeRow[] {
  const sections = [...resume.sections].sort((a, b) => a.order - b.order);
  return [...listHeaderRows(resume.contact), ...sections.flatMap(listSectionRows)];
}
