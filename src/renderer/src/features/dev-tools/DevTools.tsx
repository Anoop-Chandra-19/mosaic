import { useEffect, useEffectEvent, useState } from 'react';
import { AppDialog } from '@/components/AppDialog';
import { useTargetRequest, useTargetStore } from '@/stores/targetStore';
import type { DevToolRun } from '@shared/types/devTools';
import { installDevTestHook } from './devTestHook';
import { DevToolsPalette } from './palette/DevToolsPalette';
import { addRecentRun } from './recentDevRuns';

/** Ctrl+Shift+D (⇧⌘D on a Mac), here rather than in the shortcut catalog: users never have it. */
function isOpenToolsKey(event: KeyboardEvent): boolean {
  const isMod = window.mosaic.platform === 'darwin' ? event.metaKey : event.ctrlKey;
  return isMod && event.shiftKey && !event.altKey && event.code === 'KeyD';
}

/**
 * The developer tools in a development build: the palette, and every way to it (the keys,
 * Develop › Developer tools…, the wrench), over any screen or dialog. Not an `overlayStore`
 * dialog, which would replace the dialog it opens over. The window's title says DEV, and e2e
 * gets its hook.
 */
export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  // Each opening mounts the palette afresh.
  const [openings, setOpenings] = useState(0);
  const [recent, setRecent] = useState<DevToolRun[]>([]);

  const open = () => {
    setOpenings((count) => count + 1);
    setIsOpen(true);
  };
  useTargetRequest('devTools', open);
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isOpenToolsKey(event)) return;
    event.preventDefault();
    if (isOpen) setIsOpen(false);
    else open();
  });

  useEffect(() => {
    document.title = 'Mosaic DEV';
    installDevTestHook();
    void window.mosaic.dev?.readRecent().then(setRecent);
    window.mosaic.dev?.onOpenTools(() => useTargetStore.getState().requestTarget('devTools'));
    // Captured, so a field or a dialog that handles its own keys still lets this one through.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  const rememberRun = (run: DevToolRun) => {
    const next = addRecentRun(recent, run);
    setRecent(next);
    void window.mosaic.dev?.saveRecent(next);
  };

  return (
    <AppDialog open={isOpen} onOpenChange={setIsOpen}>
      <DevToolsPalette
        key={openings}
        recent={recent}
        onRun={rememberRun}
        onClose={() => setIsOpen(false)}
      />
    </AppDialog>
  );
}
