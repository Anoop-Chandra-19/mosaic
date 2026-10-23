import { AppButton } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import type { SuggestionDot as Dot } from './useSuggestionDot';

const DOT_LOOKS: Record<'current' | 'stale', string> = {
  current:
    'bg-amber shadow-[0_0_0_3px_var(--amber-soft)] group-hover/dot:shadow-[0_0_0_5px_var(--amber-soft)]',
  stale: 'shadow-[inset_0_0_0_1.5px_var(--ink-faint)]',
};

/**
 * The editor's only sign of a suggestion: a dot beside the bullet, line, entry or section
 * it waits on, whose words stay the user's until they apply. It opens the review on it.
 */
export function SuggestionDot({ dot, className }: { dot: Dot; className?: string }) {
  const openSurface = useOverlayStore((s) => s.openSurface);
  const title = dot.isStale
    ? 'Its suggestion is out of date: you changed this after it was made.'
    : `${dot.waiting} Click to review it.`;
  return (
    <AppButton
      variant="plain"
      size="2xs"
      aria-label="Review its suggestion"
      title={title}
      onClick={(event) => {
        // The words around it open their editor.
        event.stopPropagation();
        openSurface({ kind: 'review', proposalId: dot.proposalId });
      }}
      className={cn('group/dot h-4.5 w-3.5 justify-start px-0', className)}
    >
      <span
        className={cn(
          'size-1.5 rounded-full transition-shadow duration-120 motion-reduce:transition-none',
          DOT_LOOKS[dot.isStale ? 'stale' : 'current']
        )}
      />
    </AppButton>
  );
}
