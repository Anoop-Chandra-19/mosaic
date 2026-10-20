import { useRef, type RefObject } from 'react';
import { fadeMarksIn, stepIn, type RunningStep, type StepDirection } from '@/lib/motion/stepIn';

/** The step that brought a version into the read pane, and which way it went. */
export interface VersionStep {
  versionId: string;
  direction: StepDirection;
}

/** The words of each page in view: the sheets themselves change in place. */
function findPagesInView(body: HTMLElement): HTMLElement[] {
  const view = body.getBoundingClientRect();
  return [...body.querySelectorAll<HTMLElement>('[data-preview-page-content]')].filter((page) => {
    const box = page.getBoundingClientRect();
    return box.bottom > view.top && box.top < view.bottom;
  });
}

/**
 * Moves a version stepped to into the read pane: in from the side the history runs from
 * (older from the left), the page's words or the pane's content, never the pane itself.
 * Each version moves once, after it is drawn: `onShown` is called with what is on screen,
 * from the page's `onLaidOut` or after any other view commits. Marks that come back as
 * skimming stops fade in.
 */
export function useVersionStepMotion(
  bodyRef: RefObject<HTMLElement | null>,
  step: VersionStep | null,
  isSkimming: boolean
) {
  const running = useRef<RunningStep | null>(null);
  const movedId = useRef<string | null>(null);
  const wasSkimming = useRef(isSkimming);

  const onShown = (shownId: string, isPage: boolean, isMarked: boolean) => {
    const body = bodyRef.current;
    if (!body) return;
    if (step?.versionId === shownId && movedId.current !== shownId) {
      movedId.current = shownId;
      const content = isPage ? findPagesInView(body) : [...body.children].filter(isHtml);
      running.current = stepIn(content, step.direction, running.current, isSkimming);
    }
    if (wasSkimming.current && !isSkimming && isMarked) {
      fadeMarksIn(body.querySelectorAll('[data-change-id]'));
    }
    wasSkimming.current = isSkimming;
  };

  return { onShown };
}

function isHtml(element: Element): element is HTMLElement {
  return element instanceof HTMLElement;
}
