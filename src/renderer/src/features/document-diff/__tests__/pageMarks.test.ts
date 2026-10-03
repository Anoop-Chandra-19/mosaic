import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import type { ResumeData } from '@shared/types/resume';
import { collectPageMarks, findMarks, putGoneBack } from '../pageMarks';

/** The default resume with every header item printing its kind's name. */
function createFilledResume(): ResumeData {
  const resume = createDefaultResume();
  for (const line of resume.contact.header.lines) {
    for (const item of line.items) item.text = item.kind;
  }
  return resume;
}

/** The draft is the default resume; the version read is it, edited. */
function readVersion(edit: (resume: ResumeData) => void) {
  const draft = createFilledResume();
  const version = createFilledResume();
  edit(version);
  const { all } = diffResumes(draft, version);
  return { page: putGoneBack(version, draft, all), marks: collectPageMarks(all, 'your draft') };
}

const job = (resume: ResumeData) => resume.sections[1].items[0];

describe('putGoneBack', () => {
  it('puts a bullet only the draft has back where it stood', () => {
    const { page, marks } = readVersion((version) => {
      job(version).bullets.splice(1, 1);
    });
    expect(job(page).bullets.map((bullet) => bullet.id)).toEqual(
      job(createDefaultResume()).bullets.map((bullet) => bullet.id)
    );
    expect(findMarks(marks, 'bullet', 'j1b2').map((change) => change.kind)).toEqual(['remove']);
  });

  it('shows a bullet left off the page, marked as hidden rather than removed', () => {
    const { page, marks } = readVersion((version) => {
      job(version).bullets[0].selected = false;
    });
    expect(job(page).bullets[0].selected).toBe(true);
    expect(findMarks(marks, 'bullet', 'j1b1').map((change) => change.kind)).toEqual(['hide']);
  });

  it('puts back a removed entry with its bullets, each marked inside it', () => {
    const { page, marks } = readVersion((version) => {
      version.sections[0].items.splice(0, 1);
    });
    expect(page.sections[0].items.map((entry) => entry.id)).toEqual(['edu1', 'edu2']);
    expect(findMarks(marks, 'entry', 'edu1').map((change) => change.kind)).toEqual(['remove']);
  });

  it('shows a section left off the page, and keeps the sections in their order', () => {
    const { page } = readVersion((version) => {
      version.sections[2].hidden = true;
    });
    expect(page.sections.map((section) => [section.id, section.hidden ?? false])).toEqual([
      ['sec-education', false],
      ['sec-experience', false],
      ['sec-projects', false],
    ]);
  });

  it('puts a header item only the draft has back where it stood in its line', () => {
    const draftItems = createFilledResume().contact.header.lines[0].items;
    const { page, marks } = readVersion((version) => {
      version.contact.header.lines[0].items.splice(1, 1);
    });
    expect(page.contact.header.lines[0].items.map((item) => item.id)).toEqual(
      draftItems.map((item) => item.id)
    );
    expect(findMarks(marks, 'item', draftItems[1].id).map((change) => change.kind)).toEqual([
      'remove',
    ]);
  });

  it('shows a header item left off the page, and marks the name by its words', () => {
    const { page, marks } = readVersion((version) => {
      version.contact.header.lines[0].items[0].shown = false;
      version.contact.name = 'Ada Lovelace';
    });
    const item = page.contact.header.lines[0].items[0];
    expect(item.shown).toBe(true);
    expect(findMarks(marks, 'item', item.id).map((change) => change.kind)).toEqual(['hide']);
    expect(findMarks(marks, 'name', '')[0]).toMatchObject({ kind: 'edit', after: 'Ada Lovelace' });
  });

  it('puts back a removed section between the ones around it', () => {
    const { page } = readVersion((version) => {
      version.sections.splice(1, 1);
    });
    const printed = [...page.sections].sort((a, b) => a.order - b.order);
    expect(printed.map((section) => section.id)).toEqual([
      'sec-education',
      'sec-experience',
      'sec-projects',
    ]);
  });
});
