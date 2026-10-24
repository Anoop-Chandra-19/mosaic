import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { Bullet, ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { handleFor, type ResumeHandles } from './resumeHandles';

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
 */

function formatText(handle: string, isShown: boolean, text: string): string {
  const hiddenNote = isShown ? '' : ' (hidden)';
  return `- ${handle}${hiddenNote}: ${text}`;
}

function formatBullet(handles: ResumeHandles, bullet: Bullet): string {
  return formatText(handleFor(handles, 'bullet', bullet.id), bullet.selected, bullet.text);
}

/** A lines section's item, which holds its text where an entry holds bullets. */
function formatLine(handles: ResumeHandles, line: ResumeEntry): string {
  return formatText(handleFor(handles, 'line', line.id), line.selected, line.text ?? '');
}

function formatEntry(handles: ResumeHandles, entry: ResumeEntry): string[] {
  const heading = [formatEntryHeading(entry), entry.dates?.trim()].filter(Boolean).join(' · ');
  const offPageNote = entry.selected ? '' : ' (off the page)';
  const handle = handleFor(handles, 'entry', entry.id);
  return [
    `### ${heading || 'Untitled entry'}${offPageNote} (${handle})`,
    ...entry.bullets.map((bullet) => formatBullet(handles, bullet)),
  ];
}

function formatSection(handles: ResumeHandles, section: ResumeSection): string[] {
  const hiddenNote = section.hidden ? ' (hidden section)' : '';
  const heading = `## ${section.label}${hiddenNote} (${handleFor(handles, 'section', section.id)})`;
  const items =
    section.layout === 'lines'
      ? section.items.map((line) => formatLine(handles, line))
      : section.items.flatMap((entry) => formatEntry(handles, entry));
  return [heading, ...items];
}

export function formatResumeForModel(doc: ResumeData, handles: ResumeHandles): string {
  const sectionsInOrder = [...doc.sections].sort((a, b) => a.order - b.order);
  const nameLine = `Name: ${doc.contact.name.trim() || '(none)'}`;
  const sectionBlocks = sectionsInOrder.map((section) =>
    formatSection(handles, section).join('\n')
  );
  return [nameLine, ...sectionBlocks].join('\n\n');
}
