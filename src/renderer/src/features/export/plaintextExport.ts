import {
  stripMailtoOrTelScheme,
  isSameAddress,
  type PrintedHeaderLine,
} from '@shared/resume/resumeHeader';
import type { NormalizedResumeExport } from './normalizeResumeExport';

/**
 * A header line with each link after its text, "LinkedIn (https://linkedin.com/in/ada)",
 * since plain text can't link. Left off where the text already is the address.
 */
function formatHeaderLineWithLinks({ separator, items }: PrintedHeaderLine): string {
  return items
    .map(({ text, href }) =>
      href && !isSameAddress(text, href) ? `${text} (${stripMailtoOrTelScheme(href)})` : text
    )
    .join(separator);
}

export function createPlaintextExport(data: NormalizedResumeExport) {
  const lines: string[] = [];
  const name = data.contact.name || 'Mosaic Resume';

  lines.push(name, ...data.contact.lines.map(formatHeaderLineWithLinks), '');

  for (const section of data.sections) {
    lines.push(section.label.toUpperCase());

    const isTextOnly = section.layout === 'lines';

    for (const entry of section.entries) {
      if (isTextOnly) {
        lines.push(entry.text);
        continue;
      }

      const heading = [entry.heading, entry.dates].filter(Boolean).join(' | ');
      if (heading) {
        lines.push(heading);
      }

      for (const bullet of entry.bullets) {
        lines.push(`- ${bullet}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
