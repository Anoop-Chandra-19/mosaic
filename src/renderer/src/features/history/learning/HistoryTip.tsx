import type { Ref } from 'react';
import { createPortal } from 'react-dom';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { useTargetRect } from '@/features/onboarding/useTargetRect';
import { cn } from '@/lib/utils';

/** The floating tip's width, as the design draws it. */
const FLOATING_WIDTH_PX = 268;
const EDGE_PX = 12;

interface HistoryTipProps {
  title: string;
  body: string;
  /** "How history works" in the full history; "How it works" where room is short. */
  tourLabel: string;
  /** Under its row, in a gap the row opens (the sidebar); else floating beside it. */
  isInline: boolean;
  /** Floating only: the row it explains. */
  rowSelector: string;
  isLeaving: boolean;
  tipRef: Ref<HTMLDivElement>;
  onGot: () => void;
  onTour: () => void;
}

/**
 * One kind of row explained, beside the first of them on screen. Inline in the sidebar, so
 * it scrolls with the list and never covers the editor; floating in the full history,
 * following its row.
 */
export function HistoryTip({ isInline, rowSelector, ...card }: HistoryTipProps) {
  return isInline ? (
    <li className="relative mt-1.5 mb-2.5 ml-5.5 list-none">
      <TipCard {...card} arrow="top" />
    </li>
  ) : (
    <FloatingTip rowSelector={rowSelector} {...card} />
  );
}

function FloatingTip({ rowSelector, ...card }: Omit<HistoryTipProps, 'isInline'>) {
  const row = useTargetRect(rowSelector);
  if (!row) return null;
  const left = Math.min(row.left + row.width + 10, window.innerWidth - FLOATING_WIDTH_PX - EDGE_PX);
  const top = Math.max(8, Math.min(row.top - 6, window.innerHeight - 170));
  return createPortal(
    <div className="fixed z-35 w-67" style={{ left, top }}>
      <TipCard {...card} arrow="left" className="shadow-floating" />
    </div>,
    document.body
  );
}

/** The arrow's notch, a turned square sharing the card's ground and border. */
const ARROWS = {
  left: 'before:top-4 before:-left-1.5 before:border-b before:border-l',
  top: 'before:-top-1.5 before:left-3.5 before:border-t before:border-l',
} as const;

interface TipCardProps extends Omit<HistoryTipProps, 'isInline' | 'rowSelector'> {
  arrow: keyof typeof ARROWS;
  className?: string;
}

function TipCard({
  title,
  body,
  tourLabel,
  isLeaving,
  tipRef,
  onGot,
  onTour,
  arrow,
  className,
}: TipCardProps) {
  return (
    <div
      ref={tipRef}
      role="note"
      aria-label={title}
      inert={isLeaving}
      className={cn(
        'relative rounded-[0.5625rem] border border-line-strong bg-pane-raised px-3 pt-2.75 pb-2.25',
        'before:absolute before:size-2.5 before:rotate-45 before:border-line-strong before:bg-pane-raised',
        ARROWS[arrow],
        className
      )}
    >
      <Text as="h5" variant="title" className="mb-0.75 block">
        {title}
      </Text>
      <Text as="p" variant="secondary" className="text-pretty text-ink-soft">
        {body}
      </Text>
      <div className="mt-2.25 flex items-center gap-1.5">
        <AppButton variant="ghost" size="xs" onClick={onTour} className="-ml-1.5">
          {tourLabel}
        </AppButton>
        <span className="flex-1" />
        <AppButton size="xs" onClick={onGot}>
          Got it
        </AppButton>
      </div>
    </div>
  );
}
