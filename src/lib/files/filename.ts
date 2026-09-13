function formatDateDashed(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ExportNameOptions {
  contactName?: string;
  templateName?: string;
  /** "v3", when exporting a version rather than the draft. */
  versionLabel?: string;
}

/** "Ada Lovelace — Backend", as the Export dialog suggests it before the user edits it. */
export function buildExportName({ contactName, templateName, versionLabel }: ExportNameOptions) {
  const base = [contactName?.trim(), templateName?.trim()].filter(Boolean).join(' — ') || 'Resume';
  return versionLabel ? `${base} (${versionLabel})` : base;
}

/**
 * `name` as a file name every system accepts — no folder separators, reserved or control
 * characters — with `extension` added unless the name already ends in it.
 */
export function toFileName(name: string, extension: string) {
  const suffix = `.${extension}`;
  const withoutSuffix = name.toLowerCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name;
  const safe = withoutSuffix
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+/, '')
    .slice(0, 150)
    .trim();
  return `${safe || 'Resume'}${suffix}`;
}

/** A full backup: every template with its history. */
export function buildBackupFileName(now: Date = new Date()) {
  return `mosaic-backup-${formatDateDashed(now)}.json`;
}
