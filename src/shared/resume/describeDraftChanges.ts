import type { Bullet, ResumeData, ResumeEntry, ResumeHeader, ResumeSection } from '../types/resume';

/*
 * What changed between two documents, as a phrase short enough for the history list:
 * "Edited 3 bullets in Experience". Everything is matched by id, so a rewritten bullet
 * reads as one edit rather than a delete and an add, and a bullet dragged to another
 * entry is neither.
 */

/** How many of one kind of thing changed, by the way it changed. */
interface Tally {
  added: number;
  removed: number;
  edited: number;
  /** Left off the page, without being deleted. */
  hidden: number;
  /** Put back on the page. */
  shown: number;
}

/** One thing to say, and how much of it happened. Bigger counts are worth saying first. */
interface Phrase {
  weight: number;
  text: string;
}

function emptyTally(): Tally {
  return { added: 0, removed: 0, edited: 0, hidden: 0, shown: 0 };
}

/** Where something sits, so a change can name its section and its whole can speak for it. */
interface PlacedEntry {
  entry: ResumeEntry;
  sectionId: string;
  sectionLabel: string;
}

interface PlacedBullet {
  bullet: Bullet;
  entryId: string;
  sectionLabel: string;
}

interface DocumentIndex {
  sections: Map<string, ResumeSection>;
  entries: Map<string, PlacedEntry>;
  bullets: Map<string, PlacedBullet>;
}

function indexDocument(doc: ResumeData): DocumentIndex {
  const index: DocumentIndex = { sections: new Map(), entries: new Map(), bullets: new Map() };
  for (const section of doc.sections) {
    index.sections.set(section.id, section);
    for (const entry of section.items) {
      index.entries.set(entry.id, { entry, sectionId: section.id, sectionLabel: section.label });
      for (const bullet of entry.bullets) {
        index.bullets.set(bullet.id, { bullet, entryId: entry.id, sectionLabel: section.label });
      }
    }
  }
  return index;
}

/** Everything about an entry but its bullets and whether it is on the page. */
function describeEntryFrame(entry: ResumeEntry): string {
  return [entry.title, entry.organization, entry.location, entry.dates, entry.text].join('\u0001');
}

/** Everything the header prints, in a form two headers can be compared by. */
function describeHeader(header: ResumeHeader): string {
  return [
    header.linkStyle,
    header.linkColor ?? 'ink',
    ...header.lines.map((line) =>
      [
        line.id,
        line.separator,
        line.align,
        ...line.items.map((item) =>
          [item.id, item.kind, item.text, item.url, item.shown].join('\u0001')
        ),
      ].join('\u0002')
    ),
  ].join('\u0003');
}

/** The ids the two lists have in common, in the order each one holds them. */
function sameOrder(before: { id: string }[], after: { id: string }[]): boolean {
  const kept = new Set(after.map((item) => item.id));
  const survived = new Set(before.map((item) => item.id));
  const was = before.filter((item) => kept.has(item.id)).map((item) => item.id);
  const now = after.filter((item) => survived.has(item.id)).map((item) => item.id);
  return was.join('\u0001') === now.join('\u0001');
}

function countVisibility(tally: Tally, wasShown: boolean, isShown: boolean): void {
  if (wasShown === isShown) return;
  if (isShown) tally.shown += 1;
  else tally.hidden += 1;
}

/** "a bullet", "3 bullets". */
function countOf(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : `${n} ${plural}`;
}

function tallyPhrases(tally: Tally, singular: string, plural: string): Phrase[] {
  const of = (n: number) => countOf(n, singular, plural);
  return [
    { weight: tally.edited, text: `edited ${of(tally.edited)}` },
    { weight: tally.added, text: `added ${of(tally.added)}` },
    { weight: tally.removed, text: `removed ${of(tally.removed)}` },
    { weight: tally.hidden, text: `left ${of(tally.hidden)} off` },
    { weight: tally.shown, text: `put ${of(tally.shown)} back` },
  ].filter((phrase) => phrase.weight > 0);
}

export interface DraftChanges {
  summary: string;
  section: string | null;
}

/**
 * A summary for an auto version: the two largest changes, and the section they happened
 * in when they all happened in one. Nothing recognizable changed reads as "Edited the
 * resume" rather than nothing at all, because the documents did differ.
 */
