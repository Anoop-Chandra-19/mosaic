import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppButton } from '../AppButton';

type Props = Parameters<typeof AppButton>[0];

function classesOf(props: Props) {
  const markup = renderToStaticMarkup(createElement(AppButton, props));
  return markup.match(/class="([^"]*)"/)![1].split(' ');
}

describe('AppButton', () => {
  it('defaults to a solid, medium, rectangular non-submit button', () => {
    const markup = renderToStaticMarkup(createElement(AppButton, null, 'Save'));
    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-variant="solid"');
    expect(markup).toContain('data-size="md"');
    expect(markup).toContain('data-shape="rect"');
    expect(classesOf({ children: 'Save' })).toEqual(
      expect.arrayContaining(['bg-foreground', 'h-9', 'rounded-md'])
    );
    expect(renderToStaticMarkup(createElement(AppButton, { type: 'submit' }, 'Save'))).toContain(
      'type="submit"'
    );
  });

  it('keeps the three axes independent', () => {
    const chip = classesOf({ variant: 'outline', size: '2xs', shape: 'pill' });
    expect(chip).toEqual(
      expect.arrayContaining(['border-line-strong', 'h-[1.375rem]', 'rounded-full'])
    );
    // The same size and shape in another tone changes only the tone.
    const dashed = classesOf({ variant: 'dashed', size: '2xs', shape: 'pill' });
    expect(dashed).toEqual(
      expect.arrayContaining(['border-dashed', 'h-[1.375rem]', 'rounded-full'])
    );
  });

  it('makes a square as wide as it is tall, with no side padding', () => {
    const classes = classesOf({ variant: 'ghost', size: 'xs', shape: 'square' });
    expect(classes).toEqual(expect.arrayContaining(['aspect-square', 'px-0', 'h-[1.625rem]']));
    expect(classes).not.toContain('px-[0.5625rem]');
  });

  it('lets text wrap like prose instead of keeping a button’s height', () => {
    const classes = classesOf({ variant: 'ghost', size: 'sm', shape: 'text' });
    expect(classes).toEqual(
      expect.arrayContaining(['block', 'h-auto', 'whitespace-normal', 'text-left'])
    );
    for (const layout of ['h-8', 'whitespace-nowrap', 'inline-flex']) {
      expect(classes).not.toContain(layout);
    }
  });

  it('forwards disabled, aria and Radix state props and keeps a focus ring', () => {
    const markup = renderToStaticMarkup(
      createElement(AppButton, {
        variant: 'ghost',
        disabled: true,
        'aria-label': 'Actions',
        'data-state': 'open',
      } as Props)
    );
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="Actions"');
    expect(markup).toContain('data-state="open"');
    expect(classesOf({ variant: 'ghost' })).toEqual(
      expect.arrayContaining([
        'focus-visible:ring-[3px]',
        'aria-[haspopup=menu]:data-[state=open]:bg-line-strong',
      ])
    );
  });

  it('supports asChild without adding button semantics to a link', () => {
    const markup = renderToStaticMarkup(
      createElement(
        AppButton,
        { asChild: true, variant: 'ghost' },
        createElement('a', { href: '#help' }, 'Help')
      )
    );
    expect(markup).toMatch(/^<a /);
    expect(markup).toContain('href="#help"');
    expect(markup).not.toContain('type="button"');
  });

  it('lets callers override typography and layout', () => {
    const classes = classesOf({ variant: 'accent', size: 'xs', className: 'px-3 font-semibold' });
    expect(classes).toEqual(expect.arrayContaining(['bg-amber-500', 'px-3', 'font-semibold']));
    expect(classes).not.toContain('px-[0.5625rem]');
    expect(classes).not.toContain('font-medium');
  });
});
