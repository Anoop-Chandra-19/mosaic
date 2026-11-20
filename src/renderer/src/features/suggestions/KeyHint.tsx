import { ShortcutKeys } from '@/components/ShortcutKeys';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { getShortcutCombos } from '@/stores/shortcutBindings';

/**
 * The first keys bound to a shortcut, for a hint line in the review. It reads the user's
 * own keys, so a rebound shortcut shows its new keys.
 */
export function KeyHint({ id }: { id: ShortcutId }) {
  return <ShortcutKeys combos={getShortcutCombos(id).slice(0, 1)} />;
}
