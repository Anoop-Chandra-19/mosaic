import { describe, expect, it } from 'vitest';
import { checkPhrases } from '../changePhrases';
import { describeChange, describeDifference } from '../describeChanges';
import { diffResumes } from '../diffResumes';
import { createChangeFixture, editFixture, findEntry, findSection } from './changeFixtures';

const before = createChangeFixture();
const diff = (edit: Parameters<typeof editFixture>[0]) => diffResumes(before, editFixture(edit));
const read = (edit: Parameters<typeof editFixture>[0]) =>
  diff(edit).changes.map((change) => {
    const { noun, verb, detail } = describeChange(change);
    return [noun, verb, detail].filter(Boolean).join(' · ');
  });

describe('diffResumes', () => {
  it('finds nothing between the same resume, and lists every printed line', () => {
    const same = diffResumes(before, createChangeFixture());
    expect(same.changes).toEqual([]);
    expect(same.lines.map((line) => line.row.key)).toEqual([
      'name',
      'item:email',
      'item:linkedin',
      'section:summary',
      'entry:sum-1',
      'entry:sum-2',
      'section:work',
      'entry:babbage',
      'bullet:b1',
      'bullet:b2',
      'bullet:b3',
      'entry:somerville',
      'bullet:s1',
      'section:projects',
      'entry:loom',
      'bullet:l1',
      'section:skills',
      'entry:sk-1',
      'entry:sk-2',
    ]);
  });

  it('word-diffs a reworded bullet, and the phrases rebuild both sides', () => {
    const { changes } = diff((doc) => {
      findEntry(doc, 'work', 'babbage').bullets[1].text = 'Checked every table twice by hand.';
    });
    expect(changes).toMatchObject([
      {
        kind: 'edit',
        target: { type: 'bullet', sectionId: 'work', entryId: 'babbage', bulletId: 'b2' },
        path: 'Work History › Analyst › bullet 2',
        number: 2,
        before: 'Checked every table by hand.',
        after: 'Checked every table twice by hand.',
      },
    ]);
    expect(
      checkPhrases(changes[0], 'Checked every table by hand.', 'Checked every table twice by hand.')
    ).toBe(true);
    expect(describeChange(changes[0])).toEqual({ noun: 'Bullet 2', verb: 'edited', detail: null });
  });

  it('word-diffs the summary, each paragraph on its own', () => {
    const changes = read((doc) => {
      const [first, second] = findSection(doc, 'summary').items;
      first.text = 'Analyst who writes careful programs for the engine.';
      second.text = 'Works from first principles, always.';
    });
    expect(changes).toEqual(['Summary · reworded', 'Summary · reworded']);
    const [first] = diff((doc) => {
      findSection(doc, 'summary').items[0].text = 'Analyst who writes programs.';
    }).changes;
    expect(first.phrases).toBeDefined();
  });

  it('names a line of any other text section by its section and number', () => {
    expect(
      read((doc) => {
        findSection(doc, 'skills').items[1].text = 'Translation from French';
      })
    ).toEqual(['Skills, line 2 · edited']);
  });

  it('shows short fields whole, old → new, each on its own', () => {
    expect(
      read((doc) => {
        const job = findEntry(doc, 'work', 'babbage');
        job.title = 'Senior Analyst';
        job.dates = '2023 to 2024';
        job.location = '';
        findSection(doc, 'projects').label = 'Side projects';
      })
    ).toEqual([
      'Role · renamed · Analyst → Senior Analyst',
      'Location · cleared · London',
      'Dates · changed · 2024 → 2023 to 2024',
      'Section name · renamed · Projects → Side projects',
    ]);
  });

  it('reads a header item by its kind, and never a link or a look', () => {
    expect(
      read((doc) => {
        const [email, linkedin] = doc.contact.header.lines[0].items;
        email.text = 'ada@engine.example';
        linkedin.url = 'linkedin.com/in/lovelace';
        doc.contact.header.lines[0].align = 'left';
        doc.contact.header.lines[0].separator = ' · ';
        doc.contact.header.linkStyle = 'underline';
      })
    ).toEqual(['Email · changed · ada@example.com → ada@engine.example']);
  });

  it('tells a thing left off the page from one deleted or emptied', () => {
    expect(
      read((doc) => {
        const job = findEntry(doc, 'work', 'babbage');
        job.bullets[0].selected = false;
        job.bullets[1].text = '   ';
        job.bullets.splice(2, 1);
        doc.contact.header.lines[0].items[1].shown = false;
        doc.contact.header.lines[0].items[0].text = '';
      })
    ).toEqual([
      'Email · removed',
      'LinkedIn · left off the page',
      'Bullet 1 · left off the page',
      'Bullet 2 · removed',
      'Bullet 3 · removed',
    ]);
  });

  it('counts an entry left off the page once, drawing what changed inside it', () => {
    const { changes, all } = diff((doc) => {
      const job = findEntry(doc, 'work', 'babbage');
      job.selected = false;
      job.bullets[0].text = 'Wrote a program.';
    });
    expect(changes.map((change) => describeChange(change))).toEqual([
      { noun: 'Analyst', verb: 'entry left off the page', detail: null },
    ]);
    expect(all.length).toBeGreaterThan(1);
    const children = all.filter((change) => change.parentId);
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((change) => change.parentId === 'entry:babbage')).toBe(true);
  });

  it('puts a removed line back where it stood, after its earlier neighbour', () => {
    const { lines } = diff((doc) => {
      findEntry(doc, 'work', 'babbage').bullets.splice(1, 1);
    });
    const keys = lines.map((line) => line.row.key);
    expect(keys.slice(keys.indexOf('bullet:b1'), keys.indexOf('bullet:b1') + 3)).toEqual([
      'bullet:b1',
      'bullet:b2',
      'bullet:b3',
    ]);
    expect(lines.find((line) => line.row.key === 'bullet:b2')).toMatchObject({
      beforeNumber: 2,
      afterNumber: null,
      change: { kind: 'remove' },
    });
  });

  it('reads a move as a move, never a removal and an addition', () => {
    expect(
      read((doc) => {
        const job = findEntry(doc, 'work', 'babbage');
        job.bullets.unshift(job.bullets.pop()!);
      })
    ).toEqual(['Bullet 1 · moved above bullet 2 (was below bullet 2)']);
    expect(
      read((doc) => {
        findSection(doc, 'work').items.reverse();
      })
    ).toEqual(['Translator · moved above Analyst (was below Analyst)']);
    expect(
      read((doc) => {
        findSection(doc, 'projects').order = 0.5;
      })
    ).toEqual(['Projects · moved above Work History (was below Work History)']);
  });

  it('reads an entry taken to another section as moved there', () => {
    const changes = diff((doc) => {
      const [translator] = findSection(doc, 'work').items.splice(1, 1);
      findSection(doc, 'projects').items.push(translator);
    }).changes;
    expect(changes.map(describeChange)).toContainEqual({
      noun: 'Translator',
      verb: 'moved to Projects (was in Work History)',
      detail: null,
    });
  });
});

