import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatShortcutKeys,
  isSameShortcut,
  matchesShortcut,
  readShortcutCombo,
} from '../keyboardShortcuts';

function onPlatform(platform: string) {
  vi.stubGlobal('window', { mosaic: { platform } });
}

function press(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatShortcutKeys', () => {
  it('names the keys as Windows and Linux do, in the order written', () => {
    onPlatform('linux');
    expect(formatShortcutKeys('mod+shift+T')).toEqual(['Ctrl', 'Shift', 'T']);
    expect(formatShortcutKeys('mod+shift+K')).toEqual(['Ctrl', 'Shift', 'K']);
    expect(formatShortcutKeys('alt+enter')).toEqual(['Alt', 'Enter']);
    expect(formatShortcutKeys('alt+up')).toEqual(['Alt', '↑']);
  });

  it('uses the macOS symbols, modifiers in the order macOS lists them', () => {
    onPlatform('darwin');
    expect(formatShortcutKeys('mod+shift+T')).toEqual(['⇧', '⌘', 'T']);
    expect(formatShortcutKeys('mod+alt+shift+N')).toEqual(['⌥', '⇧', '⌘', 'N']);
  });
});

describe('reading and matching a key press', () => {
  it('reads Ctrl as mod on Linux, and ⌘ as mod on macOS', () => {
    onPlatform('linux');
    expect(readShortcutCombo(press('e', { ctrlKey: true }))).toBe('mod+E');
    onPlatform('darwin');
    expect(readShortcutCombo(press('e', { metaKey: true }))).toBe('mod+E');
    expect(readShortcutCombo(press('e', { ctrlKey: true }))).toBe('ctrl+E');
  });

  it('gives nothing while only a modifier is down', () => {
    onPlatform('linux');
    expect(readShortcutCombo(press('Control', { ctrlKey: true }))).toBeNull();
  });

  it('matches whatever order the modifiers were written in', () => {
    onPlatform('linux');
    expect(isSameShortcut('shift+mod+t', 'mod+shift+T')).toBe(true);
    expect(matchesShortcut(press('T', { ctrlKey: true, shiftKey: true }), 'mod+shift+T')).toBe(
      true
    );
    expect(matchesShortcut(press('t', { ctrlKey: true }), 'mod+shift+T')).toBe(false);
    expect(matchesShortcut(press('=', { ctrlKey: true }), 'mod+plus')).toBe(true);
    expect(matchesShortcut(press('ArrowUp', { altKey: true }), 'alt+up')).toBe(true);
  });

  it('reads a symbol as the character typed, whatever Shift it took to type', () => {
    onPlatform('linux');
    // German layouts: "/" is Shift+7, and "+" is its own key on the US one's Shift+=.
    expect(matchesShortcut(press('/', { ctrlKey: true, shiftKey: true }), 'mod+/')).toBe(true);
    expect(matchesShortcut(press('+', { ctrlKey: true, shiftKey: true }), 'mod+plus')).toBe(true);
    expect(readShortcutCombo(press('K', { ctrlKey: true, shiftKey: true }))).toBe('mod+shift+K');
    expect(readShortcutCombo(press('Enter', { shiftKey: true }))).toBe('shift+enter');
  });
});
