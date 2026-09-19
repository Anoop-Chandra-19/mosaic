import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { ExportEntry } from '../normalizeResumeExport';

type ExportEntryParts = Partial<Omit<ExportEntry, 'id' | 'heading'>>;

/** An entry as `normalizeResumeForExport` gives it: every part, and the line they print as. */
export function createExportEntry(id: string, parts: ExportEntryParts): ExportEntry {
  const entry = {
    title: '',
    organization: '',
    location: '',
    dates: '',
    text: '',
    bullets: [],
    ...parts,
  };
  return { id, ...entry, heading: formatEntryHeading(entry) };
}