describe('describeDifference', () => {
  it('says what the page being read has and is missing, in words', () => {
    const draft = createChangeFixture();
    const version = editFixture((doc) => {
      const job = findEntry(doc, 'work', 'babbage');
      job.bullets.push({ id: 'b4', selected: true, text: 'Drew the diagram of the engine.' });
      job.dates = '2023 to 2024';
      findSection(doc, 'projects').items = [];
      findSection(doc, 'work').items.reverse();
    });
    expect(describeDifference(diffResumes(draft, version).changes)).toEqual({
      // In page order: the entry that moved is now first.
      has: [
        { text: '1 entry in a different place', tone: 'edit' },
        { text: 'different dates on 1 entry', tone: 'edit' },
        { text: '1 extra bullet', tone: 'add' },
      ],
      missing: [{ text: '1 entry', tone: 'del' }],
      where: ['Work History', 'Projects'],
    });
  });

  it('says a summary is there or missing, and the header is where a name changed', () => {
    const noSummary = editFixture((doc) => {
      findSection(doc, 'summary').hidden = true;
      doc.contact.name = 'Augusta Ada King';
    });
    expect(describeDifference(diffResumes(before, noSummary).changes)).toEqual({
      has: [{ text: 'a different name', tone: 'edit' }],
      missing: [{ text: '1 section', tone: 'del' }],
      where: ['the header', 'Summary'],
    });
  });

  it('counts each kind of edit into its own phrase', () => {
    const edited = editFixture((doc) => {
      const [, secondSummaryLine] = findSection(doc, 'summary').items;
      secondSummaryLine.selected = false;
      findSection(doc, 'work').label = 'Experience';
      const job = findEntry(doc, 'work', 'babbage');
      job.bullets[0].text = 'Wrote the first program for the analytical engine.';
      job.bullets[1].text = 'Checked every table twice.';
      job.organization = 'Babbage and Co';
      findEntry(doc, 'work', 'somerville').organization = 'Somerville House';
      const skills = findSection(doc, 'skills').items;
      skills.reverse();
      skills.push({ id: 'sk-3', selected: true, text: 'Engines', bullets: [] });
    });
    expect(describeDifference(diffResumes(before, edited).changes)).toEqual({
      has: [
        { text: 'a renamed section', tone: 'edit' },
        { text: 'different companies on 2 entries', tone: 'edit' },
        { text: '2 bullets worded differently', tone: 'edit' },
        { text: '1 line in a different place', tone: 'edit' },
        { text: '1 extra line', tone: 'add' },
      ],
      missing: [{ text: 'the summary', tone: 'del' }],
      where: ['Experience', 'Skills'],
    });
  });
});
