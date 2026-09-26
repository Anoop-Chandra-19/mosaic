import { useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { isTypingField, shortcutLabel } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore, type SidebarTab } from '@/stores/uiStore';
import { placeTourCard, type Size } from './placeTourCard';
import { SIDEBAR_TAB_TARGET, TOUR_STEPS, tourTargetSelector } from './tourSteps';
import { useIsAppCovered } from './useIsAppCovered';
import { useTargetRect } from './useTargetRect';

/** The card's size before it has been measured, as the design lays it out. */
const CARD_BEFORE_MEASURED: Size = { width: 316, height: 230 };
/** How far the spotlight stands off its target. */
const SPOT_OUTSET_PX = 4;
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
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}

/** Starts the tour once the first resume is in the editor, until it has been seen. */
function useStartTourOnFirstResume() {
  const hasSeenTour = useUiStore((s) => s.hasSeenTour);
  const hasResume = useResumeStore((s) => s.templateId !== null);
  useEffect(() => {
    const overlay = useOverlayStore.getState();
    if (!hasSeenTour && hasResume && overlay.tourStep === null) overlay.setTourStep(0);
  }, [hasSeenTour, hasResume]);
}

/**
 * The first-run tour: each step dims the app around one live element, which stays usable,
 * and a card beside it says what it is for. It waits under dialogs and surfaces.
 */
export function Tour() {
  useStartTourOnFirstResume();
  const stepIndex = useOverlayStore((s) => s.tourStep);
  if (stepIndex === null) return null;
  return <RunningTour stepIndex={stepIndex} />;
}

function RunningTour({ stepIndex }: { stepIndex: number }) {
  const isCovered = useIsAppCovered();
  if (isCovered) return null;
  return <TourStepView stepIndex={stepIndex} />;
}

function finishTour(isComplete: boolean) {
  useOverlayStore.getState().setTourStep(null);
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

  const measureCard = (card: HTMLDivElement | null) => {
    if (!card) return;
    const observer = new ResizeObserver(() =>
      setCardSize({ width: card.offsetWidth, height: card.offsetHeight })
    );
    observer.observe(card);
    return () => observer.disconnect();
  };

  const spot = rect && {
    top: rect.top - SPOT_OUTSET_PX,
    left: rect.left - SPOT_OUTSET_PX,
    width: rect.width + SPOT_OUTSET_PX * 2,
    height: rect.height + SPOT_OUTSET_PX * 2,
  };
  const cardPosition =
    rect &&
    placeTourCard(rect, step.side ?? 'bottom', cardSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  const titleId = `tour-title-${step.id}`;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" data-tour-overlay>
      {/* Four panels rather than a spread shadow: they catch clicks around the target and
          leave the target itself usable. */}
      {spot ? (
        <>
          <div
            className={VEIL}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }}
          />
          <div
            className={VEIL}
            style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={VEIL}
            style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }}
          />
          <div
            className={VEIL}
            style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }}
          />
          <div
            aria-hidden
            data-tour-spot
            className={cn(
              'pointer-events-none absolute rounded-[0.625rem] border border-[oklch(0.78_0.155_72/34%)] transition-[top,left,width,height] duration-160 ease-out motion-reduce:transition-none',
              isLeading &&
                'animate-attention-ping [animation-delay:160ms] motion-reduce:animate-none'
            )}
            style={spot}
          />
        </>
      ) : (
        <div className={cn(VEIL, 'inset-0')} />
      )}

      <div
        ref={measureCard}
        role="dialog"
        aria-labelledby={titleId}
        data-tour-card
        className={cn(
          'pointer-events-auto absolute w-[19.75rem] rounded-[0.8125rem] border border-line-strong bg-pane-raised px-3.5 pt-3.5 pb-3 shadow-[0_24px_60px_-16px_oklch(0.2_0.01_286/28%),0_2px_6px_oklch(0.2_0.01_286/12%)] dark:shadow-[0_24px_60px_-12px_oklch(0_0_0/70%),0_2px_6px_oklch(0_0_0/40%)]',
          !cardPosition && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          isCardWaiting && 'invisible'
        )}
        style={cardPosition ?? undefined}
      >
        <div className="mb-1.75 flex items-center justify-between">
          <span className="text-[0.65625rem] font-semibold tracking-[0.09em] text-ink-faint uppercase">
            {isWelcome ? 'Getting started' : `Step ${stepIndex} of ${TOUR_STEPS.length - 1}`}
          </span>
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label="Close the tour"
            title="Close the tour  Esc"
            onClick={() => finishTour(false)}
          >
            <X />
          </AppButton>
        </div>
        <h4
          id={titleId}
          className="mb-1.25 text-[0.90625rem] font-semibold tracking-[-0.012em] text-foreground"
        >
          {step.title}
          {step.titleShortcutKey && (
            <span className="ml-2.5 font-normal text-ink-muted">
              {shortcutLabel(step.titleShortcutKey)}
            </span>
          )}
        </h4>
        <p className="text-[0.8125rem] leading-[1.55] text-pretty text-ink-soft">{step.body}</p>
        <div className="mt-3.25 flex items-center gap-1.5">
          <div className="mr-auto flex gap-1.25">
            {TOUR_STEPS.map((dotStep, index) => (
              <AppButton
                key={dotStep.id}
                variant="dot"
                size="dot"
                shape="pill"
                aria-label={`Step ${index + 1}: ${dotStep.title}`}
                aria-current={index === stepIndex ? 'step' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
          {stepIndex > 0 && (
            <AppButton variant="ghost" size="xs" onClick={() => goTo(stepIndex - 1)}>
              Back
            </AppButton>
          )}
          <AppButton ref={primaryRef} size="xs" onClick={goNext}>
            {isLast ? 'Got it' : isWelcome ? 'Show me' : 'Next'}
            {!isLast && <ChevronRight />}
          </AppButton>
        </div>
      </div>

      {/* Under the card, not the design's window edge: the toast for the resume just made
          sits there as the tour begins. */}
      {isWelcome && (
        <AppButton
          variant="ghost"
          size="xs"
          onClick={() => finishTour(true)}
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2 text-[0.78125rem] text-ink-muted hover:text-foreground"
          style={{ top: `calc(50% + ${cardSize.height / 2}px + 0.75rem)` }}
        >
          Skip the tour
        </AppButton>
      )}
    </div>
  );
}

const VEIL = 'pointer-events-auto absolute bg-[oklch(0.13_0.01_286/64%)]';
