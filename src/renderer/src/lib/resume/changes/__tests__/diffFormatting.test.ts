import { describe, expect, it } from 'vitest';
import { describeFormattingChange, describeFormattingDifference } from '../describeChanges';
import { diffFormatting } from '../diffFormatting';
import { diffResumes } from '../diffResumes';
import { createChangeFixture, editFixture } from './changeFixtures';

const before = createChangeFixture();
const restyled = editFixture((doc) => {
  const { header } = doc.contact;
  header.linkStyle = 'underline';
  header.linkColor = 'blue';
  header.lines[0].align = 'left';
  header.lines[0].separator = ' · ';
});

describe('diffFormatting', () => {
  it('finds nothing when only the words differ', () => {
    const renamed = editFixture((doc) => {
      doc.contact.name = 'Augusta Ada King';
    });
    expect(diffFormatting(before, renamed)).toEqual([]);
  });

  it('reads each setting as the change list and Changes only show it', () => {
    expect(
      diffFormatting(before, restyled).map((change) => {
        const { row, setting, from, to } = describeFormattingChange(change, 'your draft');
        return [row, `${setting}: ${from} → ${to}`];
      })
    ).toEqual([
      ['Links underlined, plain in your draft', 'Links: Plain → Underlined'],
      ['Links blue, black in your draft', 'Link color: Black → Blue'],
      [
        'Header line 1 left-aligned, centered in your draft',
        'Header line 1 alignment: Centered → Left',
      ],
      ['Header line 1 separated by “·”, by “|” in your draft', 'Header line 1 separator: | → ·'],
    ]);
  });

  it('says it in one sentence per thing on the page, for the banner', () => {
    expect(describeFormattingDifference(diffFormatting(before, restyled), 'your draft')).toBe(
      'Its links are underlined and blue (plain and black in your draft). ' +
        'Its header line 1 is left-aligned and separated by “·” ' +
        '(centered and separated by “|” in your draft).'
    );
  });

  it('calls a run of spaces "spaces"', () => {
    const spaced = editFixture((doc) => {
      doc.contact.header.lines[0].separator = '    ';
    });
    const [change] = diffFormatting(before, spaced);
    expect(describeFormattingChange(change, 'v3')).toMatchObject({
      row: 'Header line 1 separated by spaces, by “|” in v3',
      to: 'spaces',
    });
  });

  it('leaves out what does not show on both pages', () => {
    const oneItem = editFixture((doc) => {
      doc.contact.header.lines[0].items[1].shown = false;
      doc.contact.header.lines[0].separator = ' · ';
    });
    expect(diffFormatting(before, oneItem)).toEqual([]);
    const noHeader = editFixture((doc) => {
      const [line] = doc.contact.header.lines;
      for (const item of line.items) item.shown = false;
      line.align = 'left';
      doc.contact.header.linkStyle = 'underline';
    });
    expect(diffFormatting(before, noHeader)).toEqual([]);
  });

  it('is never part of the content diff', () => {
    expect(diffResumes(before, restyled).changes).toEqual([]);
  });
});
