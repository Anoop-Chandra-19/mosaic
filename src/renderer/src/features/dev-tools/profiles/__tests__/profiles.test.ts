import { describe, expect, it } from 'vitest';
import { formatBundleText } from '@shared/vault/formatBundle';
import { parseBundle } from '@shared/vault/parseBundle';
import type { MosaicBundle } from '@shared/types/bundle';
import {
  countProfileVersions,
  generateProfileTemplates,
  type GeneratedProfileName,
} from '../profiles';
import { WORST_CASE_BULLETS } from '../worstCaseResume';

const NOW = Date.parse('2026-10-21T12:00:00Z');

/** The whole profile as one backup, as a restore of it in one part would write it. */
async function generateProfile(
  name: GeneratedProfileName,
  now: number,
  onProgress?: (made: number) => void
): Promise<MosaicBundle> {
  const templates = [];
  for await (const template of generateProfileTemplates(name, now, onProgress)) {
    templates.push(template);
  }
  return { exportedAt: new Date(now).toISOString(), templates };
}

const countBullets = (bundle: MosaicBundle, index: number) =>
  bundle.templates[index].versions[0].doc.sections
    .flatMap((section) => section.items)
    .reduce((sum, entry) => sum + entry.bullets.length, 0);

describe('generateProfileTemplates', () => {
  it('makes the same bundle from the same seed', async () => {
    const first = formatBundleText(await generateProfile('Everyday', NOW));
    const second = formatBundleText(await generateProfile('Everyday', NOW));
    expect(second).toBe(first);
  });

  it('makes a backup Mosaic can restore', async () => {
    const parsed = parseBundle(formatBundleText(await generateProfile('Everyday', NOW)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle.templates.map((entry) => entry.template.name)).toEqual([
      'Base resume',
      'Tailored for Kestrel',
      'Harbor Freight Labs',
    ]);
    expect(parsed.bundle.templates.map((entry) => entry.versions.length)).toEqual([48, 40, 37]);
  });

  it('writes the history the app would: created, then edits, revisions and names', async () => {
    const { versions } = (await generateProfile('Everyday', NOW)).templates[0];
    expect(versions[0]).toMatchObject({ number: 1, source: 'create', summary: 'Created' });
    expect(versions.some((version) => version.kind === 'named')).toBe(true);
    expect(versions.some((version) => version.revision > 0)).toBe(true);
    expect(versions.filter((version) => version.source === 'edit')[0].summary).toMatch(/^Edited/);
    expect(Date.parse(versions.at(-1)!.createdAt)).toBeLessThan(NOW);
  });

  it('puts the worst-case resume, read by the importer, under a long history in Heavy', async () => {
    const reports: number[] = [];
    const heavy = await generateProfile('Heavy', NOW, (done) => reports.push(done));
    expect(heavy.templates).toHaveLength(12);
    expect(heavy.templates[0].template.name).toBe('Tailored for Kestrel');
    expect(heavy.templates[0].versions).toHaveLength(600);
    expect(countBullets(heavy, 0)).toBe(WORST_CASE_BULLETS);
    expect(reports.length).toBeGreaterThan(10);
    expect(reports.at(-1)).toBeLessThanOrEqual(countProfileVersions('Heavy'));
  }, 30_000);

  it('makes Worst case a template at a time, the open one first with 3,000 versions', async () => {
    const templates = generateProfileTemplates('Worst case', NOW);
    const { value: first } = await templates.next();
    expect(first?.template.name).toBe('Tailored for Kestrel');
    expect(first?.versions).toHaveLength(3000);
    expect(countProfileVersions('Worst case')).toBe(3000 + 49 * 60);
  }, 30_000);

  it('shares what an edit leaves alone between versions, the earlier left as it was', async () => {
    const { versions } = (await generateProfile('Everyday', NOW)).templates[0];
    const [before, after] = [versions[0].doc, versions[1].doc];
    expect(after).not.toBe(before);
    const shared = after.sections
      .flatMap((section) => section.items)
      .filter((entry) => before.sections.some((section) => section.items.includes(entry)));
    expect(shared.length).toBeGreaterThan(0);
    expect(JSON.stringify(versions[0].doc)).toBe(JSON.stringify(before));
  });
});
