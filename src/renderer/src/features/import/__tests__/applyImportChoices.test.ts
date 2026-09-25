import { describe, expect, it } from 'vitest';
import { applyImportChoices, type PlaceTarget } from '../applyImportChoices';
import { describeImport } from '../buildImportedResume';
import { parseResumeText } from '../parsing/parseResume';

const parsed = parseResumeText(
  [
    'Ada Lovelace',
    'ada@example.com',
    'Speaker at the Royal Society on engines that compose music.',
    '',
    'Summary',
    'Writes programs for engines.',
    '',
    'Experience',
    'Analyst | 1842',
    '- Wrote the first program',
    '- Corrected the tables',
    'Tutor | 1840',
    '- Taught logic',
    '',
    'Skills',
    'Mathematics',
    'Python ●●●●○   Go ●●●●●',
  ].join('\n')
);
const [summary, experience, skills] = parsed.resume.sections;
const [analyst, tutor] = experience.items;

const apply = (dropped: string[] = [], placed: [number, PlaceTarget][] = []) =>
  applyImportChoices(parsed, { dropped: new Set(dropped), placed: new Map(placed) });

const labels = (result: ReturnType<typeof apply>) =>
  result.resume.sections.map((section) => [section.label, section.kind, section.order]);

describe('applyImportChoices', () => {
  it('is the parse itself when nothing was chosen', () => {
    const result = apply();
    expect(result.resume).toEqual(parsed.resume);
    expect(result.leftOut).toEqual(parsed.leftOut);
    expect(parsed.leftOut.map((line) => line.reason)).toEqual(['no-heading', 'rating-marks']);
  });

  it('takes out dropped sections, entries, and bullets, and numbers what stays', () => {
    const result = apply([summary.id, tutor.id, analyst.bullets[1].id]);
    expect(labels(result)).toEqual([
      ['Experience', 'experience', 0],
      ['Skills', 'skills', 1],
    ]);
    const [kept] = result.resume.sections[0].items;
    expect(result.resume.sections[0].items).toHaveLength(1);
    expect(kept.bullets.map((bullet) => bullet.text)).toEqual(['Wrote the first program']);
  });

  it('drops a section left with nothing in it, but keeps an entry left with no bullets', () => {
    const result = apply([summary.items[0].id, ...tutor.bullets.map((bullet) => bullet.id)]);
    expect(labels(result).map(([label]) => label)).toEqual(['Experience', 'Skills']);
    expect(result.resume.sections[0].items[1]).toMatchObject({ title: 'Tutor', bullets: [] });
  });

  it('places a line as a line in a lines section and as an entry in an entries section', () => {
    const result = apply(
      [],
      [
        [0, { sectionId: experience.id }],
        [1, { sectionId: skills.id }],
      ]
    );
    const [, placedExperience, placedSkills] = result.resume.sections;
    expect(placedExperience.items.at(-1)).toMatchObject({
      title: 'Speaker at the Royal Society on engines that compose music.',
      bullets: [],
    });
    // A rated skill comes without its marks.
    expect(placedSkills.items.map((item) => item.text)).toEqual(['Mathematics', 'Python, Go']);
    expect(result.leftOut).toEqual([]);
  });

  it('makes a section for lines sent to a new one, named after the heading they sat under', () => {
    const result = apply(
      [skills.id],
      [
        [0, 'new'],
        [1, 'new'],
      ]
    );
    expect(labels(result)).toEqual([
      ['Summary', 'summary', 0],
      ['Experience', 'experience', 1],
      ['Other', 'custom', 2],
      ['Skills', 'skills', 3],
    ]);
    expect(result.resume.sections[3].items.map((item) => item.text)).toEqual(['Python, Go']);
  });

  it('places nothing in a section that was dropped', () => {
    const result = apply([skills.id], [[1, { sectionId: skills.id }]]);
    expect(labels(result).map(([label]) => label)).toEqual(['Summary', 'Experience']);
  });

  it('counts what will be written', () => {
    const result = apply([tutor.id], [[1, { sectionId: skills.id }]]);
    expect(describeImport(result)).toMatchObject({
      sectionCount: 3,
      entryCount: 1,
      bulletCount: 2,
      lineCount: 3,
    });
  });
});
