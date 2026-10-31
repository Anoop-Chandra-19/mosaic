import type { ReactNode } from 'react';
import type { EntryHeadingFields } from '@/lib/resume/entryHeading';
import type { SectionLayout } from '@shared/types/resume';
import { HEADLESS_LAYOUT as LYT } from '@/lib/resume/headlessLayout';
import { cn } from '@/lib/utils';
import type { PageDecorations } from './pageDecorations';

export interface PreviewBullet {
  /** This copy's, unique on the pages. */
  id: string;
  /** The bullet it is part of, when the pages split it. */
  sourceId?: string;
  text: string;
  /** The rest of a bullet carried over from the page before, so it has no marker. */
  isContinued?: boolean;
}

export interface PreviewEntry {
  /** This copy's, unique on the pages. */
  id: string;
  /** The entry it is all or part of, when the pages carry it over or split it. */
  sourceId?: string;
  /** The printed left side: title, organization, and location (`formatEntryHeading`). */
  heading?: string;
  /** The heading's parts, for a surface that draws them one by one. */
  fields?: EntryHeadingFields;
  dates?: string;
  text?: string;
  bullets: PreviewBullet[];
}

export interface PreviewRenderableSection {
  id: string;
  layout: SectionLayout;
  label: string;
  entries: PreviewEntry[];
  /** Carried over from the page before, so it has no title. */
  isContinued?: boolean;
}

interface PreviewSectionProps {
  section: PreviewRenderableSection;
  decorations?: PageDecorations;
}

const bodyText = {
  fontSize: `${LYT.bodyFontSize}px`,
  lineHeight: `${LYT.bodyLeading}px`,
};

const decorate = (
  slot: ((id: string, text: string) => ReactNode) | undefined,
  id: string,
  text: string
) => (slot ? slot(id, text) : text);

/**
 * What the page's copy of a thing is called to everyone outside the page: a surface marks, finds
 * and outlines the entry or bullet, wherever the pages put it or however they split it.
 */
const readSourceId = ({ id, sourceId }: { id: string; sourceId?: string }) => sourceId ?? id;

export function PreviewSection({ section, decorations }: PreviewSectionProps) {
  const isTextOnly = section.layout === 'lines';
  const positioned = cn(decorations && 'relative');

  return (
    <section
      style={{
        fontFamily: LYT.fontStack,
        color: LYT.color,
        // One blank body line above each section header, none above the first.
        marginTop: `${LYT.bodyLeading}px`,
      }}
      className={cn('first:mt-0', decorations?.blockClassName?.(section.id))}
      data-preview-section-id={section.id}
    >
      {/*
        Section headers are the only bold text below the name, and are
        deliberately not uppercased or letter-spaced: both mangle the text
        extraction that ATS parsers rely on.
      */}
      {!section.isContinued && (
        <h2
          className={cn('font-bold', positioned)}
          style={bodyText}
          data-preview-section-title-id={section.id}
        >
          {decorate(decorations?.sectionLabel, section.id, section.label)}
        </h2>
      )}

      <div>
        {section.entries.map((entry) =>
          isTextOnly ? (
            <p
              key={entry.id}
              className={positioned}
              style={bodyText}
              data-preview-entry-id={readSourceId(entry)}
              data-preview-entry-key={`${section.id}::${readSourceId(entry)}`}
              data-preview-section-id={section.id}
            >
              {decorate(decorations?.line, readSourceId(entry), entry.text ?? '')}
            </p>
          ) : (
            <article
              key={entry.id}
              className={decorations?.blockClassName?.(readSourceId(entry))}
              data-preview-entry-id={readSourceId(entry)}
              data-preview-entry-key={`${section.id}::${readSourceId(entry)}`}
              data-preview-section-id={section.id}
            >
              {(entry.heading || entry.dates) && (
                // Job and project lines are italic, never bold. Only an entry
                // that has bullets needs the gap beneath its title line.
                <div
                  className={cn('flex items-baseline justify-between italic', positioned)}
                  style={{
                    ...bodyText,
                    gap: `${LYT.entryHeadingGap}px`,
                    marginBottom:
                      entry.bullets.length > 0 ? `${LYT.entryHeadingMarginBottom}px` : 0,
                  }}
                  data-preview-entry-heading-key={`${section.id}::${readSourceId(entry)}`}
                >
                  <h3>
                    {decorations?.entryHeading
                      ? decorations.entryHeading(
                          readSourceId(entry),
                          entry.heading ?? '',
                          entry.fields
                        )
                      : entry.heading}
                  </h3>
                  {entry.dates && (
                    <p className="shrink-0 text-right">
                      {decorate(decorations?.entryDates, readSourceId(entry), entry.dates)}
                    </p>
                  )}
                </div>
              )}

              {entry.bullets.length > 0 && (
                // Bullet spacing comes entirely from the 18pt leading. Any extra
                // margin here is what pushes a rendering off the format's grid.
                <ul
                  className="list-disc"
                  style={{
                    ...bodyText,
                    paddingLeft: `${LYT.bulletTextIndent}px`,
                  }}
                >
                  {entry.bullets.map((bullet) => (
                    <li
                      key={bullet.id}
                      className={cn(bullet.isContinued && 'list-none', positioned)}
                      data-preview-bullet-id={readSourceId(bullet)}
                    >
                      {decorate(decorations?.bullet, readSourceId(bullet), bullet.text)}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          )
        )}
      </div>
    </section>
  );
}
