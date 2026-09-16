import { describe, expect, it } from 'vitest';
import { UnreadableBackupError } from '@/features/backup/backupFiles';
import { readImportFile, UnreadableFileError } from '../readImportFile';
import { docx, para } from '../docx/__tests__/buildDocx';
import { buildPdf } from '../pdf/__tests__/buildPdf';
import { PDF_LIMITS } from '../pdf/readPdf';

const bytes = (text: string) => new TextEncoder().encode(text);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const RESUME = 'Ada Lovelace\nada@example.com\n\nWork History\nAnalyst\n- Wrote the first program';

/** The start of a Microsoft compound file, and the name of a locked .docx's stream in one. */
const COMPOUND = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const utf16 = (text: string) => [...text].flatMap((char) => [char.charCodeAt(0), 0]);

describe('readImportFile', () => {
  it('reads text and Markdown files as resumes to review', async () => {
    for (const name of ['ada.txt', 'ada.md']) {
      const read = await readImportFile(name, bytes(RESUME));
      expect(read.type).toBe('resume');
      if (read.type !== 'resume') continue;
      expect(read.source).toBe(name);
      expect(read.parsed.resume.contact.name).toBe('Ada Lovelace');
      expect(read.parsed.resume.sections.map((s) => s.label)).toEqual(['Work History']);
    }
  });

  it('drops a byte-order mark, so the first line is still the name', async () => {
    const read = await readImportFile('ada.txt', bytes(BYTE_ORDER_MARK + RESUME));
    expect(read.type === 'resume' && read.parsed.resume.contact.name).toBe('Ada Lovelace');
  });

  it('reads a JSON Resume as a resume to review', async () => {
    const read = await readImportFile('ada.json', bytes('{"basics": {"name": "Ada Lovelace"}}'));
    expect(read.type === 'resume' && read.parsed.resume.contact.name).toBe('Ada Lovelace');
  });

  it('reads a Word document as a resume to review', async () => {
    const file = await docx(
      [para('Ada Lovelace'), para('Work History', { bold: true }), para('Analyst')].join('')
    );
    const read = await readImportFile('Ada.DOCX', file);
    expect(read.type === 'resume' && read.parsed.resume.contact.name).toBe('Ada Lovelace');
  });

  it('hands a Mosaic backup to Restore, which checks it', async () => {
    await expect(readImportFile('backup.json', bytes('{"bundleVersion": 2}'))).rejects.toThrow(
      UnreadableBackupError
    );
  });

  it('says so for JSON that is neither', async () => {
    for (const content of ['{"hello": 1}', 'not json']) {
      await expect(readImportFile('notes.json', bytes(content))).rejects.toThrow(
        new UnreadableFileError('notes.json isn’t a resume or a Mosaic backup.')
      );
    }
  });

  it('says what to do with a Word file it cannot read', async () => {
    const older = new UnreadableFileError(
      'cv.doc is an older Word document. Save it as .docx and try again.'
    );
    await expect(readImportFile('cv.doc', new Uint8Array(COMPOUND))).rejects.toThrow(older);
    // An older document renamed .docx is still one.
    await expect(readImportFile('cv.docx', new Uint8Array(COMPOUND))).rejects.toThrow(
      new UnreadableFileError('cv.docx is an older Word document. Save it as .docx and try again.')
    );
    const locked = new Uint8Array([...COMPOUND, 0, 0, ...utf16('EncryptedPackage'), 0, 0]);
    await expect(readImportFile('cv.docx', locked)).rejects.toThrow(
      new UnreadableFileError(
        'cv.docx is locked with a password. Save an unlocked copy and try again.'
      )
    );
    await expect(readImportFile('cv.docx', bytes('not a zip'))).rejects.toThrow(
      new UnreadableFileError('cv.docx isn’t a Word document Mosaic can read.')
    );
  });

  it('says a Word file is too much to read, rather than that it is not one', async () => {
    // A small file whose document part nests deeper than the reader will go.
    const deep = 20_000;
    const body = `${'<w:customXml>'.repeat(deep)}${para('Ada')}${'</w:customXml>'.repeat(deep)}`;
    await expect(readImportFile('deep.docx', await docx(body))).rejects.toThrow(
      new UnreadableFileError('deep.docx is larger or more complex than Mosaic can read.')
    );
  });

  it('says what to do with a PDF it cannot read', async () => {
    const cases: [Uint8Array, string][] = [
      [buildPdf(), 'cv.pdf has no text in it — it’s probably a scan. Paste the text instead.'],
      [
        buildPdf({ locked: true }),
        'cv.pdf is locked with a password. Save an unlocked copy and try again.',
      ],
      [bytes('not a PDF'), 'cv.pdf isn’t a PDF Mosaic can read.'],
      [
        buildPdf({ pages: Array.from({ length: PDF_LIMITS.pages + 1 }, () => '0 0 m 9 9 l S') }),
        'cv.pdf is larger or more complex than Mosaic can read.',
      ],
    ];
    for (const [file, message] of cases) {
      await expect(readImportFile('cv.pdf', file)).rejects.toThrow(
        new UnreadableFileError(message)
      );
    }
  });

  it('says so for a kind of file it cannot read', async () => {
    await expect(readImportFile('resume.pages', bytes('?'))).rejects.toThrow(UnreadableFileError);
  });
});
