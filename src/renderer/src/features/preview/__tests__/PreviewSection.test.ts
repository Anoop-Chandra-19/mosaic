import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PreviewSection, type PreviewRenderableSection } from '../PreviewSection';

const CARRIED: PreviewRenderableSection = {
  id: 'work',
  layout: 'entries',
  label: 'Experience',
  entries: [
    {
      id: 'job-cont-3',
      sourceId: 'job',
      heading: 'Analyst',
      dates: '2024',
      bullets: [{ id: 'b1-cont-4', sourceId: 'b1', text: 'The rest', isContinued: true }],
    },
  ],
};

describe('PreviewSection', () => {
  it('names what the pages carried over or split as what it came from', () => {
    const seen: string[] = [];
    const see = (slot: string) => (id: string, text: string) => {
      seen.push(`${slot}:${id}`);
      return text;
    };
    const markup = renderToStaticMarkup(
      createElement(PreviewSection, {
        section: CARRIED,
        decorations: {
          entryHeading: see('heading'),
          entryDates: see('dates'),
          bullet: see('bullet'),
          blockClassName: (id) => (id === 'job' ? 'leaving' : undefined),
        },
      })
    );
    expect(seen).toEqual(['heading:job', 'dates:job', 'bullet:b1']);
    expect(markup).toContain('class="leaving"');
    expect(markup).toContain('data-preview-entry-id="job"');
    expect(markup).toContain('data-preview-entry-heading-key="work::job"');
    expect(markup).toContain('data-preview-bullet-id="b1"');
  });
});
