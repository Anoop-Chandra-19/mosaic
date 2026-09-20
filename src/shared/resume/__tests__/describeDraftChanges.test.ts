import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../../types/resume';
import { describeDraftChanges } from '../describeDraftChanges';

/** A small fictional resume with two sections, so a change can be placed in one of them. */
function resume(): ResumeData {
  return {
    schemaVersion: 1,
    contact: {
      name: 'Ada Lovelace',
      header: {
        linkStyle: 'plain',
        lines: [
          {
            id: 'line-1',
            separator: ' | ',
            align: 'center',
            items: [
              {
                id: 'item-1',
                kind: 'email',
                text: 'ada@example.com',
                url: 'mailto:ada@example.com',
                shown: true,
              },
            ],
          },
        ],
      },
    },
    sections: [
      {
        id: 'section-experience',
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        order: 0,
        items: [
          {
            id: 'entry-mill',
            selected: true,
            title: 'Engineer',
            organization: 'Analytical Engine Co',
            bullets: [
              { id: 'bullet-mill', text: 'Built the mill', selected: true },
              { id: 'bullet-notes', text: 'Wrote the notes', selected: true },
            ],
          },
        ],
      },
      {
        id: 'section-education',
        kind: 'education',
        layout: 'entries',
        label: 'Education',
        order: 1,
        items: [{ id: 'entry-maths', selected: true, title: 'Mathematics', bullets: [] }],
      },
    ],
  };
}

/** The same resume with one thing changed about it. */
function edited(change: (doc: ResumeData) => void): ResumeData {
  const doc = resume();
  change(doc);
  return doc;
}

const experience = (doc: ResumeData) => doc.sections[0];
const millEntry = (doc: ResumeData) => experience(doc).items[0];

const describeChange = (change: (doc: ResumeData) => void) =>
  describeDraftChanges(resume(), edited(change));

describe('describeDraftChanges', () => {
  it('names the section when everything happened in one', () => {
    expect(
      describeChange((doc) => {
        millEntry(doc).bullets[0].text = 'Built the mill, twice';
      })
    ).toBe('Edited a bullet in Experience');
  });

  it('counts each kind of change, largest first, and says the two largest', () => {
    expect(
      describeChange((doc) => {
        const { bullets } = millEntry(doc);
        bullets[0].text = 'Built the mill, twice';
        bullets[1].text = 'Wrote the notes, at length';
        bullets.push({ id: 'bullet-new', text: 'Read the cards', selected: true });
      })
    ).toBe('Edited 2 bullets, added a bullet in Experience');
  });

  it('reads a bullet left off the page as neither an edit nor a delete', () => {
    expect(
      describeChange((doc) => {
        millEntry(doc).bullets[0].selected = false;
      })
    ).toBe('Left a bullet off in Experience');
  });

  it('puts a bullet back', () => {
    const before = edited((doc) => {
      millEntry(doc).bullets[0].selected = false;
    });
    expect(describeDraftChanges(before, resume())).toBe('Put a bullet back in Experience');
  });

  it('reads a removed bullet as removed', () => {
    expect(
      describeChange((doc) => {
        millEntry(doc).bullets.pop();
      })
    ).toBe('Removed a bullet in Experience');
  });

  it('lets a new entry speak for the bullets that arrived with it', () => {
    expect(
      describeChange((doc) => {
        experience(doc).items.push({
          id: 'entry-loom',
          selected: true,
          title: 'Weaver',
          bullets: [
            { id: 'bullet-cards', text: 'Punched the cards', selected: true },
            { id: 'bullet-loom', text: 'Ran the loom', selected: true },
          ],
        });
      })
    ).toBe('Added an entry in Experience');
  });

  it('drops the section when the changes are spread across two', () => {
    expect(
      describeChange((doc) => {
        millEntry(doc).bullets[0].text = 'Built the mill, twice';
        doc.sections[1].items[0].title = 'Mathematics and logic';
      })
    ).toBe('Edited an entry, edited a bullet');
  });

  it('reads a rename as a rename, not as a new section', () => {
    expect(
      describeChange((doc) => {
        experience(doc).label = 'Work';
      })
    ).toBe('Renamed a section');
  });

  it('reads a section left off the resume', () => {
    expect(
      describeChange((doc) => {
        doc.sections[1].hidden = true;
      })
    ).toBe('Left a section off');
  });

  it('reads reordered sections and reordered bullets', () => {
    expect(
      describeChange((doc) => {
        doc.sections[0].order = 1;
        doc.sections[1].order = 0;
      })
    ).toBe('Reordered the sections');

    expect(
      describeChange((doc) => {
        millEntry(doc).bullets.reverse();
      })
    ).toBe('Reordered bullets in Experience');
  });

  it('reads the name and the header on their own', () => {
    expect(
      describeChange((doc) => {
        doc.contact.name = 'A. Lovelace';
      })
    ).toBe('Changed the name');

    expect(
      describeChange((doc) => {
        doc.contact.header.lines[0].items[0].text = 'ada@analytical.example';
      })
    ).toBe('Edited the header');
  });

  it('says something rather than nothing when it cannot tell what changed', () => {
    expect(describeDraftChanges(resume(), resume())).toBe('Edited the resume');
  });
});
