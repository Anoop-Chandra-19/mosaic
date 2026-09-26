import { useSyncExternalStore } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';

/** Every open dialog, the app's own and a card's confirm alike, except the tour's card. */
const OPEN_DIALOG =
  '[role="dialog"][data-state="open"]:not([data-tour-card]), [role="alertdialog"][data-state="open"]';

function subscribeToDialogs(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributeFilter: ['data-state'],
  });
  return () => observer.disconnect();
}

const isDialogOpen = () => document.querySelector(OPEN_DIALOG) !== null;

/** Something is over the app: a dialog, or a surface such as the Start panel or full history. */
export function useIsAppCovered(): boolean {
  const hasSurface = useOverlayStore((s) => s.surface !== null);
  const hasDialog = useSyncExternalStore(subscribeToDialogs, isDialogOpen);
  return hasSurface || hasDialog;
}
