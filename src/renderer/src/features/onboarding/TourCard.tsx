import type { CSSProperties, ReactNode, Ref } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

interface TourCardProps {
  stepId: string;
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  /** Under the body, such as a legend. */
  extra?: ReactNode;
  /** Every step's title, for its dot. */
  stepTitles: readonly string[];
  stepIndex: number;
  /** Placed beside its target; null sits it in the middle of the window. */
  position: CSSProperties | null;
  /** Hidden until the spotlight lands, so it never sits beside one still moving. */
  isWaiting: boolean;
  primaryLabel: string;
  /** The primary leads on to another step: it carries an arrow. */
  isPrimaryOnward: boolean;
  cardRef: Ref<HTMLDivElement>;
  primaryRef: Ref<HTMLButtonElement>;
  onGoTo: (index: number) => void;
  onPrimary: () => void;
  onClose: () => void;
}

/**
 * A tour step's card: where it is, what to know, and the way on. Each tour decides its
 * steps, timing and keys; the card only draws them.
 */
export function TourCard({
  stepId,
  eyebrow,
  title,
  body,
  extra,
  stepTitles,
  stepIndex,
  position,
  isWaiting,
  primaryLabel,
  isPrimaryOnward,
  cardRef,
  primaryRef,
  onGoTo,
  onPrimary,
  onClose,
}: TourCardProps) {
  const titleId = `tour-title-${stepId}`;
  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby={titleId}
      data-tour-card
      className={cn(
        'pointer-events-auto absolute w-79 rounded-[0.8125rem] border border-line-strong bg-pane-raised px-3.5 pt-3.5 pb-3 shadow-overlay',
        !position && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        isWaiting && 'invisible'
      )}
      style={position ?? undefined}
    >
      <div className="mb-1.75 flex items-center justify-between">
        <Text variant="eyebrow">{eyebrow}</Text>
        <AppButton
          variant="ghost"
          size="2xs"
          shape="square"
          aria-label="Close the tour"
          title="Close the tour  Esc"
          onClick={onClose}
        >
          <X />
        </AppButton>
      </div>
      <Text as="h4" id={titleId} variant="editor" className="mb-1.25 block">
        {title}
      </Text>
      <Text as="p" variant="body" className="text-pretty">
        {body}
      </Text>
      {extra}
      <div className="mt-3.25 flex items-center gap-1.5">
        <div className="mr-auto flex gap-1.25">
          {stepTitles.map((stepTitle, index) => (
            <AppButton
              key={index}
              variant="dot"
              size="dot"
              shape="pill"
              aria-label={`Step ${index + 1}: ${stepTitle}`}
              aria-current={index === stepIndex ? 'step' : undefined}
              onClick={() => onGoTo(index)}
            />
          ))}
        </div>
        {stepIndex > 0 && (
          <AppButton variant="ghost" size="xs" onClick={() => onGoTo(stepIndex - 1)}>
            Back
          </AppButton>
        )}
        <AppButton ref={primaryRef} size="xs" onClick={onPrimary}>
          {primaryLabel}
          {isPrimaryOnward && <ChevronRight />}
        </AppButton>
      </div>
    </div>
  );
}
