import type { ReactNode } from 'react';
import { Undo2, type LucideIcon } from 'lucide-react';
import { AppButton, Text, type TextVariant } from '@/components/ui-kit';

/* The pieces every suggestion body is built from: captions, lines, and quiet links. */

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text as="p" variant="tag" className="mt-3 mb-1.5 flex items-center gap-1.75 first:mt-0.5">
      {children}
    </Text>
  );
}

/** A small label beside a caption: "in your words", "same words". */
export function CaptionTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-4 items-center rounded-[0.25rem] bg-line px-1.25 text-ink-soft">
      {children}
    </span>
  );
}

/** Words in a caption that say where, in the ordinary case: "after “Reduced p99…”". */
export function CaptionNote({ children }: { children: ReactNode }) {
  return (
    <Text variant="secondary" className="tracking-normal text-ink-soft normal-case">
      {children}
    </Text>
  );
}

interface LinesProps {
  lines: ReactNode[];
  isNumbered: boolean;
  variant: TextVariant;
  className?: string;
}

/** Lines of the user's own text, numbered when there are several. */
export function Lines({ lines, isNumbered, variant, className }: LinesProps) {
  return lines.map((line, index) => (
    <div key={index} className="flex items-start gap-1.75 [&+&]:mt-1">
      {isNumbered && (
        <Text variant="meta" className="min-w-2.5 text-ink-faint">
          {index + 1}
        </Text>
      )}
      <Text variant={variant} className={className}>
        {line}
      </Text>
    </div>
  ));
}

/** A quiet text button under a body: back to an earlier choice. */
export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <AppButton variant="quiet" size="xs" onClick={onClick} className="mt-1.5 -ml-2">
      <Undo2 className="size-2.75" />
      {children}
    </AppButton>
  );
}

/** A line of quiet explanation under a body, with its icon. */
export function TagLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 text-ink-muted">
      <Icon className="mt-0.75 size-3 shrink-0" />
      <Text variant="secondary" className="text-pretty text-ink-muted">
        {children}
      </Text>
    </div>
  );
}
