import { describe, expect, it } from 'vitest';
import { buildBackupFileName, buildExportName, toFileName } from '../fileNames';

const fixedDate = new Date(2026, 3, 23);

describe('buildExportName', () => {
  it('names the person and the template', () => {
    expect(buildExportName({ contactName: 'Alex Johnson', templateName: 'Backend' })).toBe(
      'Alex Johnson - Backend'
    );
  });

  it('uses whichever name there is, or a plain fallback', () => {
    expect(buildExportName({ contactName: '  ', templateName: 'Backend' })).toBe('Backend');
    expect(buildExportName({ contactName: 'Alex Johnson' })).toBe('Alex Johnson');
    expect(buildExportName({ contactName: '', templateName: '   ' })).toBe('Resume');
  });

  it('says which version it is', () => {
    expect(
      buildExportName({ contactName: 'Alex', templateName: 'Backend', versionLabel: 'v3' })
    ).toBe('Alex - Backend (v3)');
  });
});

describe('toFileName', () => {
  it('adds the extension once', () => {
    expect(toFileName('Alex — Backend', 'pdf')).toBe('Alex — Backend.pdf');
    expect(toFileName('Alex — Backend.PDF', 'pdf')).toBe('Alex — Backend.pdf');
  });

  it('drops characters a file system refuses, and folder separators', () => {
    expect(toFileName('../Alex / Resume: "Senior"?', 'md')).toBe('Alex Resume Senior.md');
  });

  it('never leaves the name empty', () => {
    expect(toFileName(' / ', 'txt')).toBe('Resume.txt');
  });
});

describe('buildBackupFileName', () => {
  it('uses a dashed date with the mosaic-backup prefix', () => {
    expect(buildBackupFileName(fixedDate)).toBe('mosaic-backup-2026-04-23.json');
  });
});
