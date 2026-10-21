import { useEffect, useRef, useState, type Ref } from 'react';
import { Sparkles } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { useSettledSurface } from '@/features/view-transitions/useSettledSurface';
import { isTypingField } from '@/lib/keyboardShortcuts';
import { fade } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { cn } from '@/lib/utils';
import { selectTourStep, useOverlayStore } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import { CARD_BEFORE_MEASURED, measureTourCard, placeTourCard, spotAround } from '../placeTourCard';
import { TourCard } from '../TourCard';
import { tourTargetSelector } from '../tourTargets';
import { TourVeil } from '../TourVeil';
import { useIsDialogOpen } from '../useIsAppCovered';
import { useTargetRect } from '../useTargetRect';
import { endHistoryTour } from './endHistoryTour';
import { HISTORY_TOUR_STEPS } from './historyTourSteps';

/*
 * The history tour, over the full history while it shows the example history. It is
 * started from History settings, a tip, the short line under a new history, or About; the
 * full history shows the example for as long as the step is set.
 */

/**
 * A run mounts fresh and is gone at once when it ends: `endHistoryTour` cross-fades it out
 * with the view under it. Nothing of one run, such as its last card, outlives it.
 */
export function HistoryTour() {
  const stepIndex = useOverlayStore(selectTourStep('history'));
  return stepIndex === null ? null : <RunningHistoryTour stepIndex={stepIndex} />;
}

function RunningHistoryTour({ stepIndex }: { stepIndex: number }) {
  // Only once the full history has arrived: the veil would flash through its transition.
  const isOverHistory = useSettledSurface()?.kind === 'history';
  const isDialogOpen = useIsDialogOpen();
  const isShown = isOverHistory && !isDialogOpen;
  // One key for the whole run: steps change in place, only arriving and leaving fade.
  const { shown, isLeaving, ref } = usePresenceMotion(isShown ? stepIndex : null, 'tour', fade);
  if (shown === null) return null;
  return <HistoryTourStepView stepIndex={shown} isLeaving={isLeaving} overlayRef={ref} />;
}

interface HistoryTourStepViewProps {
  stepIndex: number;
  isLeaving: boolean;
  overlayRef: Ref<HTMLDivElement>;
}

function HistoryTourStepView({ stepIndex, isLeaving, overlayRef }: HistoryTourStepViewProps) {
  const setStep = useOverlayStore((s) => s.setTourStep);
  const isRestoreKept = useUiStore((s) => s.snapshotTriggers.beforeRestore);
  const step = HISTORY_TOUR_STEPS[stepIndex];
  const context = { isRestoreKept };
  const isLast = stepIndex === HISTORY_TOUR_STEPS.length - 1;
  const isIntro = !step.target;
  const rect = useTargetRect(step.target ? tourTargetSelector(step.target) : null);
  const [cardSize, setCardSize] = useState(CARD_BEFORE_MEASURED);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const goTo = (index: number) => setStep(Math.max(0, index));
  const goNext = () => (isLast ? endHistoryTour(true) : goTo(stepIndex + 1));

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  // Taken before the full history's own keys: Escape ends the tour, not the view.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isLeaving || isTypingField(event.target)) return;
      const isOnControl =
        event.target instanceof Element && event.target.closest('button, a') !== null;
      let handled = true;
      if (event.key === 'Escape') endHistoryTour();
      else if (event.key === 'ArrowRight' || (event.key === 'Enter' && !isOnControl)) goNext();
      else if (event.key === 'ArrowLeft') goTo(stepIndex - 1);
      else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  const cardPosition =
    rect &&
    placeTourCard(rect, step.side ?? 'bottom', cardSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    });

  return (
    <div
      ref={overlayRef}
      inert={isLeaving}
      className={cn(
        'pointer-events-none fixed inset-0 z-40',
        transitionClasses({ name: 'tour-overlay', motion: 'fade' })
      )}
      data-tour-overlay
    >
      <TourVeil spot={rect && spotAround(rect)} />
      <TourCard
        stepId={`history-${step.id}`}
        eyebrow={
          isIntro ? 'History · example' : `Step ${stepIndex} of ${HISTORY_TOUR_STEPS.length - 1}`
        }
        title={step.title(context)}
        body={step.body(context)}
        extra={step.hasLegend && <MarksLegend />}
        stepTitles={HISTORY_TOUR_STEPS.map((dotStep) => dotStep.title(context))}
        stepIndex={stepIndex}
        position={cardPosition}
        // A target still out of reach (a row not drawn yet) waits rather than misplacing the card.
        isWaiting={!!step.target && !rect}
        primaryLabel={isLast ? 'Got it' : isIntro ? 'Show me' : 'Next'}
        isPrimaryOnward={!isLast}
        cardRef={measureTourCard(setCardSize)}
        primaryRef={primaryRef}
        onGoTo={goTo}
        onPrimary={goNext}
        onClose={() => endHistoryTour()}
      />
    </div>
  );
}

/** Each mark on the rail, drawn as the rows draw it, and what it stands for. */
const LEGEND: { mark: string; label: string }[] = [
  {
    mark: 'size-2 rotate-45 bg-foreground',
    label: 'Named by you, kept for good',
  },
  { mark: 'h-0.5 w-2.5 bg-ink-muted', label: 'Automatic snapshot' },
  {
    mark: 'size-2 border-[1.5px] border-ink-muted',
    label: 'Import, or kept just before a restore or apply',
  },
  { mark: 'size-2 bg-ink-muted', label: 'Where you left it' },
];

function MarksLegend() {
  return (
    <div className="mt-2.5 mb-0.5 grid grid-cols-[1rem_1fr] items-center gap-x-2 gap-y-1.5">
      {LEGEND.map(({ mark, label }) => (
        <span key={label} className="contents">
          <i aria-hidden className={cn('block justify-self-center', mark)} />
          <Text variant="secondary" className="text-ink-soft">
            {label}
          </Text>
        </span>
      ))}
      <Sparkles aria-hidden className="size-2.75 justify-self-center text-amber" />
      <Text variant="secondary" className="text-ink-soft">
        Suggestions you applied
      </Text>
    </div>
  );
}
