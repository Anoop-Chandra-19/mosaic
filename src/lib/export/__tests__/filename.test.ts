import { describe, expect, it } from 'vitest';
import { buildPdfFileName } from '../filename';

const fixedDate = new Date(2026, 3, 23);

describe('buildPdfFileName', () => {
  it('prefers the template name over the contact name', () => {
    expect(
      buildPdfFileName({
        contactName: 'Alex Johnson',
        templateName: 'Backend Resume',
        paperSize: 'letter',
        now: fixedDate,
      })
    ).toBe('backend-resume-resume-letter-20260423.pdf');
  });

  it('falls back to the contact name', () => {
    expect(
      buildPdfFileName({
        contactName: 'Alex Johnson',
        paperSize: 'a4',
        now: fixedDate,
      })
    ).toBe('alex-johnson-resume-a4-20260423.pdf');
  });

  it('falls back to mosaic when names are empty', () => {
    expect(
      buildPdfFileName({
        contactName: '',
        templateName: '   ',
        paperSize: 'a4',
        now: fixedDate,
      })
    ).toBe('mosaic-resume-a4-20260423.pdf');
  });

  it('slugifies unsafe characters', () => {
    expect(
      buildPdfFileName({
        templateName: 'Alex / Resume: Senior+Frontend!',
        paperSize: 'letter',
        now: fixedDate,
      })
    ).toBe('alex-resume-senior-frontend-resume-letter-20260423.pdf');
  });
});
