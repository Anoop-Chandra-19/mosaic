import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppToggleGroup, AppToggleGroupItem } from '../AppToggleGroup';

function renderGroup(size: 'md' | 'sm', itemClassName?: string) {
  return renderToStaticMarkup(
    createElement(
      AppToggleGroup,
      { type: 'single', size, value: 'a4', 'aria-label': 'Paper size' },
      createElement(AppToggleGroupItem, { value: 'a4', className: itemClassName }, 'A4'),
      createElement(AppToggleGroupItem, { value: 'letter' }, 'Letter')
    )
  );
}

describe('AppToggleGroup', () => {
  it('marks the chosen option with aria-checked, which its look keys on', () => {
    const markup = renderGroup('md');
    expect(markup).toContain('aria-label="Paper size"');
    expect(markup).toMatch(/aria-checked="true"[^>]*>A4</);
    expect(markup).toMatch(/aria-checked="false"[^>]*>Letter</);
  });

  it('sizes its options from the group', () => {
    expect(renderGroup('md')).toContain('h-6 ');
    expect(renderGroup('sm')).toContain('h-5.5 ');
  });

  it("lets an option's own class replace the group's size", () => {
    const markup = renderGroup('sm', 'px-1.75');
    expect(markup).toContain('px-1.75');
    expect(markup.match(/class="[^"]*px-1\.75[^"]*"/)![0]).not.toContain('px-2 ');
  });
});
