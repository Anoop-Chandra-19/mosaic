import { describe, expect, it } from 'vitest';
import { formatBundleText } from '@shared/vault/formatBundle';
import { parseBundle } from '@shared/vault/parseBundle';
import { planHistory } from '../makeHistory';

const NOW = Date.parse('2026-10-21T12:00:00Z');

describe('planHistory', () => {
  it('writes v1 as created, then each version as asked, newest as the draft', async () => {
    const entry = await planHistory(
      {
        template: 'Three names',
        versions: [{ name: 'First', contactName: 'Rowan Hale' }, {}, { name: 'Third' }],
      },
      NOW
    );
    expect(entry.template.name).toBe('Three names');
    expect(entry.versions.map(({ number, kind, summary }) => [number, kind, summary])).toEqual([
      [1, 'auto', 'Created'],
      [2, 'named', 'First'],
      [3, 'auto', expect.stringMatching(/^Edited/)],
      [4, 'named', 'Third'],
    ]);
    expect(entry.versions[1].doc.contact.name).toBe('Rowan Hale');
    expect(entry.versions[3].doc.contact.name).toBe('Rowan Hale');
    expect(entry.draft).toBe(entry.versions[3].doc);
  });

  it('changes something in every version, so none reads as identical', async () => {
    const { versions } = await planHistory({ versions: [{}, {}, {}] }, NOW);
    const texts = versions.map((version) => JSON.stringify(version.doc));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('makes a backup Mosaic can restore', async () => {
    const entry = await planHistory({ versions: [{ name: 'Sent' }] }, NOW);
    const text = formatBundleText({ exportedAt: new Date(NOW).toISOString(), templates: [entry] });
    expect(parseBundle(text).ok).toBe(true);
  });
});
