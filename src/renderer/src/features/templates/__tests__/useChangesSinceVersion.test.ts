import { describe, expect, it } from 'vitest';
import {
  createChangeFixture,
  editFixture,
  findEntry,
  findSection,
} from '@/lib/resume/changes/__tests__/changeFixtures';
import { listChangesSinceVersion } from '../useChangesSinceVersion';

const version = createChangeFixture();
const listSince = (edit: Parameters<typeof editFixture>[0], isUndone = false) =>
  listChangesSinceVersion(version, editFixture(edit), 'v13', isUndone);
const read = (rows: { text: string; place: string | null }[]) =>
  rows.map(({ text, place }) => (place ? `${text} · ${place}` : text));

describe('listChangesSinceVersion', () => {
  it('words an edited bullet as the full history does, with its place', () => {
    const { changes, formatting } = listSince((doc) => {
      findEntry(doc, 'work', 'babbage').bullets[1].text = 'Checked every table twice.';
    });
    expect(read(changes)).toEqual(['Bullet 2 edited · Work History › Analyst']);
    expect(formatting).toEqual([]);
  });

  it('names an added entry once, without repeating it as its place', () => {
    const { changes } = listSince((doc) => {
      findSection(doc, 'projects').items.push({
        id: 'tables',
        selected: true,
        title: 'Bernoulli tables',
        bullets: [],
      });
    });
    expect(read(changes)).toEqual(['Bernoulli tables entry added · Projects']);
  });

  it('says where a moved bullet went', () => {
    const { changes } = listSince((doc) => {
      const { bullets } = findEntry(doc, 'work', 'babbage');
      bullets.push(bullets.shift()!);
    });
    expect(read(changes)).toEqual(['Bullet 3 moved down 2 places · Work History › Analyst']);
  });

  it('lists formatting apart from the counted changes', () => {
    const { changes, formatting } = listSince((doc) => {
      doc.contact.header.linkStyle = 'underline';
    });
    expect(changes).toEqual([]);
    expect(formatting).toHaveLength(1);
    expect(formatting[0].text).toContain('in v13');
  });

  it('finds nothing when the draft prints the same words', () => {
    expect(listSince(() => {})).toEqual({ changes: [], formatting: [] });
  });

  it('lists undone work as what the version has', () => {
    const draft = editFixture((doc) => {
      findEntry(doc, 'work', 'babbage').bullets.pop();
    });
    const { changes } = listChangesSinceVersion(version, draft, 'v13', true);
    expect(read(changes)).toEqual(['Bullet 3 added · Work History › Analyst']);
  });
});
