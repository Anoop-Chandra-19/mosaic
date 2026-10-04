import { isSameShortcut } from './keyboardShortcuts';

/*
 * Every keyboard shortcut Mosaic has, with the keys it starts on, and the rules for
 * rebinding them. A person's own keys are a preference (`shortcutBindings` in uiStore);
 * handlers and labels read them through `features/shortcuts/shortcutBindings.ts`, never
 * these defaults directly, so a rebound key works and shows everywhere at once.
 */

export const DEFAULT_SHORTCUTS = {
  newTemplate: 'mod+N',
  switchTemplate: 'mod+shift+T',
  nameVersion: 'mod+S',
  // Not the design's Ctrl/⌘+Y: Windows and Linux redo with that.
  showHistory: 'mod+shift+H',
  exportResume: 'mod+E',
  // Not the design's Ctrl/⌘+Shift+I: development keeps that for DevTools.
  importResume: 'mod+O',
  openSettings: 'mod+,',
  undo: 'mod+Z',
  redo: 'mod+shift+Z',
  moveBulletUp: 'alt+up',
  moveBulletDown: 'alt+down',
  newBulletBelow: 'alt+enter',
  // Not Ctrl/⌘+Backspace: in a field that deletes a word, and this works while typing.
  deleteBullet: 'mod+shift+K',
  // A bullet is one paragraph, so Shift+Enter has no line break to add: it splits instead.
  splitBullet: 'shift+enter',
  // The usual "join lines" key. It opens the merge in the editor, never joins on its own.
  mergeBullets: 'mod+shift+J',
  duplicateEntry: 'mod+D',
  newSection: 'mod+shift+N',
  keepEdit: 'enter',
  dropEdit: 'esc',
  toggleSidebar: 'mod+B',
  // J is in the same place on every layout; \ (its second key) takes AltGr on many.
  toggleAssistant: 'mod+J',
  zoomIn: 'mod+plus',
  zoomOut: 'mod+minus',
  fitPage: 'mod+0',
  toggleTheme: 'mod+shift+L',
  showShortcuts: 'mod+/',
  zoomToPointer: 'mod+scroll',
  dragPage: 'space+drag',
  // Newest first, so down is older.
  newerVersion: 'up',
  olderVersion: 'down',
  nextChange: 'N',
  previousChange: 'P',
} as const;

export type ShortcutId = keyof typeof DEFAULT_SHORTCUTS;

/** A second key some actions answer to while their binding is the default. */
const SECOND_DEFAULTS: Partial<Record<ShortcutId, string>> = {
  toggleAssistant: 'mod+\\',
  nextChange: ']',
  previousChange: '[',
};

/**
 * Listed, but not rebindable: undo and redo belong to text fields too and have three
 * platform spellings, Enter and Esc are what every editor uses, and the last two are
 * gestures, not keys.
 */
const FIXED_SHORTCUTS: ReadonlySet<ShortcutId> = new Set<ShortcutId>([
  'undo',
  'redo',
  'keepEdit',
  'dropEdit',
  'zoomToPointer',
  'dragPage',
]);

/** Where an action's keys work. Keys that work anywhere must not take over typing. */
type ShortcutScope = 'window' | 'editor' | 'history';

const LOCAL_SCOPES: Partial<Record<ShortcutId, ShortcutScope>> = {
  moveBulletUp: 'editor',
  moveBulletDown: 'editor',
  newBulletBelow: 'editor',
  deleteBullet: 'editor',
  splitBullet: 'editor',
  mergeBullets: 'editor',
  duplicateEntry: 'editor',
  newerVersion: 'history',
  olderVersion: 'history',
  nextChange: 'history',
  previousChange: 'history',
};

/** The person's own keys: absent is the default, null is no key at all. */
export type ShortcutBindings = Partial<Record<ShortcutId, string | null>>;

/** Where the shortcut sheet was opened from, so it can show that place's keys first. */
export type ShortcutPlace = 'bullet' | 'sidebar' | 'preview' | 'history';

export const SHORTCUT_PLACES: readonly ShortcutPlace[] = [
  'bullet',
  'sidebar',
  'preview',
  'history',
];

export const SHORTCUT_IDS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutId[];

export function isFixedShortcut(id: ShortcutId): boolean {
  return FIXED_SHORTCUTS.has(id);
}

/**
 * The combinations an action answers to, given its stored binding: the default and any
 * second key while it has none, the bound one, or none when it was unbound.
 */
export function resolveShortcutCombos(id: ShortcutId, bound: string | null | undefined): string[] {
  if (bound === undefined || isFixedShortcut(id)) {
    const second = SECOND_DEFAULTS[id];
    return second ? [DEFAULT_SHORTCUTS[id], second] : [DEFAULT_SHORTCUTS[id]];
  }
  return bound === null ? [] : [bound];
}

