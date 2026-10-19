import { describe, expect, it } from 'vitest';
import { BUILT_IN_KINDS, SECTION_PRESETS } from '@shared/resume/sectionPresets';
import { matchSectionHeader } from '../sectionHeaders';

describe('matchSectionHeader', () => {
  it('knows every section by the name Mosaic gives it, so a resume reads back as it was', () => {
    for (const kind of BUILT_IN_KINDS) {
      const { label } = SECTION_PRESETS[kind];
      expect(matchSectionHeader(label)).toBe(kind);
      expect(matchSectionHeader(label.toUpperCase())).toBe(kind);
    }
  });

  it('matches whole headings only', () => {
    expect(matchSectionHeader('Spoken languages')).toBeNull();
    expect(matchSectionHeader('Awards for the engine were many')).toBeNull();
  });
});
