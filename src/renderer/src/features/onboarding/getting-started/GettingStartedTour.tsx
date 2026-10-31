import { useEffect, useRef, useState } from 'react';
import { AppButton } from '@/components/ui-kit';
import { useShortcutLabel } from '@/stores/shortcutBindings';
import { isTypingField } from '@/lib/keyboardShortcuts';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { selectTourStep, useOverlayStore } from '@/stores/overlayStore';
import { showToast } from '@/stores/toastStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore, type SidebarTab } from '@/stores/uiStore';
import { CARD_BEFORE_MEASURED, measureTourCard, placeTourCard, spotAround } from '../placeTourCard';
import { TourCard } from '../TourCard';
import { SIDEBAR_TAB_TARGET, tourTargetSelector } from '../tourTargets';
import { TourVeil } from '../TourVeil';
import { useIsAppCovered } from '../useIsAppCovered';
import { useTargetRect } from '../useTargetRect';
import { GETTING_STARTED_STEPS as TOUR_STEPS } from './gettingStartedSteps';

/** The spotlight's move from one element to the next (its `duration-160`). */
const SPOT_GLIDE_MS = 160;
/** The tab's one ping (`animate-attention-ping`), which starts once the spotlight lands. */
const PING_MS = 560;
/**
 * On the tab before it switches: the glide there, the ping, and a beat. Someone reading
 * the card or the page looks up in time to see where they are being taken.
 */
const LEAD_MS = SPOT_GLIDE_MS + PING_MS + 80;
/** After the switch: the tab panel's slide and the pane filling in. */
const SETTLE_MS = 260;

