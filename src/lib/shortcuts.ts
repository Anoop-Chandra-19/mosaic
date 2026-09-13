/** Ctrl on Windows and Linux, ⌘ on macOS — the key app shortcuts are built on. */
export function isModKey(event: KeyboardEvent): boolean {
  return window.mosaic.platform === 'darwin' ? event.metaKey : event.ctrlKey;
}

/** How a shortcut reads on this platform: "⌘N" on macOS, "Ctrl+N" elsewhere. */
export function shortcutLabel(key: string): string {
  return window.mosaic.platform === 'darwin' ? `⌘${key}` : `Ctrl+${key}`;
}
