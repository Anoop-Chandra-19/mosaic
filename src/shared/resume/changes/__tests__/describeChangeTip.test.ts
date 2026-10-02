import { describe, expect, it } from 'vitest';
import { describeChangeTip } from '../describeChanges';
import { diffResumes } from '../diffResumes';
import { createChangeFixture, editFixture, findEntry, findSection } from './changeFixtures';

const draft = createChangeFixture();
const tipsAgainstDraft = (edit: Parameters<typeof editFixture>[0], otherSide = 'your draft') =>
  diffResumes(draft, editFixture(edit)).changes.map((change) =>
    describeChangeTip(change, otherSide)
  );

describe('describeChangeTip', () => {
  it('says what the other side has, in the design’s words', () => {
    expect(
      tipsAgainstDraft((doc) => {
        const job = findEntry(doc, 'work', 'babbage');
        job.bullets[1].text = 'Checked every table twice.';
        job.dates = '2023 to 2024';
        job.location = '';
        job.bullets[0].selected = false;
        job.bullets.splice(2, 1);
        findEntry(doc, 'projects', 'loom').dates = '1843';
      })
    ).toEqual([
      'On the page in your draft. Left off here, still in the document.',
      'Location in your draft: London. Empty here.',
      'Dates in your draft: 2024',
      'Your draft reads: Checked every table by hand.',
      'Only in your draft. Not in this version.',
      'Empty in your draft.',
    ]);
  });

  it('says where a moved thing was', () => {
    expect(
      tipsAgainstDraft((doc) => {
        const [translator] = findSection(doc, 'work').items.splice(1, 1);
        findSection(doc, 'projects').items.push(translator);
      })
    ).toEqual(['Was in Work History in your draft.']);
  });

  it('says how far a moved thing is from where the other side has it', () => {
    expect(
      tipsAgainstDraft((doc) => {
        findSection(doc, 'work').items.reverse();
      })
    ).toEqual(['1 place higher than in your draft.']);
    expect(
      tipsAgainstDraft((doc) => {
        const job = findEntry(doc, 'work', 'babbage');
        job.bullets.push(job.bullets.shift()!);
      })
    ).toEqual(['2 places lower than in your draft.']);
  });

  it('keeps a version label lower case at the start of a sentence', () => {
    expect(
      tipsAgainstDraft((doc) => {
        findEntry(doc, 'work', 'babbage').bullets[1].text = 'Checked every table twice.';
      }, 'v3')
    ).toEqual(['v3 reads: Checked every table by hand.']);
  });
});
