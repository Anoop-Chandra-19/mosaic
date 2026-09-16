import { describe, expect, it } from 'vitest';
import type { ResumeHeader } from '@/types/resume';
import { headerHref, headerLineText, newHeaderItem, printedHeaderLines } from '../resumeHeader';

describe('headerHref', () => {
  const href = (url: string) => headerHref({ url });

  it('mails an address and calls a number', () => {
    expect(href('ada@example.com')).toBe('mailto:ada@example.com');
    expect(href('(555) 010-0100')).toBe('tel:5550100100');
    expect(href('+44 20 7946 0958')).toBe('tel:+442079460958');
  });

  it('opens anything else with a dot or a slash on the web', () => {
    expect(href('linkedin.com/in/ada')).toBe('https://linkedin.com/in/ada');
    expect(href('ada.dev')).toBe('https://ada.dev');
  });

  it('keeps a link that already says how it opens', () => {
    expect(href('https://ada.dev/cv')).toBe('https://ada.dev/cv');
    expect(href('mailto:ada@example.com')).toBe('mailto:ada@example.com');
    expect(href('tel:+15550100')).toBe('tel:+15550100');
  });

  it('links nothing for words, a short number, or nothing typed', () => {
    expect(href('')).toBe('');
    expect(href('  ')).toBe('');
    expect(href('Remote')).toBe('');
    expect(href('2028')).toBe('');
  });

  it('goes by what was typed, never by the item’s kind', () => {
    const phone = newHeaderItem('custom', { url: '555-010-0100' });
    const site = newHeaderItem('phone', { url: 'ada.dev' });
    expect([headerHref(phone), headerHref(site)]).toEqual(['tel:5550100100', 'https://ada.dev']);
  });
});

describe('printedHeaderLines', () => {
  it('leaves off hidden items and items with no text, and lines left with nothing', () => {
    const header: ResumeHeader = {
      linkStyle: 'plain',
      lines: [
        {
          id: 'one',
          separator: ' | ',
          align: 'center',
          items: [
            { ...newHeaderItem('email', { text: ' ada@example.com ', url: 'ada@example.com' }) },
            { ...newHeaderItem('linkedin', { text: 'LinkedIn', url: 'x.com' }), shown: false },
            newHeaderItem('github', { url: 'github.com/ada' }),
            newHeaderItem('custom', { text: 'Open to relocation' }),
          ],
        },
        {
          id: 'two',
          separator: ' · ',
          align: 'left',
          items: [newHeaderItem('location', { url: 'maps.example/london' })],
        },
      ],
    };

    const lines = printedHeaderLines(header);
    expect(lines.map((line) => line.id)).toEqual(['one']);
    expect(lines[0].items.map(({ text, href }) => [text, href])).toEqual([
      ['ada@example.com', 'mailto:ada@example.com'],
      ['Open to relocation', ''],
    ]);
    expect(headerLineText(lines[0])).toBe('ada@example.com | Open to relocation');
  });
});
