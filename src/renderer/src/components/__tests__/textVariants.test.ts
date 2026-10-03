import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';
import { textVariantClasses, type TextVariant } from '../textVariants';

const VARIANTS: TextVariant[] = [
  'heading',
  'editor',
  'title',
  'body',
  'strong',
  'secondary',
  'meta',
  'eyebrow',
  'tag',
  'key',
];

const sizeOf = (classes: string) => classes.split(' ').find((name) => name.startsWith('text-'));

describe('type roles', () => {
  it('keep their size when a colour is passed beside them', () => {
    for (const variant of VARIANTS) {
      const base = textVariantClasses(variant);
      const merged = cn(base, 'text-amber-600').split(' ');
      expect(merged, variant).toContain(sizeOf(base));
      expect(merged, variant).toContain('text-amber-600');
    }
  });

  it('give way to another role, never both', () => {
    expect(cn('text-body', 'text-meta')).toBe('text-meta');
    expect(cn('font-regular', 'font-strong')).toBe('font-strong');
  });
});
