import type { ContactInfo, ResumeData, ResumeEntry, ResumeSection } from '../../types/resume';
import { formatEntryHeading } from '../entryHeading';
import type { ChangeTarget, EntryField } from './resumeChange';

export interface ChangeRow {
  key: string;
  target: ChangeTarget;
  text: string;
  isPrinted: boolean;
  /** Emptied, a thing is gone rather than left off the page. */
  hasText: boolean;
  path: string;
  number: number | null;
  displayName?: string;
}

const ENTRY_FIELDS: EntryField[] = ['title', 'organization', 'location', 'dates'];

const trim = (value: string | undefined) => (value ?? '').trim();

function listHeaderRows(contact: ContactInfo): ChangeRow[] {
  const nameRow: ChangeRow = {
    key: 'name',
    target: { type: 'name' },
    text: trim(contact.name),
    isPrinted: true,
    hasText: true,
    path: 'Header',
    number: null,
  };
  const itemRows = contact.header.lines.flatMap((line) =>
    line.items.map((item): ChangeRow => {
      const text = trim(item.text);
      return {
        key: `item:${item.id}`,
        target: { type: 'headerItem', itemId: item.id, itemKind: item.kind },
        text,
        isPrinted: item.shown && !!text,
        hasText: !!text,
        path: 'Header',
        number: null,
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
  const isSummary = section.kind === 'summary';
  let printedCount = 0;
  return section.items.map((entry) => {
    const text = trim(entry.text);
    const isPrinted = isOn && entry.selected && !!text;
    if (isPrinted) printedCount++;
    return {
      key: `entry:${entry.id}`,
      target: {
        type: isSummary ? 'summaryLine' : 'textLine',
        sectionId: section.id,
        entryId: entry.id,
      },
      text,
      isPrinted,
      hasText: !!text,
      path: isSummary ? label : `${label} › line ${printedCount}`,
      number: isPrinted ? printedCount : null,
      displayName: isSummary ? 'Summary' : `${label}, line ${printedCount}`,
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
  const path = entryName ? `${label} › ${entryName}` : label;
  const ids = { sectionId: section.id, entryId: entry.id };
  const bullets = entry.bullets.map((bullet) => {
    const text = trim(bullet.text);
    return { id: bullet.id, text, isPrinted: isEntryOn && bullet.selected && !!text };
  });

  const entryRow: ChangeRow = {
    key: `entry:${entry.id}`,
    target: { type: 'entry', ...ids },
    text: fields.dates ? `${heading}  ·  ${fields.dates}` : heading,
    isPrinted:
      isEntryOn && !!(heading || fields.dates || bullets.some((bullet) => bullet.isPrinted)),
    hasText: !!(heading || fields.dates || bullets.some((bullet) => bullet.text)),
    path,
    number: null,
    displayName: entryName || heading || label,
  };
  const fieldRows = ENTRY_FIELDS.map(
    (field): ChangeRow => ({
      key: `${field}:${entry.id}`,
      target: { type: 'entryField', ...ids, field },
      text: fields[field],
      isPrinted: isEntryOn,
      hasText: true,
      path,
      number: null,
    })
  );
  let printedCount = 0;
  const bulletRows = bullets.map((bullet): ChangeRow => {
    if (bullet.isPrinted) printedCount++;
    return {
      key: `bullet:${bullet.id}`,
      target: { type: 'bullet', ...ids, bulletId: bullet.id },
      text: bullet.text,
      isPrinted: bullet.isPrinted,
      hasText: !!bullet.text,
      path: `${path} › bullet ${printedCount}`,
      number: bullet.isPrinted ? printedCount : null,
    };
  });
  return [entryRow, ...fieldRows, ...bulletRows];
}

function listSectionRows(section: ResumeSection): ChangeRow[] {
  const place = { section, label: trim(section.label), isOn: !section.hidden };
  const sectionRow: ChangeRow = {
    key: `section:${section.id}`,
    target: { type: 'section', sectionId: section.id },
    text: place.label,
    isPrinted: place.isOn,
    hasText: true,
    path: place.label,
    number: null,
    displayName: place.label,
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
