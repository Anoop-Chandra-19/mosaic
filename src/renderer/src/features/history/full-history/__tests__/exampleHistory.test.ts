import { describe, expect, it } from 'vitest';
import { versionLabel } from '@/lib/versionLabel';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import { groupRevisions } from '../../groupVersionHistory';
import { buildExampleHistory, EXAMPLE_OPENING_ID } from '../exampleHistory';

describe('the example history', () => {
  const example = buildExampleHistory(new Date(2026, 9, 10, 12).getTime());

  it('reads newest first, and the tour opens on a session closed before an apply', () => {
    const labels = example.versions.map(versionLabel);
    expect(labels.slice(0, 5)).toEqual(['v14', 'v13', 'v12.1', 'v12', 'v11.3']);
    expect(example.versions.find((v) => v.id === EXAMPLE_OPENING_ID)?.source).toBe('before-apply');
    expect(groupRevisions(example.versions).find((n) => n[0].number === 11)).toHaveLength(4);
  });

  it('has the kinds of row the tour and tips explain', () => {
    const sources = new Set(example.versions.map((v) => v.source));
    for (const source of ['edit', 'name', 'assistant', 'before-apply', 'closed', 'import']) {
      expect(sources).toContain(source);
    }
  });

  it('changes the page from v11.2 to v11.3, so reading it shows something', () => {
    const before = example.readVersion('example-v11.2').doc;
    const after = example.readVersion(EXAMPLE_OPENING_ID).doc;
    expect(diffResumes(before, after).changes.length).toBeGreaterThan(0);
  });
});
