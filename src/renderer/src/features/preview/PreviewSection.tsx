import type { EntryHeadingFields } from '@shared/resume/entryHeading';
import type { SectionLayout } from '@shared/types/resume';
import { MarkedDates, MarkedHeading, MarkedLine } from '@/features/document-diff/PageMarkParts';
import { findMarks, LINE_GUTTER, type PageMarks } from '@/features/document-diff/pageMarks';
import { HEADLESS_LAYOUT as LYT } from '@/lib/resume/headlessLayout';
import { cn } from '@/lib/utils';

export interface PreviewBullet {
  id: string;
  text: string;
  /** The rest of a bullet carried over from the page before, so it has no marker. */
  isContinued?: boolean;
}

export interface PreviewEntry {
  id: string;
  /** The printed left side: title, organization, and location (`formatEntryHeading`). */
  heading?: string;
  /** The heading's parts, for marking the one that changed. */
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
  /** What changed against another version, marked on the page; exports never pass this. */
  marks?: PageMarks;
}

const bodyText = {
  fontSize: `${LYT.bodyFontSize}px`,
  lineHeight: `${LYT.bodyLeading}px`,
};

/** A bullet's marks sit past its marker, in the same margin as a heading's. */
const BULLET_GUTTER = {
  barPx: LYT.bulletTextIndent + LINE_GUTTER.barPx,
  glyphPx: LYT.bulletTextIndent + LINE_GUTTER.glyphPx,
};

export function PreviewSection({ section, marks }: PreviewSectionProps) {
  const isTextOnly = section.layout === 'lines';
  const otherSide = marks?.otherSide ?? '';
  const markLine = (changes: ReturnType<typeof findMarks>, text: string, gutter = LINE_GUTTER) =>
    marks ? (
      <MarkedLine changes={changes} text={text} otherSide={otherSide} gutter={gutter} />
    ) : (
      text
    );

  return (
    <section
      style={{
        fontFamily: LYT.fontStack,
        color: LYT.color,
        // One blank body line above each section header, none above the first.
        marginTop: `${LYT.bodyLeading}px`,
      }}
      className="first:mt-0"
      data-preview-section-id={section.id}
    >
      {/*
        Section headers are the only bold text below the name, and are
        deliberately not uppercased or letter-spaced: both mangle the text
        extraction that ATS parsers rely on.
      */}
      {!section.isContinued && (
        <h2
          className={cn('font-bold', marks && 'relative')}
          style={bodyText}
          data-preview-section-title-id={section.id}
        >
          {markLine(findMarks(marks, 'section', section.id), section.label)}
        </h2>
      )}

      <div>
        {section.entries.map((entry) =>
          isTextOnly ? (
            <p
              key={entry.id}
              className={cn(marks && 'relative')}
              style={bodyText}
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {markLine(findMarks(marks, 'entry', entry.id), entry.text ?? '')}
            </p>
          ) : (
            <article
              key={entry.id}
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {(entry.heading || entry.dates) && (
                // Job and project lines are italic, never bold. Only an entry
                // that has bullets needs the gap beneath its title line.
                <div
                  className={cn('flex items-baseline justify-between italic', marks && 'relative')}
                  style={{
                    ...bodyText,
                    gap: `${LYT.entryHeadingGap}px`,
                    marginBottom:
                      entry.bullets.length > 0 ? `${LYT.entryHeadingMarginBottom}px` : 0,
                  }}
                  data-preview-entry-heading-key={`${section.id}::${entry.id}`}
                >
                  <h3>
                    {marks ? (
                      <MarkedHeading
                        changes={findMarks(marks, 'entry', entry.id)}
                        heading={entry.heading ?? ''}
                        fields={entry.fields ?? { title: '', organization: '', location: '' }}
                        otherSide={otherSide}
                      />
                    ) : (
                      entry.heading
                    )}
                  </h3>
                  {entry.dates && (
                    <p className="shrink-0 text-right">
                      {marks ? (
                        <MarkedDates
                          changes={findMarks(marks, 'entry', entry.id)}
                          dates={entry.dates}
                          otherSide={otherSide}
                        />
                      ) : (
                        entry.dates
                      )}
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
                      className={cn(bullet.isContinued && 'list-none', marks && 'relative')}
                      data-preview-bullet-id={bullet.id}
                    >
                      {markLine(findMarks(marks, 'bullet', bullet.id), bullet.text, BULLET_GUTTER)}
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
