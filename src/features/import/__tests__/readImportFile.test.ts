import { describe, expect, it } from 'vitest';
import { UnreadableBackupError } from '@/features/backup/backupFiles';
import { readImportFile, UnreadableFileError } from '../readImportFile';

const bytes = (text: string) => new TextEncoder().encode(text);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const RESUME = 'Ada Lovelace\nada@example.com\n\nWork History\nAnalyst\n- Wrote the first program';

describe('readImportFile', () => {
  it('reads text and Markdown files as resumes to review', () => {
    for (const name of ['ada.txt', 'ada.md']) {
      const read = readImportFile(name, bytes(RESUME));
      expect(read.type).toBe('resume');
      if (read.type !== 'resume') continue;
      expect(read.source).toBe(name);
      expect(read.parsed.resume.contact.name).toBe('Ada Lovelace');
      expect(read.parsed.resume.sections.map((s) => s.label)).toEqual(['Work History']);
    }
  });

  it('drops a byte-order mark, so the first line is still the name', () => {
    const read = readImportFile('ada.txt', bytes(BYTE_ORDER_MARK + RESUME));
    expect(read.type === 'resume' && read.parsed.resume.contact.name).toBe('Ada Lovelace');
  });

  it('hands JSON to Restore, which refuses a file that is not a backup', () => {
    expect(() => readImportFile('notes.json', bytes('{"hello": 1}'))).toThrow(
      UnreadableBackupError
    );
  });

  it('says so for a kind of file it cannot read', () => {
    expect(() => readImportFile('resume.pages', bytes('?'))).toThrow(UnreadableFileError);
  });
});
