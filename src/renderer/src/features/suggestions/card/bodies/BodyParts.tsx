import type { ComponentProps, ReactNode } from 'react';
import { Undo2, type LucideIcon } from 'lucide-react';
import { AppButton, Text, type TextVariant } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/*
 * The pieces every suggestion body is built from: captions, lines, and quiet links.
 * A card inside `group/card` with `data-compact` (Preview's list) is compact: its hints
 * go, the suggested words read smaller, and captions sit closer.
 */

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text
      as="p"
      variant="tag"
      className="mt-3 mb-1.5 flex items-center gap-1.75 first:mt-0.5 group-data-compact/card:mt-0.5"
    >
      {children}
    </Text>
  );
}

/** The suggestion's own words, at reading size. */
export function SuggestedText({ className, ...props }: ComponentProps<'p'>) {
  return (
    <Text
      as="p"
      variant="body"
      className={cn('group-data-compact/card:text-support', className)}
      {...props}
    />
  );
}

/** A quiet line of guidance under a body, left out of a compact card. */
export function Hint({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Text
      as="p"
      variant="secondary"
      className={cn('mt-2 text-ink-faint group-data-compact/card:hidden', className)}
    >
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

type LinesLook = 'now' | 'suggested';

const LINES_LOOKS: Record<LinesLook, { variant: TextVariant; className: string }> = {
  now: { variant: 'secondary', className: 'text-ink-soft' },
  suggested: { variant: 'body', className: 'group-data-compact/card:text-support' },
};

interface LinesProps {
  lines: ReactNode[];
  isNumbered: boolean;
  /** The text as it is now, or as the suggestion would make it. */
  look: LinesLook;
}

/** Lines of text, numbered when there are several. */
export function Lines({ lines, isNumbered, look }: LinesProps) {
  const { variant, className } = LINES_LOOKS[look];
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
