import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type { ResumeEntry, ResumeSection } from '@shared/types/resume';
import type { LeftOutLine } from './parsing/importLines';
import { removeRatingMarks, type ParsedResume } from './parsing/parseResume';
import { matchSectionHeader } from './parsing/sectionHeaders';

export type PlaceTarget = { sectionId: string } | 'new';

export interface ImportChoices {
  /** Ids of sections, entries, bullets, and line items. */
  dropped: ReadonlySet<string>;
  /** By index in `leftOut`. */
  placed: ReadonlyMap<number, PlaceTarget>;
}

export const newSectionNameFor = (line: LeftOutLine) => line.under ?? 'Other';

const placedText = (line: LeftOutLine) =>
  line.reason === 'rating-marks' ? removeRatingMarks(line.text) : line.text.trim();

/** In an entries section, the line becomes an entry's title. */
function placedItem(text: string, layout: ResumeSection['layout']): ResumeEntry {
  const item: ResumeEntry = { id: crypto.randomUUID(), selected: true, bullets: [] };
  if (layout === 'lines') item.text = text;
  else item.title = text;
  return item;
}

/** A known kind keeps its kind ("Skills"), when that kind holds lines. */
function newSection(label: string): ResumeSection {
  const known = matchSectionHeader(label);
  const kind = known && SECTION_PRESETS[known].layout === 'lines' ? known : 'custom';
  return { id: crypto.randomUUID(), kind, layout: 'lines', label, order: 0, items: [] };
}

/** A section left empty goes. Applied before `buildImportedResume`, so every mode agrees. */
export function applyImportChoices(
  parsed: ParsedResume,
  { dropped, placed }: ImportChoices
): ParsedResume {
  const sections = parsed.resume.sections
    .filter((section) => !dropped.has(section.id))
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !dropped.has(item.id))
        .map((item) => ({
          ...item,
          bullets: item.bullets.filter((bullet) => !dropped.has(bullet.id)),
        })),
    }));

  const made = new Map<string, ResumeSection>();
  parsed.leftOut.forEach((line, index) => {
    const target = placed.get(index);
    if (!target || !line.canPlace) return;
    const text = placedText(line);
    if (!text) return;
    if (target === 'new') {
      const name = newSectionNameFor(line);
      const section = made.get(name) ?? newSection(name);
      made.set(name, section);
      section.items.push(placedItem(text, 'lines'));
      return;
    }
    const section = sections.find(({ id }) => id === target.sectionId);
    section?.items.push(placedItem(text, section.layout));
  });

  return {
    ...parsed,
    resume: {
      ...parsed.resume,
      sections: [...sections, ...made.values()]
        .filter((section) => section.items.length > 0)
        .map((section, order) => ({ ...section, order })),
    },
    leftOut: parsed.leftOut.filter((line, index) => !(line.canPlace && placed.has(index))),
  };
}
