import { describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { ResumeData } from '@shared/types/resume';
import { normalizeResumeForExport } from '../../normalizeResumeExport';
import { findCharactersPdfCannotDraw } from '../findCharactersPdfCannotDraw';

function resumeWith(name: string, bullet: string): ResumeData {
  const doc = createDefaultResume();
  doc.contact.name = name;
  doc.sections[1].items[0].bullets[0].text = bullet;
  return doc;
}

const find = (doc: ResumeData, includeHidden = false) =>
  findCharactersPdfCannotDraw(normalizeResumeForExport(doc, { includeHidden }));

describe('findCharactersPdfCannotDraw', () => {
  it('finds nothing in Western European text and typographic marks', () => {
    expect(find(resumeWith('Zoë Müller-Façade', 'Raised “uptime” to 99.9% — €2M saved…'))).toEqual(
      []
    );
  });

  it('names each character the font lacks, once, in the order it appears', () => {
    expect(find(resumeWith('Łukasz Wójcik', 'Led the Пример rollout, then Łódź'))).toEqual([
      'Ł',
      'П',
      'р',
      'и',
      'м',
      'е',
      'ź',
    ]);
  });

  it('looks only at what the PDF would print', () => {
    const doc = resumeWith('Ada', 'Ran the team');
    doc.sections[1].items[0].bullets[1].text = '李明';
    doc.sections[1].items[0].bullets[1].selected = false;

    expect(find(doc)).toEqual([]);
    expect(find(doc, true)).toEqual(['李', '明']);
  });
});
