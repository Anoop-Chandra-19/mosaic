import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import type { ResumeData } from '@shared/types/resume';
import { collectPageMarks, findMarks, putGoneBack } from '../pageMarks';

/** The draft is the default resume; the version read is it, edited. */
function readVersion(edit: (resume: ResumeData) => void) {
  const draft = createDefaultResume();
  const version = createDefaultResume();
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
