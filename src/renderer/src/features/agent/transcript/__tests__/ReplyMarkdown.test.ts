import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReplyMarkdown } from '../ReplyMarkdown';

/** The markup without its classes, so the tests read as structure. */
const render = (text: string, isWriting = false) =>
  renderToStaticMarkup(createElement(ReplyMarkdown, { text, isWriting }))
    .replace(/ class="[^"]*"/g, '')
    .replace(/<i aria-hidden="true"><\/i>/g, '▍');

describe('ReplyMarkdown', () => {
  it('draws what the assistant formats', () => {
    const markup = render('**Strongest:** the *billing* work.\n\n- Go\n- `SQL`');
    expect(markup).toContain('<strong>Strongest:</strong> the <em>billing</em> work.');
    expect(markup).toContain('<ul>\n<li>Go</li>\n<li><code>SQL</code></li>\n</ul>');
    expect(render('| Skill | Years |\n| --- | --- |\n| Go | 6 |')).toContain(
      '<thead><tr><th>Skill</th><th>Years</th></tr></thead><tbody><tr><td>Go</td><td>6</td></tr></tbody>'
    );
  });

  it('never lets HTML or an unsafe address through', () => {
    const markup = render('<img src="x" onerror="alert(1)"> and [click](javascript:alert(1))');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('href');
    expect(markup).toContain('click');
  });

  it('opens a link in the browser', () => {
    expect(render('[The posting](https://example.com/jobs/1)')).toContain(
      '<a href="https://example.com/jobs/1" target="_blank" rel="noreferrer">The posting</a>'
    );
  });

  it('while writing, closes what is still open and puts the caret after the newest words', () => {
    expect(render('- Go\n- **Postg', true)).toContain('<li><strong>Postg▍</strong></li>');
    expect(render('Read [the posting](https://exa', true)).toBe(
      '<div><p>Read the posting▍</p></div>'
    );
  });

  it('while writing, draws its finished blocks as the written reply does', () => {
    const finished =
      '**One.**\n\n- Go\n\n- SQL\n\n| Skill |\n| --- |\n| Go |\n\n```\ncode\n\nmore\n```\n\n';
    // Line breaks between blocks draw nothing; a whole parse has them and separate ones don't.
    const withoutBreaks = (markup: string) => markup.replaceAll('>\n<', '><');
    expect(withoutBreaks(render(`${finished}Two.`, true).replace('▍', ''))).toBe(
      withoutBreaks(render(`${finished}Two.`))
    );
  });

  it('while writing nothing yet, shows the wait, with no caret', () => {
    const markup = render('', true);
    expect(markup).toContain('<svg');
    expect(markup).not.toContain('▍');
  });

  it('while writing, holds back a line of markers alone until its words come', () => {
    const markup = render('Strongest points:\n\n**', true);
    expect(markup).not.toContain('<hr');
    expect(markup).toBe('<div><p>Strongest points:▍</p></div>');
  });
});
