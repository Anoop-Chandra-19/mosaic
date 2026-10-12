import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import type { BulletSuggestion } from './useBulletSuggestion';

const DOT_LOOKS: Record<'current' | 'stale', { title: string; dot: string }> = {
  current: {
    title: 'A suggestion is waiting here. Click to review it.',
    dot: 'bg-amber shadow-[0_0_0_3px_var(--amber-soft)] group-hover/dot:shadow-[0_0_0_5px_var(--amber-soft)]',
  },
  stale: {
    title: 'Its suggestion is out of date: you changed this bullet after it was made.',
    dot: 'shadow-[inset_0_0_0_1.5px_var(--ink-faint)]',
  },
};

/**
 * The editor's only sign of a suggestion: a dot before the bullet's words, which stay the
 * user's until they apply. It opens the review on that suggestion.
 */
export function BulletSuggestionDot({ suggestion }: { suggestion: BulletSuggestion }) {
  const openSurface = useOverlayStore((s) => s.openSurface);
  const look = DOT_LOOKS[suggestion.isStale ? 'stale' : 'current'];
  return (
    <AppButton
      variant="plain"
      size="2xs"
      aria-label="Review its suggestion"
      title={look.title}
      onClick={(event) => {
        // The words around it open the bullet's editor.
        event.stopPropagation();
        openSurface({ kind: 'review', proposalId: suggestion.proposalId });
      }}
      className="group/dot float-left mr-0.5 h-4.5 w-3.5 justify-start px-0"
    >
      <span
        className={cn(
          'size-1.5 rounded-full transition-shadow duration-120 motion-reduce:transition-none',
          look.dot
        )}
      />
    </AppButton>
  );
}
