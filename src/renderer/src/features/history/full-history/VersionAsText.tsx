import type { ReactNode } from 'react';
import { Text } from '@/components/Text';
import { normalizeResumeForExport } from '@/features/export/normalizeResumeExport';
import type { ResumeData } from '@shared/types/resume';

interface VersionAsTextProps {
  resume: ResumeData;
  /** Why this is text and not the printed page. */
  note: ReactNode;
}

/**
 * A version as prose, for a pane too narrow to show the printed page legibly: what prints,
 * in the order it prints, without the page's layout.
 */
export function VersionAsText({ resume, note }: VersionAsTextProps) {
  const { contact, sections } = normalizeResumeForExport(resume);
  return (
    <Text as="div" variant="body" className="mx-auto block w-full max-w-105 px-4">
      {note}
      <Text as="h4" variant="editor" className="mb-1.5 block">
        {contact.name}
      </Text>
      {sections.map((section) => (
        <section key={section.id}>
          <Text
            as="h5"
            variant="tag"
            className="mt-3.5 mb-1.5 block border-b border-line pb-0.75 text-ink-faint"
          >
            {section.label}
          </Text>
          {section.entries.map((entry) =>
            entry.text ? (
              <p key={entry.id} className="mb-1 text-ink-muted">
                {entry.text}
              </p>
            ) : (
              <div key={entry.id} className="mb-2.25">
                <Text as="p" variant="secondary" className="font-strong text-foreground">
                  {entry.heading}
                  {entry.dates && (
                    <span className="font-regular text-ink-muted"> · {entry.dates}</span>
                  )}
                </Text>
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
    </Text>
  );
}
