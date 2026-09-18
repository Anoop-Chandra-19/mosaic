import { formatHeaderLineText, getPrintableHeaderLines } from '@/lib/resume/resumeHeader';
import type { ResumeData } from '@/types/resume';

/**
 * Every line that reaches the page, keyed so the same line in two documents lines up:
 * the name, each printed header line, each section heading, each shown entry's heading, each shown bullet.
 * Hidden entries and bullets are left out — they are not on the page.
 */
function pageLines(doc: ResumeData): Map<string, string> {
  const lines = new Map<string, string>();
  const { name, header } = doc.contact;
  lines.set('name', name);
  // A header line differs when its words, its links, where it sits, or how links look do.
  for (const line of getPrintableHeaderLines(header)) {
    lines.set(
      `header:${line.id}`,
      [
        formatHeaderLineText(line),
        line.align,
        header.linkStyle,
        ...line.items.map((i) => i.href),
      ].join('|')
    );
  }
  for (const section of [...doc.sections].sort((a, b) => a.order - b.order)) {
    lines.set(`section:${section.id}`, section.label);
    for (const entry of section.items) {
      if (!entry.selected) continue;
      lines.set(`entry:${entry.id}`, [entry.title, entry.subtitle, entry.text].join('|'));
      for (const bullet of entry.bullets) {
        if (bullet.selected) lines.set(`bullet:${bullet.id}`, bullet.text);
      }
    }
  }
  return lines;
}

/** How many lines on the page differ between a version and the draft. */
export function countChangedLines(version: ResumeData, draft: ResumeData): number {
  const before = pageLines(version);
  const after = pageLines(draft);
  let changed = 0;
  for (const [key, line] of before) if (after.get(key) !== line) changed++;
  for (const key of after.keys()) if (!before.has(key)) changed++;
  return changed;
}
