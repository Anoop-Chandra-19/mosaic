import { describe, expect, it } from 'vitest';
import { linkText } from '../importLines';

describe('linkText', () => {
  it('shows the words and the address, unless the words are the address', () => {
    expect(linkText('LinkedIn', 'https://linkedin.com/in/ada')).toBe(
      'LinkedIn https://linkedin.com/in/ada'
    );
    expect(linkText('ada@example.com', 'mailto:ada@example.com')).toBe('ada@example.com');
    expect(linkText('www.Ada.dev', 'https://ada.dev/')).toBe('https://ada.dev/');
    expect(linkText('', 'https://ada.dev')).toBe('https://ada.dev');
  });

  it('drops the words only when they are the same address, not part of it', () => {
    expect(linkText('ada.dev', 'https://ada.dev/blog')).toBe('ada.dev https://ada.dev/blog');
    expect(linkText('ada@example.com', 'mailto:lovelace@example.com')).toBe(
      'ada@example.com lovelace@example.com'
    );
  });
});
