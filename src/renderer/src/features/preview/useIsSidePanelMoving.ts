import { useEffect, useState } from 'react';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useUiStore } from '@/stores/uiStore';

/** From the store changing, through the panel's render and the page easing to its new fit. */
const MOVING_MS = 400;

/**
 * True just after the sidebar or the assistant pane comes or goes. The room they leave can change
 * the scale that fits the page, which should ease along with them. Not while a panel or the
 * window is dragged: there the page follows the pointer, and easing would only trail it.
 */
export function useIsSidePanelMoving(): boolean {
  const isSidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const isAgentOpen = useUiStore((s) => s.agentPaneOpen);
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const isAgentPaneOn = isAgentEnabled && isAgentOpen;
  const [shownPanels, setShownPanels] = useState({ isSidebarCollapsed, isAgentPaneOn });
  const [isMoving, setIsMoving] = useState(false);
  const [movesCount, setMovesCount] = useState(0);

  if (
    shownPanels.isSidebarCollapsed !== isSidebarCollapsed ||
    shownPanels.isAgentPaneOn !== isAgentPaneOn
  ) {
    setShownPanels({ isSidebarCollapsed, isAgentPaneOn });
    setIsMoving(true);
    setMovesCount(movesCount + 1);
  }

  useEffect(() => {
    if (movesCount === 0) return;
    const timer = window.setTimeout(() => setIsMoving(false), MOVING_MS);
    return () => window.clearTimeout(timer);
  }, [movesCount]);

  return isMoving;
}
