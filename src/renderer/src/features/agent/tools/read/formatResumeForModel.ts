import { formatEntryHeading } from '@/lib/resume/entryHeading';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { handleFor, type ResumeHandles } from '../tool-run/resumeHandles';

/*
 * The resume as the model reads it, with a handle on everything it can change:
 *
 *   ## Experience (s1)
 *   ### Backend Engineer, Harbor Freight Labs · 2021 to 2024 (e1)
 *   - b1: Assisted in migrating billing to Postgres
 *   - b2 (hidden): Wrote the on-call runbook
 *
 *   ## Skills (s2)
 *   - l1: Go, Python, Postgres
 *
 * When the user's copy is passed as well, anything that differs from it is a waiting
 * suggestion. It is marked, and the user's text is shown on a `was:` line under it:
 *
 *   - b1 (suggested): Led the billing migration to Postgres
 *     was: Assisted in migrating billing to Postgres
 *   - b9 (suggested, new): Cut deploy time from 40 to 12 minutes
 */

/** One section, entry, line or bullet as the user's copy holds it. */
interface UserVersion {
  words: string;
  isShown: boolean;
  /** The text of the user's bullets that a waiting merge joined into this bullet. */
  mergedInTexts: string[];
}

interface ReadMarks {
  handles: ResumeHandles;
  /** The user's copy by id. Null when no user's copy was passed, so nothing is marked. */
  userVersions: Map<string, UserVersion> | null;
}

/** An entry's heading as the model reads it: "Backend Engineer, Harbor Freight Labs · 2021 to 2024". */
export function readEntryHeading(entry: ResumeEntry): string {
  const heading = [formatEntryHeading(entry), entry.dates?.trim()].filter(Boolean).join(' · ');
  return heading || 'Untitled entry';
}

function listTextIds(doc: ResumeData): Set<string> {
  const items = doc.sections.flatMap((section) => section.items);
  return new Set(items.flatMap((item) => [item.id, ...item.bullets.map((bullet) => bullet.id)]));
}

/**
 * Index the user's copy by id. Only a merge removes a bullet, so a bullet that is in the
 * user's copy but not in `doc` was merged into the bullet before it.
 */
function indexUserVersions(userCopy: ResumeData, doc: ResumeData): Map<string, UserVersion> {
  const idsNow = listTextIds(doc);
  const versions = new Map<string, UserVersion>();
  for (const section of userCopy.sections) {
    versions.set(section.id, {
      words: section.label,
      isShown: !section.hidden,
      mergedInTexts: [],
    });
    for (const item of section.items) {
      const words = section.layout === 'lines' ? (item.text ?? '') : readEntryHeading(item);
      versions.set(item.id, { words, isShown: item.selected, mergedInTexts: [] });
      let lastBulletStillThere: UserVersion | undefined;
      for (const bullet of item.bullets) {
        if (!idsNow.has(bullet.id)) {
          lastBulletStillThere?.mergedInTexts.push(bullet.text);
          continue;
        }
        lastBulletStillThere = { words: bullet.text, isShown: bullet.selected, mergedInTexts: [] };
        versions.set(bullet.id, lastBulletStillThere);
      }
    }
  }
  return versions;
}

/** How one item is marked: the notes after its handle, and the `was:` lines under it. */
interface SuggestedMark {
  notes: string[];
  wasLines: string[];
}

function markSuggested(
  { userVersions }: ReadMarks,
  id: string,
  words: string,
  isShown: boolean
): SuggestedMark {
  if (!userVersions) return { notes: [], wasLines: [] };
  const user = userVersions.get(id);
  if (!user) return { notes: ['suggested', 'new'], wasLines: [] };
  const userTexts = [];
  if (user.words !== words || user.mergedInTexts.length) {
    userTexts.push(user.words, ...user.mergedInTexts);
  }
  if (isShown && !user.isShown) userTexts.push('(hidden)');
  const isSuggested = userTexts.length > 0 || user.isShown !== isShown;
  return {
    notes: isSuggested ? ['suggested'] : [],
    wasLines: userTexts.map((text) => `  was: ${text}`),
  };
}

const formatNotes = (hiddenNote: string | null, mark: SuggestedMark) => {
  const notes = [hiddenNote, ...mark.notes].filter(Boolean);
  return notes.length ? ` (${notes.join(', ')})` : '';
};

function formatText(
  marks: ReadMarks,
  kind: 'bullet' | 'line',
  { id, text, selected }: { id: string; text?: string; selected: boolean }
): string[] {
  const mark = markSuggested(marks, id, text ?? '', selected);
  const notes = formatNotes(selected ? null : 'hidden', mark);
  return [`- ${handleFor(marks.handles, kind, id)}${notes}: ${text ?? ''}`, ...mark.wasLines];
}

function formatEntry(marks: ReadMarks, entry: ResumeEntry): string[] {
  const heading = readEntryHeading(entry);
  const mark = markSuggested(marks, entry.id, heading, entry.selected);
  const notes = formatNotes(entry.selected ? null : 'off the page', mark);
  const handle = handleFor(marks.handles, 'entry', entry.id);
  return [
    `### ${heading}${notes} (${handle})`,
    ...mark.wasLines,
    ...entry.bullets.flatMap((bullet) => formatText(marks, 'bullet', bullet)),
  ];
}

function formatSection(marks: ReadMarks, section: ResumeSection): string[] {
  const mark = markSuggested(marks, section.id, section.label, !section.hidden);
  const notes = formatNotes(section.hidden ? 'hidden section' : null, mark);
  const handle = handleFor(marks.handles, 'section', section.id);
  const items =
    section.layout === 'lines'
      ? section.items.flatMap((line) => formatText(marks, 'line', line))
      : section.items.flatMap((entry) => formatEntry(marks, entry));
  return [`## ${section.label}${notes} (${handle})`, ...mark.wasLines, ...items];
}

/**
 * Format `doc` for the model. `userCopy` is the draft with the kept suggestions applied.
 * When it is passed, anything in `doc` that differs from it is marked as suggested.
 */
export function formatResumeForModel(
  doc: ResumeData,
  handles: ResumeHandles,
  userCopy?: ResumeData
): string {
  const marks: ReadMarks = {
    handles,
    userVersions: userCopy ? indexUserVersions(userCopy, doc) : null,
  };
  const sectionsInOrder = [...doc.sections].sort((a, b) => a.order - b.order);
  const nameLine = `Name: ${doc.contact.name.trim() || '(none)'}`;
  const sectionBlocks = sectionsInOrder.map((section) => formatSection(marks, section).join('\n'));
  return [nameLine, ...sectionBlocks].join('\n\n');
}
