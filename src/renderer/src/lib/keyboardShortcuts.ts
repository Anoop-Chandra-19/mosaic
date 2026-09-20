/** Ctrl on Windows and Linux, ⌘ on macOS — the key app shortcuts are built on. */
export function isModKey(event: KeyboardEvent): boolean {
  return window.mosaic.platform === 'darwin' ? event.metaKey : event.ctrlKey;
}

/** How a shortcut reads on this platform: "⌘N" on macOS, "Ctrl+N" elsewhere. */
export function shortcutLabel(key: string): string {
  return window.mosaic.platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`;
}

/**
 * Redo is bound three ways, because every platform names it differently. Windows redoes
 * with Ctrl+Y, macOS with ⌘⇧Z, and cross-platform apps taught everyone Ctrl+Shift+Z. All
 * of them work; each platform is shown the one it expects.
 */
export function redoShortcutLabel(): string {
  const { platform } = window.mosaic;
  if (platform === 'darwin') return '⌘⇧Z';
  return platform === 'win32' ? 'Ctrl+Y' : 'Ctrl+Shift+Z';
}

/** The key event is a redo: ⌘⇧Z on macOS, Ctrl+Shift+Z or Ctrl+Y elsewhere. */
export function isRedoKey(event: KeyboardEvent): boolean {
  if (!isModKey(event)) return false;
  if (event.key.toLowerCase() === 'z') return event.shiftKey;
  return event.key.toLowerCase() === 'y' && window.mosaic.platform !== 'darwin';
}

/** The key event is an undo: Ctrl/⌘+Z without Shift. */
export function isUndoKey(event: KeyboardEvent): boolean {
  return isModKey(event) && !event.shiftKey && event.key.toLowerCase() === 'z';
}

/** Typing in a field: keys the field itself owns, such as its own undo, stay with it. */
export function isTypingField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
  );
}