export function describeDraftChanges(before: ResumeData, after: ResumeData): DraftChanges {
  const was = indexDocument(before);
  const now = indexDocument(after);
  const sections = emptyTally();
  const entries = emptyTally();
  const bullets = emptyTally();
  let sectionsRenamed = 0;
  let sectionsReordered = false;
  let entriesReordered = false;
  let bulletsReordered = false;
  /** The sections that the entry and bullet changes happened in. */
  const touched = new Set<string>();

  for (const [id, section] of now.sections) {
    const old = was.sections.get(id);
    if (!old) {
      sections.added += 1;
      continue;
    }
    if (old.label !== section.label) sectionsRenamed += 1;
    countVisibility(sections, old.hidden !== true, section.hidden !== true);
    if (!sameOrder(old.items, section.items)) {
      entriesReordered = true;
      touched.add(section.label);
    }
  }
  for (const id of was.sections.keys()) if (!now.sections.has(id)) sections.removed += 1;
  if (
    !sameOrder(
      [...was.sections.values()].sort((a, b) => a.order - b.order),
      [...now.sections.values()].sort((a, b) => a.order - b.order)
    )
  ) {
    sectionsReordered = true;
  }

  // A whole that arrived or left speaks for its parts: the bullets of a new entry are
  // that entry, and counting them again would say twice what happened once.
  for (const [id, { entry, sectionId, sectionLabel }] of now.entries) {
    const old = was.entries.get(id);
    if (!old) {
      if (was.sections.has(sectionId)) {
        entries.added += 1;
        touched.add(sectionLabel);
      }
      continue;
    }
    const counted = entries.edited + entries.shown + entries.hidden;
    if (describeEntryFrame(old.entry) !== describeEntryFrame(entry)) entries.edited += 1;
    countVisibility(entries, old.entry.selected, entry.selected);
    if (!sameOrder(old.entry.bullets, entry.bullets)) {
      bulletsReordered = true;
      touched.add(sectionLabel);
    }
    if (entries.edited + entries.shown + entries.hidden > counted) touched.add(sectionLabel);
  }
  for (const [id, { sectionId, sectionLabel }] of was.entries) {
    if (now.entries.has(id) || !now.sections.has(sectionId)) continue;
    entries.removed += 1;
    touched.add(sectionLabel);
  }

  for (const [id, { bullet, entryId, sectionLabel }] of now.bullets) {
    const old = was.bullets.get(id);
    if (!old) {
      if (was.entries.has(entryId)) {
        bullets.added += 1;
        touched.add(sectionLabel);
      }
      continue;
    }
    const counted = bullets.edited + bullets.shown + bullets.hidden;
    if (old.bullet.text !== bullet.text) bullets.edited += 1;
    countVisibility(bullets, old.bullet.selected, bullet.selected);
    if (bullets.edited + bullets.shown + bullets.hidden > counted) touched.add(sectionLabel);
  }
  for (const [id, { entryId, sectionLabel }] of was.bullets) {
    if (now.bullets.has(id) || !now.entries.has(entryId)) continue;
    bullets.removed += 1;
    touched.add(sectionLabel);
  }

  const nameEdited = before.contact.name !== after.contact.name;
  const headerEdited =
    describeHeader(before.contact.header) !== describeHeader(after.contact.header);
  const structural =
    nameEdited ||
    headerEdited ||
    sectionsRenamed > 0 ||
    sectionsReordered ||
    sections.added + sections.removed + sections.hidden + sections.shown > 0;

  const phrases: Phrase[] = [
    ...(nameEdited ? [{ weight: 1, text: 'changed the name' }] : []),
    ...(headerEdited ? [{ weight: 1, text: 'edited the header' }] : []),
    ...tallyPhrases(sections, 'a section', 'sections'),
    ...(sectionsRenamed > 0
      ? [
          {
            weight: sectionsRenamed,
            text: `renamed ${countOf(sectionsRenamed, 'a section', 'sections')}`,
          },
        ]
      : []),
    ...(sectionsReordered ? [{ weight: 1, text: 'reordered the sections' }] : []),
    ...tallyPhrases(entries, 'an entry', 'entries'),
    ...(entriesReordered ? [{ weight: 1, text: 'reordered entries' }] : []),
    ...tallyPhrases(bullets, 'a bullet', 'bullets'),
    ...(bulletsReordered ? [{ weight: 1, text: 'reordered bullets' }] : []),
  ];
  if (phrases.length === 0) return { summary: 'Edited the resume', section: null };

  const [label] = touched;
  const section = !structural && touched.size === 1 && label !== '' ? label : null;
  const said = phrases
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((phrase) => phrase.text)
    .join(', ');
  const scope = section === null ? '' : ` in ${section}`;
  return { summary: `${said[0].toUpperCase()}${said.slice(1)}${scope}`, section };
}
