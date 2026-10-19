import { describe, expect, it } from 'vitest';
import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import { JSON_RESUME_CUSTOM_SECTIONS, matchSectionHeader } from '../sectionHeaders';

describe('matchSectionHeader', () => {
  it('knows every section by the name Mosaic gives it, so a resume reads back as it was', () => {
    for (const [kind, { label, layout }] of Object.entries(SECTION_PRESETS)) {
      expect(matchSectionHeader(label)).toEqual({ kind, label, layout });
    }
    for (const { label, layout } of Object.values(JSON_RESUME_CUSTOM_SECTIONS)) {
      expect(matchSectionHeader(label)).toEqual({ kind: 'custom', label, layout });
      expect(matchSectionHeader(label.toUpperCase())).toEqual({ kind: 'custom', label, layout });
    }
  });

  it('matches whole headings only', () => {
    expect(matchSectionHeader('Spoken languages')).toBeNull();
    expect(matchSectionHeader('Awards for the engine were many')).toBeNull();
  });
});
