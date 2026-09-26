import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import type { ResumeData } from '@shared/types/resume';

interface VersionAsTextProps {
  resume: ResumeData;
  /** Why this is text and not the printed page. */
  note: string;
}

/**
 * A version as prose, for a pane too narrow to show the printed page legibly: what prints,
 * in the order it prints, without the page's layout.
 */
export function VersionAsText({ resume, note }: VersionAsTextProps) {
  const { contact, sections } = normalizeResumeForExport(resume);
  return (
    <div className="mx-auto w-full max-w-105 px-4 text-[0.775rem] leading-normal text-ink-soft">
      <p className="mb-3 font-mono text-[0.725rem] leading-[1.45] text-ink-faint">{note}</p>
      <h4 className="mb-1.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">
        {contact.name}
      </h4>
      {sections.map((section) => (
        <section key={section.id}>
          <h5 className="mt-3.5 mb-1.5 border-b border-line pb-0.75 text-[0.625rem] font-bold tracking-[0.1em] text-ink-faint uppercase">
            {section.label}
          </h5>
          {section.entries.map((entry) =>
            entry.text ? (
              <p key={entry.id} className="mb-1 text-ink-muted">
                {entry.text}
              </p>
            ) : (
              <div key={entry.id} className="mb-2.25">
                <p className="text-[0.7875rem] font-semibold text-foreground">
                  {entry.heading}
                  {entry.dates && (
                    <span className="font-normal text-ink-muted"> · {entry.dates}</span>
                  )}
                </p>
                {entry.bullets.map((bullet, index) => (
                  <p
                    key={index}
                    className="relative mt-0.75 pl-3 text-pretty text-ink-muted before:absolute before:top-2 before:left-0.75 before:size-0.75 before:rounded-full before:bg-ink-faint"
                  >
                    {bullet}
                  </p>
                ))}
              </div>
            )
          )}
        </section>
      ))}
    </div>
  );
}
