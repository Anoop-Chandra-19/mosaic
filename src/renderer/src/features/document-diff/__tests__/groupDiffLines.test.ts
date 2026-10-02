import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { diffResumes } from '@shared/resume/changes/diffResumes';
import type { ResumeData } from '@shared/types/resume';
import { groupDiffLinesIntoHunks, type Hunk } from '../groupDiffLines';

function diffWith(edit: (resume: ResumeData) => void) {
  const after = createDefaultResume();
  edit(after);
  return diffResumes(createDefaultResume(), after).lines;
}

const rewordFourthBullet = (resume: ResumeData) => {
  resume.sections[1].items[0].bullets[3].text = 'Wrote an AI agent in Python.';
};

const describeItems = (hunk: Hunk) =>
  hunk.items.map((item) =>
    item.kind === 'fold' ? `fold ${item.lines.length} ${item.noun}` : item.line.row.key
  );

describe('groupDiffLinesIntoHunks', () => {
  it('keeps one bullet either side of a change, and folds the rest', () => {
    const [hunk, ...others] = groupDiffLinesIntoHunks(diffWith(rewordFourthBullet));
    expect(others).toEqual([]);
    expect(hunk.title).toBe('Work History › Job Title');
    expect(describeItems(hunk)).toEqual([
      'entry:job1',
      'fold 2 bullet',
      'bullet:j1b3',
      'bullet:j1b4',
      'bullet:j1b5',
      'fold 1 bullet',
    ]);
  });

  it('shows an opened fold’s lines in place', () => {
    const lines = diffWith(rewordFourthBullet);
    const [closed] = groupDiffLinesIntoHunks(lines);
    const fold = closed.items[1];
    if (fold.kind !== 'fold') throw new Error('Expected a fold');
    const [opened] = groupDiffLinesIntoHunks(lines, new Set([fold.id]));
    expect(describeItems(opened).slice(0, 4)).toEqual([
      'entry:job1',
      'bullet:j1b1',
      'bullet:j1b2',
      'bullet:j1b3',
    ]);
  });

  it('leaves out every hunk with nothing changed in it', () => {
    const hunks = groupDiffLinesIntoHunks(
      diffWith((resume) => {
        resume.contact.name = 'Ada Lovelace';
      })
    );
    expect(hunks.map((hunk) => hunk.title)).toEqual(['Header']);
  });
});
