import { useShortcutLabel } from './shortcutBindings';

/**
 * `intro`, then how to open the sheet from anywhere, with the keys as this computer writes
 * them and as bound now: opened from a place, it lists that place's keys first.
 */
export function ShortcutsIntro({ intro }: { intro: string }) {
  const keys = useShortcutLabel('showShortcuts');
  return keys
    ? `${intro} ${keys} opens this list anywhere, with the keys for where you are first.`
    : intro;
}
