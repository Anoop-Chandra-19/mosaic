import {
  getContactPrimaryLine,
  getContactSecondaryLine,
  type NormalizedResumeExport,
} from './normalizeResumeExport';

export function createMarkdownExport(data: NormalizedResumeExport) {
  const lines: string[] = [];
  const name = data.contact.name || 'Mosaic Resume';
  const primaryLine = getContactPrimaryLine(data.contact);
  const secondaryLine = getContactSecondaryLine(data.contact);

  lines.push(`# ${name}`);

  if (primaryLine) {
    lines.push(primaryLine);
  }

  if (secondaryLine) {
    lines.push(secondaryLine);
  }

  if (primaryLine || secondaryLine) {
    lines.push('');
  }

  for (const section of data.sections) {
    lines.push(`## ${section.label}`);
    lines.push('');

    const isTextOnly = section.type === 'summary' || section.type === 'skills';

    for (const entry of section.entries) {
      if (isTextOnly) {
        lines.push(entry.text);
        lines.push('');
        continue;
      }

      const heading = [entry.title, entry.subtitle].filter(Boolean).join(' - ');
      if (heading) {
        lines.push(`### ${heading}`);
      }

      for (const bullet of entry.bullets) {
        lines.push(`- ${bullet}`);
      }

      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}
