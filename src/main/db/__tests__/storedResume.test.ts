import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { encodeStoredResume, parseAndMigrateStoredResume } from '../storedResume';

describe('parseAndMigrateStoredResume', () => {
  it('reads a current resume as it was stored', () => {
    const doc = createDefaultResume();
    expect(parseAndMigrateStoredResume(encodeStoredResume(doc))).toEqual(doc);
  });

  it('refuses a resume from a newer Mosaic rather than relabelling it', () => {
    const text = encodeStoredResume({ ...createDefaultResume(), schemaVersion: 2 });
    expect(() => parseAndMigrateStoredResume(text)).toThrow('schema version 2');
  });
});
