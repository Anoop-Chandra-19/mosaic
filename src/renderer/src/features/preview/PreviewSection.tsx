import type { SectionLayout } from '@shared/types/resume';
import { HEADLESS_LAYOUT as LYT } from '@/lib/resume/headlessLayout';

export interface PreviewEntry {
  id: string;
  title?: string;
  subtitle?: string;
  text?: string;
  bullets: string[];
}

export interface PreviewRenderableSection {
  id: string;
  layout: SectionLayout;
  label: string;
  entries: PreviewEntry[];
}

interface PreviewSectionProps {
  section: PreviewRenderableSection;
}

const bodyText = {
  fontSize: `${LYT.bodyFontSize}px`,
  lineHeight: `${LYT.bodyLeading}px`,
};

export function PreviewSection({ section }: PreviewSectionProps) {
  const isTextOnly = section.layout === 'lines';

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
      <h2 className="font-bold" style={bodyText} data-preview-section-title-id={section.id}>
        {section.label}
      </h2>

      <div>
        {section.entries.map((entry) =>
          isTextOnly ? (
            <p
              key={entry.id}
              style={bodyText}
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {entry.text}
            </p>
          ) : (
            <article
              key={entry.id}
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {(entry.title || entry.subtitle) && (
                // Job and project lines are italic, never bold. Only an entry
                // that has bullets needs the gap beneath its title line.
                <div
                  className="flex items-baseline justify-between italic"
                  style={{
                    ...bodyText,
                    gap: `${LYT.entryHeadingGap}px`,
                    marginBottom:
                      entry.bullets.length > 0 ? `${LYT.entryHeadingMarginBottom}px` : 0,
                  }}
                  data-preview-entry-heading-key={`${section.id}::${entry.id}`}
                >
                  <h3>{entry.title}</h3>
                  {entry.subtitle && <p className="shrink-0 text-right">{entry.subtitle}</p>}
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
                  {entry.bullets.map((bullet, idx) => (
                    <li
                      key={`${entry.id}-${idx}`}
                      data-preview-bullet-key={`${section.id}::${entry.id}`}
                      data-preview-bullet-index={idx}
                    >
                      {bullet}
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
