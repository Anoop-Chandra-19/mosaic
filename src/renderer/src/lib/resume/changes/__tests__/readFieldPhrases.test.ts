import { describe, expect, it } from 'vitest';
import { readFieldPhrases } from '../readFieldPhrases';
import { createChange } from './changeFixtures';

describe('readFieldPhrases', () => {
  it('draws a section name word by word', () => {
    const change = createChange({
      target: { type: 'section', sectionId: 's' },
      before: 'Work History',
      after: 'Work Experience',
    });
    expect(readFieldPhrases(change)).toEqual([
      { k: 'keep', t: 'Work ' },
      { k: 'edit', del: 'History', ins: 'Experience' },
    ]);
  });

  it('draws any other field whole', () => {
    const change = createChange({
      target: { type: 'entryField', sectionId: 's', entryId: 'e', field: 'dates' },
      before: '2024 to 2025',
      after: '2024 to 2026',
    });
    expect(readFieldPhrases(change)).toEqual([
      { k: 'edit', del: '2024 to 2025', ins: '2024 to 2026' },
    ]);
  });
});