const MODIFIERS = new Set(['mod', 'shift', 'alt', 'ctrl']);

/** Modifiers first, then exactly one key: what `readShortcutCombo` writes. */
function isReadableCombo(combo: string): boolean {
  const parts = combo.split('+');
  const key = parts.at(-1) ?? '';
  // "mod++" is a plus typed as a character; the catalog spells it "plus".
  return (
    key.length > 0 &&
    !MODIFIERS.has(key.toLowerCase()) &&
    parts.slice(0, -1).every((part) => MODIFIERS.has(part.toLowerCase()))
  );
}

/** Stored bindings as read back: unknown actions, fixed ones and unreadable keys are dropped. */
export function sanitizeShortcutBindings(stored: unknown): ShortcutBindings {
  if (typeof stored !== 'object' || stored === null) return {};
  const bindings: ShortcutBindings = {};
  for (const [id, combo] of Object.entries(stored)) {
    if (!(id in DEFAULT_SHORTCUTS) || isFixedShortcut(id as ShortcutId)) continue;
    if (combo === null || (typeof combo === 'string' && isReadableCombo(combo))) {
      bindings[id as ShortcutId] = combo;
    }
  }
  return bindings;
}

interface RefusedCombos {
  combos: string[];
  platforms?: string[];
  inDevelopmentOnly?: true;
  reason: string;
}

/** Keys something else already owns, whichever action asks for them. */
const REFUSED_COMBOS: RefusedCombos[] = [
  {
    combos: ['mod+Q', 'mod+W'],
    reason: 'It quits or closes the window.',
  },
  {
    combos: ['mod+M', 'mod+H'],
    platforms: ['darwin'],
    reason: 'macOS keeps it for minimizing and hiding windows.',
  },
  {
    combos: ['alt+F4'],
    platforms: ['win32', 'linux'],
    reason: 'It closes the window.',
  },
  {
    combos: ['mod+C', 'mod+X', 'mod+V', 'mod+A'],
    reason: 'Copy, cut, paste and select all belong to text.',
  },
  {
    combos: ['mod+Z', 'mod+shift+Z', 'mod+Y'],
    reason: 'Undo and redo stay where every app has them.',
  },
  {
    combos: ['enter', 'esc'],
    reason: 'Enter and Esc keep and drop edits.',
  },
  {
    combos: ['mod+R', 'mod+shift+R', 'mod+shift+I', 'F5', 'F12'],
    inDevelopmentOnly: true,
    reason: 'Development keeps it for reloading and DevTools.',
  },
];

interface RefusalContext {
  platform: string;
  isDevelopment: boolean;
}

/** Why `combo` can't be `id`'s key, or null when it can. */
export function explainRefusedShortcut(
  id: ShortcutId,
  combo: string,
  { platform, isDevelopment }: RefusalContext
): string | null {
  const refused = REFUSED_COMBOS.find(
    (entry) =>
      (!entry.platforms || entry.platforms.includes(platform)) &&
      (!entry.inDevelopmentOnly || isDevelopment) &&
      entry.combos.some((taken) => isSameShortcut(taken, combo))
  );
  if (refused) return refused.reason;
  const isWindowWide = (LOCAL_SCOPES[id] ?? 'window') === 'window';
  const hasModifier = /(^|\+)(mod|alt|ctrl)\+/i.test(combo);
  if (isWindowWide && !hasModifier) {
    const modifiers = platform === 'darwin' ? '⌘ or ⌥' : 'Ctrl or Alt';
    return `A shortcut that works anywhere needs ${modifiers}, or it would take over typing.`;
  }
  return null;
}

/** The action already answering to `combo`, other than `id`. */
export function findShortcutConflict(
  bindings: ShortcutBindings,
  id: ShortcutId,
  combo: string
): ShortcutId | null {
  const taken = SHORTCUT_IDS.find(
    (other) =>
      other !== id &&
      resolveShortcutCombos(other, bindings[other]).some((bound) => isSameShortcut(bound, combo))
  );
  return taken ?? null;
}

/**
 * `id` on `combo` (null for no key), and `displaced`, whose key it took, left without one.
 * A binding back to the default is forgotten, so the action is a default again.
 */
export function assignShortcut(
  bindings: ShortcutBindings,
  id: ShortcutId,
  combo: string | null,
  displaced?: ShortcutId
): ShortcutBindings {
  const next = { ...bindings };
  if (combo !== null && isSameShortcut(combo, DEFAULT_SHORTCUTS[id])) delete next[id];
  else next[id] = combo;
  if (displaced) next[displaced] = null;
  return next;
}
