import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { AppButton } from './AppButton';

function getClasses(markup: string) {
  return markup.match(/class="([^"]*)"/)![1].split(' ');
}

describe('AppButton', () => {
  it('preserves standard primitive styling', () => {
    const props = { variant: 'outline', size: 'sm', children: 'Save' } as const;
    expect(getClasses(renderToStaticMarkup(createElement(AppButton, props)))).toEqual(
      getClasses(renderToStaticMarkup(createElement(Button, props)))
    );
  });

  it('defaults to a non-submit button but permits explicit submit', () => {
    expect(renderToStaticMarkup(createElement(AppButton, null, 'Save'))).toContain('type="button"');
    expect(renderToStaticMarkup(createElement(AppButton, { type: 'submit' }, 'Save'))).toContain(
      'type="submit"'
    );
  });

  it('forwards disabled, aria and Radix state props while keeping primitive focus styles', () => {
    const markup = renderToStaticMarkup(
      createElement(AppButton, {
        variant: 'muted',
        size: 'icon-xs',
        disabled: true,
        'aria-label': 'Actions',
        'data-state': 'open',
      } as Parameters<typeof AppButton>[0])
    );
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="Actions"');
    expect(markup).toContain('data-state="open"');
    expect(markup).toContain('data-variant="muted"');
    expect(getClasses(markup)).toContain('focus-visible:border-ring');
    expect(getClasses(markup)).toContain('data-[state=open]:bg-accent');
  });

  it('supports asChild without adding button semantics to a link', () => {
    const markup = renderToStaticMarkup(
      createElement(
        AppButton,
        { asChild: true, variant: 'muted' },
        createElement('a', { href: '#help' }, 'Help')
      )
    );
    expect(markup).toMatch(/^<a /);
    expect(markup).toContain('href="#help"');
    expect(markup).not.toContain('type="button"');
  });

  it('gives inline editing intrinsic size and wrapping instead of standard button layout', () => {
    const classes = getClasses(
      renderToStaticMarkup(createElement(AppButton, { variant: 'inline-edit' }, 'Edit text'))
    );
    expect(classes).toEqual(
      expect.arrayContaining([
        'block',
        'h-auto',
        'p-0',
        'shrink',
        'whitespace-normal',
        'font-normal',
      ])
    );
    for (const inherited of ['inline-flex', 'h-9', 'px-4', 'shrink-0', 'whitespace-nowrap']) {
      expect(classes).not.toContain(inherited);
    }
  });

  it('keeps link chips shrinkable without icon-conditioned padding', () => {
    const classes = getClasses(
      renderToStaticMarkup(createElement(AppButton, { variant: 'link-chip' }, 'example.com'))
    );
    expect(classes).toEqual(
      expect.arrayContaining(['h-auto', 'max-w-full', 'min-w-0', 'shrink', 'px-1'])
    );
    expect(classes.some((value) => value.startsWith('has-[>svg]:'))).toBe(false);
  });

  it('combines emphasis with compact sizing and lets callers override layout', () => {
    const classes = getClasses(
      renderToStaticMarkup(
        createElement(
          AppButton,
          { variant: 'emphasis', size: 'compact', className: 'px-3' },
          'Save'
        )
      )
    );
    expect(classes).toEqual(expect.arrayContaining(['bg-amber-500', 'h-7', 'text-xs', 'px-3']));
    expect(classes).not.toContain('px-2');
    expect(classes.some((value) => value.startsWith('has-[>svg]:'))).toBe(false);
  });
});
