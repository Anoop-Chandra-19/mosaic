import { headerLineText } from '@/lib/resume/resumeHeader';
import type { ExportEntry, NormalizedResumeExport } from './normalizeResumeExport';

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * Text as Markdown shows it: whatever would read as markup is escaped, so a Markdown
 * viewer shows the text as typed and Mosaic's importer reads it back the same. An
 * underscore inside a word stays as it is ("first_last"); Markdown never reads it as
 * emphasis.
 */
function escapeInline(text: string): string {
  return text
    .replace(/[\\`*[<~]/g, '\\$&')
    .replace(/_/g, (mark, at: number, all: string) =>
      WORD_CHARACTER.test(all[at - 1] ?? '') && WORD_CHARACTER.test(all[at + 1] ?? '')
        ? mark
        : '\\_'
    );
}

/** A line of text that must not start a heading, a list, a quote, or a rule. */
function escapeLine(text: string): string {
  return escapeInline(text)
    .replace(/^(#{1,6}|[-+])(?=\s|$)/, '\\$1')
    .replace(/^>/, '\\>')
    .replace(/^(\d+)([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(?=(?:-\s*){3,}$)/, '\\');
}

/** A heading's words: a run of # at the end, after a space, would close the heading. */
function escapeHeading(text: string): string {
  return escapeInline(text).replace(/(^|\s)(#+)$/, '$1\\$2');
}

/**
 * An entry: its title as a heading, the subtitle on its own line in italics, then the
 * bullets. With no title, the subtitle is the heading (`### _2025_`).
 */
function entryLines({ title, subtitle, bullets }: ExportEntry): string[] {
  const italic = subtitle && `_${escapeInline(subtitle)}_`;
  const lines = title
    ? [`### ${escapeHeading(title)}`, ...(italic ? [italic] : [])]
    : [italic ? `### ${italic}` : '###'];
  return [...lines, ...bullets.map((bullet) => `- ${escapeLine(bullet)}`)];
}

export function createMarkdownExport(data: NormalizedResumeExport) {
  const lines: string[] = [];
  const name = data.contact.name || 'Mosaic Resume';

  lines.push(`# ${escapeHeading(name)}`);
  for (const line of data.contact.lines) {
    lines.push(escapeLine(headerLineText(line)));
  }
  if (data.contact.lines.length > 0) {
    lines.push('');
  }

  for (const section of data.sections) {
    lines.push(`## ${escapeHeading(section.label)}`);
    lines.push('');

    const isTextOnly = section.layout === 'lines';

    for (const entry of section.entries) {
      if (isTextOnly) {
        lines.push(escapeLine(entry.text));
      } else {
        lines.push(...entryLines(entry));
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}
