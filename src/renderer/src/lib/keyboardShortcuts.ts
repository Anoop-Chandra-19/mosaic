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

/*
 * A shortcut is written as its keys joined by "+", modifiers first: "mod+shift+T",
 * "alt+up", "mod+/". `mod` is Ctrl, or ⌘ on macOS. Named keys are lower case: enter, esc,
 * del (Backspace or Delete), space, up, down, plus, minus.
 */

const MAC_KEY_NAMES: Record<string, string> = {
  mod: '⌘',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
  enter: '↵',
  esc: 'esc',
  del: '⌫',
  space: 'Space',
  up: '↑',
  down: '↓',
  plus: '+',
  minus: '−',
};
const PC_KEY_NAMES: Record<string, string> = {
  ...MAC_KEY_NAMES,
  mod: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
  enter: 'Enter',
  esc: 'Esc',
  del: 'Backspace',
};
/** macOS names its modifiers in this order, and before the key. */
const MAC_MODIFIER_ORDER = ['⌃', '⌥', '⇧', '⌘'];

/** A shortcut's keys as this platform labels them, one per keycap: ["Ctrl", "Shift", "T"]. */
export function formatShortcutKeys(combo: string): string[] {
  const isMac = window.mosaic.platform === 'darwin';
  const names = isMac ? MAC_KEY_NAMES : PC_KEY_NAMES;
  const keys = combo.split('+').map((part) => {
    const name = names[part.toLowerCase()];
    if (name) return name;
    return part.length === 1 ? part.toUpperCase() : part;
  });
  if (!isMac) return keys;
  const modifiers = MAC_MODIFIER_ORDER.filter((modifier) => keys.includes(modifier));
  return [...modifiers, ...keys.filter((key) => !MAC_MODIFIER_ORDER.includes(key))];
}

const EVENT_KEY_NAMES: Record<string, string> = {
  Enter: 'enter',
  Escape: 'esc',
  Backspace: 'del',
  Delete: 'del',
  ' ': 'space',
  ArrowUp: 'up',
  ArrowDown: 'down',
  '=': 'plus',
  '+': 'plus',
  '-': 'minus',
};

/** A typed character that is not a letter: a digit or a symbol, such as "/" or "+". */
function isSymbolKey(key: string): boolean {
  return key.length === 1 && key !== ' ' && key.toLowerCase() === key.toUpperCase();
}

/**
 * The shortcut a key press makes, or null while only modifiers are down. A digit or symbol
 * is read as the character typed, without Shift: on a German keyboard "/" is Shift+7, so
 * Ctrl+/ arrives as Ctrl+Shift+/, and it is still Ctrl+/.
 */
export function readShortcutCombo(event: KeyboardEvent): string | null {
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return null;
  const isMac = window.mosaic.platform === 'darwin';
  const parts: string[] = [];
  if (isMac ? event.metaKey : event.ctrlKey) parts.push('mod');
  if (isMac && event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey && !isSymbolKey(event.key)) parts.push('shift');
  const key =
    EVENT_KEY_NAMES[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return [...parts, key].join('+');
}

/** One spelling per shortcut, so two ways of writing the same keys compare equal. */
function normalizeShortcutCombo(combo: string): string {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  return [...parts.sort(), key].join('+');
}

export function isSameShortcut(a: string, b: string): boolean {
  return normalizeShortcutCombo(a) === normalizeShortcutCombo(b);
}

/** The key event is `combo`. */
export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
  const pressed = readShortcutCombo(event);
  return pressed !== null && isSameShortcut(pressed, combo);
}

/** Typing in a field: keys the field itself owns, such as its own undo, stay with it. */
export function isTypingField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))
  );
}
