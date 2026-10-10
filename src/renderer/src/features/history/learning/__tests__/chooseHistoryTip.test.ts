import { describe, expect, it } from 'vitest';
import type { HistoryTips } from '@/types/history';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import type { HistoryItem } from '../../groupVersionHistory';
import { chooseHistoryTip } from '../chooseHistoryTip';

function version(
  number: number,
  source: VersionSource,
  { kind = 'auto', revision = 0 }: Partial<Pick<VersionMeta, 'kind' | 'revision'>> = {}
): VersionMeta {
  return {
    id: `v${number}.${revision}`,
    templateId: 't',
    number,
    revision,
    parentId: null,
    kind,
    source,
    summary: `${source} ${number}`,
    section: null,
    rev: 0,
    createdAt: 0,
  };
}

const row = (...revisions: VersionMeta[]): HistoryItem => ({ kind: 'number', revisions });
const fold = (...numbers: VersionMeta[][]): HistoryItem => ({ kind: 'fold', numbers });
const tips = (seen: HistoryTips['seen'] = {}, isOn = true): HistoryTips => ({ isOn, seen });
const FOLDING = { foldDays: 30 as const };

const named = row(version(5, 'name', { kind: 'named' }));
const session = row(
  version(4, 'edit', { revision: 2 }),
  version(4, 'edit', { revision: 1 }),
  version(4, 'edit')
);
const snapshot = row(version(3, 'edit'));
const created = row(version(1, 'create'));

describe('chooseHistoryTip', () => {
  it('explains the most basic kind in view first, on its first row', () => {
    const chosen = chooseHistoryTip([named, session, snapshot], tips(), FOLDING);
    expect(chosen?.tip.id).toBe('auto');
    expect(chosen?.item).toBe(snapshot);
  });

  it('skips a kind seen for good, or shown and left three times', () => {
    expect(chooseHistoryTip([named, snapshot], tips({ auto: 'got' }), FOLDING)?.tip.id).toBe(
      'named'
    );
    expect(chooseHistoryTip([named, snapshot], tips({ auto: 3 }), FOLDING)?.tip.id).toBe('named');
    expect(chooseHistoryTip([named, snapshot], tips({ auto: 2 }), FOLDING)?.tip.id).toBe('auto');
  });

  it('names the row in the words: the named label, and a session by its number', () => {
    expect(chooseHistoryTip([named], tips(), FOLDING)?.tip.body(named, FOLDING)).toContain('v5');
    const body = chooseHistoryTip([session], tips(), FOLDING)?.tip.body(session, FOLDING);
    expect(body).toMatch(/^v4 is one editing session.*the newest, v4\.2/);
  });

  it('leaves "Created" alone: the hollow square’s words are about imports and before rows', () => {
    expect(chooseHistoryTip([created], tips(), FOLDING)).toBeNull();
    expect(chooseHistoryTip([row(version(2, 'before-restore'))], tips(), FOLDING)?.tip.id).toBe(
      'event'
    );
  });

  it('explains a fold with the fold setting, and never when folding is off', () => {
    const folded = fold([version(2, 'edit')], [version(1, 'edit')]);
    const chosen = chooseHistoryTip([folded], tips(), { foldDays: 90 });
    expect(chosen?.tip.body(folded, { foldDays: 90 })).toContain('older than 90 days');
    expect(chooseHistoryTip([folded], tips(), { foldDays: null })).toBeNull();
  });

  it('shows nothing with tips off', () => {
    expect(chooseHistoryTip([snapshot], tips({}, false), FOLDING)).toBeNull();
  });
});