/** With reduced motion nothing moves, so there is nothing to wait for. */
function pace(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/** Starts the tour once the first resume is in the editor, until it has been seen. */
function useStartTourOnFirstResume() {
  const hasSeenTour = useUiStore((s) => s.hasSeenTour);
  const hasResume = useResumeStore((s) => s.templateId !== null);
  useEffect(() => {
    const overlay = useOverlayStore.getState();
    if (!hasSeenTour && hasResume && overlay.tour === null) overlay.startTour('gettingStarted');
  }, [hasSeenTour, hasResume]);
}

/**
 * The first-run tour: each step dims the app around one live element, which stays usable,
 * and a card beside it says what it is for. It waits under dialogs and surfaces.
 */
export function GettingStartedTour() {
  useStartTourOnFirstResume();
  const stepIndex = useOverlayStore(selectTourStep('gettingStarted'));
  if (stepIndex === null) return null;
  return <RunningTour stepIndex={stepIndex} />;
}

function RunningTour({ stepIndex }: { stepIndex: number }) {
  const isCovered = useIsAppCovered();
  if (isCovered) return null;
  return <TourStepView stepIndex={stepIndex} />;
}

function finishTour(isComplete: boolean) {
  useOverlayStore.getState().endTour('gettingStarted');
  useUiStore.getState().markTourSeen();
  if (isComplete) showToast('Tour finished. Replay it any time from Settings › About.');
}

function showSidebarTab(tab: SidebarTab) {
  const ui = useUiStore.getState();
  ui.setActiveSidebarTab(tab);
  if (ui.sidebarCollapsed) ui.toggleSidebarCollapsed();
}

function TourStepView({ stepIndex }: { stepIndex: number }) {
  const setTourStep = useOverlayStore((s) => s.setTourStep);
  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isWelcome = !step.target;
  const activeTab = useUiStore((s) => s.activeSidebarTab);
  const isSidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  // A step on another tab leads there: the spotlight goes to the tab, the tab switches,
  // and once the pane has settled the spotlight moves on to the target. Seeing the way
  // there is half of what the step shows.
  const [switchedAt, setSwitchedAt] = useState<number | null>(null);
  const [settledAt, setSettledAt] = useState<number | null>(null);
  const [landedAt, setLandedAt] = useState<number | null>(null);
  const isLeading =
    step.sidebarTab !== undefined && (activeTab !== step.sidebarTab || isSidebarCollapsed);
  const hasSwitched = !isLeading && switchedAt === stepIndex;
  const isSettling = hasSwitched && settledAt !== stepIndex;
  const isOnTheWay = isLeading || isSettling;
  // The card waits for the spotlight to land, so it never sits beside one still moving.
  const isCardWaiting = isOnTheWay || (hasSwitched && landedAt !== stepIndex);
  const rect = useTargetRect(
    isOnTheWay && step.sidebarTab
      ? tourTargetSelector(SIDEBAR_TAB_TARGET[step.sidebarTab])
      : step.target
        ? tourTargetSelector(step.target)
        : null
  );
  const [cardSize, setCardSize] = useState(CARD_BEFORE_MEASURED);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const goTo = (index: number) => setTourStep(Math.max(0, index));
  const goNext = () => (isLast ? finishTour(true) : goTo(stepIndex + 1));
  const arrive = () => {
    if (step.sidebarTab) showSidebarTab(step.sidebarTab);
    setSettledAt(stepIndex);
    setLandedAt(stepIndex);
  };

  useEffect(() => {
    const tab = step.sidebarTab;
    if (!tab || !isLeading) return;
    const lead = setTimeout(() => {
      showSidebarTab(tab);
      setSwitchedAt(stepIndex);
      setSettledAt(null);
      setLandedAt(null);
    }, pace(LEAD_MS));
    return () => clearTimeout(lead);
  }, [step, stepIndex, isLeading]);

  useEffect(() => {
    if (!isSettling) return;
    const settle = setTimeout(() => setSettledAt(stepIndex), pace(SETTLE_MS));
    return () => clearTimeout(settle);
  }, [isSettling, stepIndex]);

  useEffect(() => {
    if (!isCardWaiting || isOnTheWay) return;
    const land = setTimeout(() => setLandedAt(stepIndex), pace(SPOT_GLIDE_MS));
    return () => clearTimeout(land);
  }, [isCardWaiting, isOnTheWay, stepIndex]);

  useEffect(() => {
    if (!isCardWaiting) primaryRef.current?.focus({ preventScroll: true });
  }, [stepIndex, isCardWaiting]);

  // Keys typed into the app stay the app's: a field keeps its arrows, and Enter on a
  // button presses that button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingField(event.target)) return;
      const isOnControl =
        event.target instanceof Element &&
        event.target.closest('button, a, [role="menu"], [role="tab"]') !== null;
      let handled = true;
      const isForward = event.key === 'ArrowRight' || (event.key === 'Enter' && !isOnControl);
      if (event.key === 'Escape') finishTour(false);
      // Impatience skips the way there, not the step.
      else if (isForward && isCardWaiting) arrive();
      else if (isForward) goNext();
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
    <div className="pointer-events-none fixed inset-0 z-40" data-tour-overlay>
      <TourVeil spot={rect && spotAround(rect)} isPinging={isLeading} />
      <TourCard
        stepId={step.id}
        eyebrow={isWelcome ? 'Getting started' : `Step ${stepIndex} of ${TOUR_STEPS.length - 1}`}
        title={
          <>
            {step.title}
            {step.titleShortcut && <TitleShortcut id={step.titleShortcut} />}
          </>
        }
        body={step.body}
        stepTitles={TOUR_STEPS.map((dotStep) => dotStep.title)}
        stepIndex={stepIndex}
        position={cardPosition}
        isWaiting={isCardWaiting}
        primaryLabel={isLast ? 'Got it' : isWelcome ? 'Show me' : 'Next'}
        isPrimaryOnward={!isLast}
        cardRef={measureTourCard(setCardSize)}
        primaryRef={primaryRef}
        onGoTo={goTo}
        onPrimary={goNext}
        onClose={() => finishTour(false)}
      />

      {/* Under the card, not the design's window edge: the toast for the resume just made
          sits there as the tour begins. */}
      {isWelcome && (
        <AppButton
          variant="ghost"
          size="xs"
          onClick={() => finishTour(true)}
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2 text-ink-muted hover:text-foreground"
          style={{ top: `calc(50% + ${cardSize.height / 2}px + 0.75rem)` }}
        >
          Skip the tour
        </AppButton>
      )}
    </div>
  );
}

function TitleShortcut({ id }: { id: ShortcutId }) {
  const keys = useShortcutLabel(id);
  return keys && <span className="ml-2.5 font-regular text-ink-muted">{keys}</span>;
}
