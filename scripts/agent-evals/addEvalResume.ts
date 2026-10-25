/**
 * The add eval's resume: just what the tools touch, with the handles the model reads, written
 * as `read_document` writes them. New things get the next handle of their kind, as the app's
 * run does.
 */
import type { SectionKind, SectionLayout } from '../../src/shared/types/resume.ts';

export interface EvalText {
  handle: string;
  text: string;
  isShown: boolean;
}

export interface EvalEntry {
  handle: string;
  /** "Backend Engineer, Harbor Freight Labs · 2021 to 2024", as the read writes it. */
  heading: string;
  isShown: boolean;
  bullets: EvalText[];
}

export interface EvalSection {
  handle: string;
  kind: SectionKind;
  layout: SectionLayout;
  label: string;
  isShown: boolean;
  lines: EvalText[];
  entries: EvalEntry[];
}

export interface EvalResume {
  name: string;
  sections: EvalSection[];
  /**
   * What the run has suggested so far: handles, and `order:` keys for a list's order. A call
   * that would leave one as it is is a repeat of the model's own work, not a mistake.
   */
  suggested?: string[];
}

const HANDLE_PREFIX = { section: 's', entry: 'e', bullet: 'b', line: 'l' } as const;

export type EvalHandleKind = keyof typeof HANDLE_PREFIX;

/** Every handle in the resume, in reading order. */
export function listEvalHandles(resume: EvalResume): string[] {
  return resume.sections.flatMap((section) => [
    section.handle,
    ...section.lines.map((line) => line.handle),
    ...section.entries.flatMap((entry) => [
      entry.handle,
      ...entry.bullets.map((bullet) => bullet.handle),
    ]),
  ]);
}

/** The next unused handle of a kind: after b4 comes b5. */
export function nextEvalHandle(resume: EvalResume, kind: EvalHandleKind): string {
  const prefix = HANDLE_PREFIX[kind];
  const numbers = listEvalHandles(resume)
    .filter((handle) => handle.startsWith(prefix))
    .map((handle) => Number(handle.slice(prefix.length)));
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

const formatText = ({ handle, text, isShown }: EvalText) =>
  `- ${handle}${isShown ? '' : ' (hidden)'}: ${text}`;

function formatSection(section: EvalSection): string {
  const hiddenNote = section.isShown ? '' : ' (hidden section)';
  const entries = section.entries.flatMap((entry) => [
    `### ${entry.heading}${entry.isShown ? '' : ' (off the page)'} (${entry.handle})`,
    ...entry.bullets.map(formatText),
  ]);
  return [
    `## ${section.label}${hiddenNote} (${section.handle})`,
    ...section.lines.map(formatText),
    ...entries,
  ].join('\n');
}

export function formatEvalResume(resume: EvalResume): string {
  return [`Name: ${resume.name}`, ...resume.sections.map(formatSection)].join('\n\n');
}
