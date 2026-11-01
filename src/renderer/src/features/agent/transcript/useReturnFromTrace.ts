import { useEffect, useRef, type RefObject } from 'react';
import { useAgentPaneStore } from '@/stores/agentPaneStore';
import { findRunAnchor, moveKeyboardTo, scrollToAnchor } from '../run-view/runAnchors';

/**
 * Coming back from the Trace lands on the step whose record was open. With none open, or one no
 * longer held, the conversation is where it was left.
 */
export function useReturnFromTrace(scrollRef: RefObject<HTMLElement | null>): void {
  const tab = useAgentPaneStore((s) => s.tab);
  const previousTab = useRef(tab);

  useEffect(() => {
    const scroller = scrollRef.current;
    const wasOnTrace = previousTab.current === 'trace';
    previousTab.current = tab;
    if (!scroller || !wasOnTrace || tab !== 'conversation') return;
    const { openCall } = useAgentPaneStore.getState();
    const step = openCall && findRunAnchor(scroller, openCall.runId, openCall.callId);
    if (step) scrollToAnchor(scroller, step, scroller.clientHeight / 3);
    moveKeyboardTo(step ?? scroller);
  }, [scrollRef, tab]);
}
