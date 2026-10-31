import { formatShortcutLabel, matchesShortcut } from '@/lib/keyboardShortcuts';
import { resolveShortcutCombos, type ShortcutId } from '@/lib/shortcutCatalog';
import { useUiStore } from '@/stores/uiStore';

/*
 * The keys each action answers to now, the person's own or the defaults. Handlers match
 * through `matchesAction`, which reads the store as the key arrives, so a rebinding works
 * at once; labels use `useShortcutLabel`, which re-renders when it changes.
 */

/** The combinations `id` answers to right now; empty when it has no key. */
export function getShortcutCombos(id: ShortcutId): string[] {
  return resolveShortcutCombos(id, useUiStore.getState().shortcutBindings[id]);
}

/** The key event is one of the combinations `id` answers to. */
export function matchesAction(event: KeyboardEvent, id: ShortcutId): boolean {
  return getShortcutCombos(id).some((combo) => matchesShortcut(event, combo));
}

/** `id`'s first combination, for a hint or a tooltip; null when it has no key. */
export function useShortcutCombo(id: ShortcutId): string | null {
  const bound = useUiStore((s) => s.shortcutBindings[id]);
  return resolveShortcutCombos(id, bound)[0] ?? null;
}

/** `id`'s keys as this platform writes them ("⌘S", "Ctrl+S"); empty when it has no key. */
export function useShortcutLabel(id: ShortcutId): string {
  const combo = useShortcutCombo(id);
  return combo ? formatShortcutLabel(combo) : '';
}
