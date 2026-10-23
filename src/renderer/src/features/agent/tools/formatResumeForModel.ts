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
 * Lines sections (Summary, Skills) have no handles: nothing can change them yet.
 */

function formatBullet(handles: ResumeHandles, bullet: Bullet): string {
  const hiddenNote = bullet.selected ? '' : ' (hidden)';
  return `- ${handleFor(handles, 'bullet', bullet.id)}${hiddenNote}: ${bullet.text}`;
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
  if (section.layout === 'lines') {
    return [
      `## ${section.label}${hiddenNote} (lines, read only)`,
      ...section.items.map((line) => `- ${line.text ?? ''}`),
    ];
  }
  const handle = handleFor(handles, 'section', section.id);
  return [
    `## ${section.label}${hiddenNote} (${handle})`,
    ...section.items.flatMap((entry) => formatEntry(handles, entry)),
  ];
}

export function formatResumeForModel(doc: ResumeData, handles: ResumeHandles): string {
  const sectionsInOrder = [...doc.sections].sort((a, b) => a.order - b.order);
  const nameLine = `Name: ${doc.contact.name.trim() || '(none)'}`;
  const sectionBlocks = sectionsInOrder.map((section) =>
    formatSection(handles, section).join('\n')
  );
  return [nameLine, ...sectionBlocks].join('\n\n');
}
