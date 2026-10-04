import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppInput } from '../AppInput';
import { AppTextarea } from '../AppTextarea';

function classesOf(markup: string) {
  return markup.match(/class="([^"]*)"/)![1].split(' ');
}

describe('AppInput', () => {
  it('passes the input its own attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(AppInput, { type: 'password', 'aria-label': 'API key', maxLength: 20 })
    );
    expect(markup).toContain('type="password"');
    expect(markup).toContain('aria-label="API key"');
    expect(markup).toContain('maxLength="20"');
  });

  it("lets the caller's size and height replace the field's, at every width", () => {
    const classes = classesOf(
      renderToStaticMarkup(createElement(AppInput, { className: 'h-7 text-[0.7188rem]' }))
    );
    expect(classes).toEqual(expect.arrayContaining(['h-7', 'text-[0.7188rem]']));
    expect(classes).not.toContain('text-body');
    expect(classes.filter((name) => name.startsWith('md:'))).toEqual([]);
  });
});

describe('AppTextarea', () => {
  it('grows with its text unless given a height', () => {
    const grows = classesOf(renderToStaticMarkup(createElement(AppTextarea)));
    expect(grows).toEqual(expect.arrayContaining(['field-sizing-content', 'h-auto']));
    const fixed = classesOf(
      renderToStaticMarkup(createElement(AppTextarea, { className: 'h-30' }))
    );
    expect(fixed).toContain('h-30');
    expect(fixed).not.toContain('h-auto');
  });
});
