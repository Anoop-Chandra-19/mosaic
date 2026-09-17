import { formatHeaderLineText } from '@/lib/resume/resumeHeader';
import type { NormalizedResumeExport } from './normalizeResumeExport';

export function createPlaintextExport(data: NormalizedResumeExport) {
  const lines: string[] = [];
  const name = data.contact.name || 'Mosaic Resume';

  lines.push(name, ...data.contact.lines.map(formatHeaderLineText), '');

  for (const section of data.sections) {
    lines.push(section.label.toUpperCase());

    const isTextOnly = section.layout === 'lines';

    for (const entry of section.entries) {
      if (isTextOnly) {
        lines.push(entry.text);
        continue;
      }

      const heading = [entry.title, entry.subtitle].filter(Boolean).join(' | ');
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
