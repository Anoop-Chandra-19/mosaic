import type { SectionType } from '@/types/resume';

export interface PreviewEntry {
  id: string;
  title?: string;
  subtitle?: string;
  text?: string;
  bullets: string[];
}

export interface PreviewRenderableSection {
  id: string;
  type: SectionType;
  label: string;
  entries: PreviewEntry[];
}

interface PreviewSectionProps {
  section: PreviewRenderableSection;
}

const TEXT_ONLY_TYPES = new Set<SectionType>(['summary', 'skills']);

export function PreviewSection({ section }: PreviewSectionProps) {
  const isTextOnly = TEXT_ONLY_TYPES.has(section.type);

  return (
    <section
      className="pt-3"
      style={{ fontFamily: 'Georgia, serif' }}
      data-preview-section-id={section.id}
    >
      <h2
        className="border-b border-zinc-300 pb-1 text-xs font-bold tracking-[0.18em] text-zinc-800 uppercase"
        data-preview-section-title-id={section.id}
      >
        {section.label}
      </h2>

      <div className="space-y-2.5 pt-2">
        {section.entries.map((entry) =>
          isTextOnly ? (
            <p
              key={entry.id}
              className="text-sm leading-6 text-zinc-800"
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {entry.text}
            </p>
          ) : (
            <article
              key={entry.id}
              className="space-y-1"
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {(entry.title || entry.subtitle) && (
                <div
                  className="flex items-baseline justify-between gap-3"
                  data-preview-entry-heading-key={`${section.id}::${entry.id}`}
                >
                  <h3 className="text-sm leading-6 font-semibold text-zinc-900">{entry.title}</h3>
                  {entry.subtitle && (
                    <p className="shrink-0 text-right text-xs leading-5 text-zinc-600">
                      {entry.subtitle}
                    </p>
                  )}
                </div>
              )}

              {entry.bullets.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-sm leading-6 text-zinc-800">
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
