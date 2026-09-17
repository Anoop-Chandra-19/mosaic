import { describe, expect, it } from 'vitest';
import type { ResumeHeader } from '@/types/resume';
import {
  resolveHeaderItemHref,
  formatHeaderLineText,
  createHeaderItem,
  getPrintableHeaderLines,
} from '../resumeHeader';

describe('resolveHeaderItemHref', () => {
  const href = (url: string) => resolveHeaderItemHref({ url });

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
    const phone = createHeaderItem('custom', { url: '555-010-0100' });
    const site = createHeaderItem('phone', { url: 'ada.dev' });
    expect([resolveHeaderItemHref(phone), resolveHeaderItemHref(site)]).toEqual([
      'tel:5550100100',
      'https://ada.dev',
    ]);
  });
});

describe('getPrintableHeaderLines', () => {
  it('leaves off hidden items and items with no text, and lines left with nothing', () => {
    const header: ResumeHeader = {
      linkStyle: 'plain',
      lines: [
        {
          id: 'one',
          separator: ' | ',
          align: 'center',
          items: [
            { ...createHeaderItem('email', { text: ' ada@example.com ', url: 'ada@example.com' }) },
            { ...createHeaderItem('linkedin', { text: 'LinkedIn', url: 'x.com' }), shown: false },
            createHeaderItem('github', { url: 'github.com/ada' }),
            createHeaderItem('custom', { text: 'Open to relocation' }),
          ],
        },
        {
          id: 'two',
          separator: ' · ',
          align: 'left',
          items: [createHeaderItem('location', { url: 'maps.example/london' })],
        },
      ],
    };

    const lines = getPrintableHeaderLines(header);
    expect(lines.map((line) => line.id)).toEqual(['one']);
    expect(lines[0].items.map(({ text, href }) => [text, href])).toEqual([
      ['ada@example.com', 'mailto:ada@example.com'],
      ['Open to relocation', ''],
    ]);
    expect(formatHeaderLineText(lines[0])).toBe('ada@example.com | Open to relocation');
  });
});
