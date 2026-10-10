import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertTriangle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Note } from '../Note';

type Props = Parameters<typeof Note>[0];

function renderNote(props: Partial<Props> = {}) {
  return renderToStaticMarkup(
    createElement(Note, { icon: AlertTriangle, children: 'Check the selected file.', ...props })
  );
}

describe('Note', () => {
  it('remains static by default and keeps its role, tone, size, and spacing', () => {
    const markup = renderNote({ tone: 'error', size: 'sm', role: 'alert', className: 'mt-2.5' });
    expect(markup).toMatch(/^<div role="alert"/);
    expect(markup).toContain('bg-del-soft');
    expect(markup).toContain('text-support');
    expect(markup).toContain('mt-2.5');
    expect(markup).toContain('Check the selected file.');
    expect(markup).not.toContain('data-state');
    expect(markup).not.toContain('inert');
    expect(markup.match(/^<div[^>]*>/)![0]).not.toContain('aria-hidden="true"');
  });

  it('renders nothing when opted into presence but initially hidden', () => {
    expect(renderNote({ isShown: false })).toBe('');
  });

  it('puts opt-in presence on the note itself without adding a wrapper', () => {
    const markup = renderNote({ isShown: true, role: 'alert' });
    expect(markup).toMatch(/^<div role="alert" data-state="open"/);
    expect(markup).toMatch(/^<div[^>]*><svg/);
    expect(markup.match(/<div\b/g)).toHaveLength(2);
    expect(markup).not.toContain('inert');
    expect(markup.match(/^<div[^>]*>/)![0]).not.toContain('aria-hidden="true"');
  });
});
