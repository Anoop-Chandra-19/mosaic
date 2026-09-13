import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import { countChangedLines } from '../versionDiff';

describe('countChangedLines', () => {
  it('finds nothing between identical documents', () => {
    expect(countChangedLines(createDefaultResume(), createDefaultResume())).toBe(0);
  });

  it('counts reworded, added, and removed lines', () => {
    const version = createDefaultResume();
    const draft = createDefaultResume();
    const job = draft.sections[1].items[0];
    job.bullets[0].text = 'Reworded';
    job.bullets.push({ id: 'new', text: 'Added', selected: true });
    job.bullets.splice(1, 1);

    expect(countChangedLines(version, draft)).toBe(3);
  });

  it('treats hiding a bullet as removing it from the page', () => {
    const draft = createDefaultResume();
    draft.sections[1].items[0].bullets[0].selected = false;

    expect(countChangedLines(createDefaultResume(), draft)).toBe(1);
  });

  it('counts a contact change once', () => {
    const draft = createDefaultResume();
    draft.contact.name = 'Ada';
    draft.contact.email = 'ada@example.com';

    expect(countChangedLines(createDefaultResume(), draft)).toBe(1);
  });
});
