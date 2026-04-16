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
  const sectionBodyClass = isTextOnly
    ? 'space-y-[0.08rem] pt-[0.14rem]'
    : 'space-y-[0.34rem] pt-[0.28rem]';

  return (
    <section
      className="pt-[0.62rem] first:pt-[0.44rem]"
      style={{ fontFamily: '"Source Serif 4", serif' }}
      data-preview-section-id={section.id}
    >
      <h2
        className="border-b border-zinc-300 pb-[0.12rem] text-[0.76rem] font-bold tracking-[0.1em] text-zinc-900 uppercase"
        data-preview-section-title-id={section.id}
      >
        {section.label}
      </h2>

      <div className={sectionBodyClass}>
        {section.entries.map((entry) =>
          isTextOnly ? (
            <p
              key={entry.id}
              className="text-[0.81rem] leading-[1.31] text-zinc-800"
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {entry.text}
            </p>
          ) : (
            <article
              key={entry.id}
              className="space-y-[0.1rem]"
              data-preview-entry-id={entry.id}
              data-preview-entry-key={`${section.id}::${entry.id}`}
              data-preview-section-id={section.id}
            >
              {(entry.title || entry.subtitle) && (
                <div
                  className="flex items-baseline justify-between gap-3"
                  data-preview-entry-heading-key={`${section.id}::${entry.id}`}
                >
                  <h3 className="text-[0.83rem] leading-[1.2] font-semibold text-zinc-900">
                    {entry.title}
                  </h3>
                  {entry.subtitle && (
                    <p className="shrink-0 text-right text-[0.72rem] leading-[1.14] text-zinc-600">
                      {entry.subtitle}
                    </p>
                  )}
                </div>
              )}

              {entry.bullets.length > 0 && (
                <ul className="list-disc space-y-[0.1rem] pl-4 text-[0.81rem] leading-[1.31] text-zinc-800">
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
