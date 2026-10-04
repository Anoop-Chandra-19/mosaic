import { describe, expect, it } from 'vitest';
import {
  assignShortcut,
  explainRefusedShortcut,
  findShortcutConflict,
  resolveShortcutCombos,
  sanitizeShortcutBindings,
} from '../shortcutCatalog';

const LINUX = { platform: 'linux', isDevelopment: false };

describe('resolving an action’s keys', () => {
  it('answers to the default, and its second key, until bound', () => {
    expect(resolveShortcutCombos('nameVersion', undefined)).toEqual(['mod+S']);
    expect(resolveShortcutCombos('toggleAssistant', undefined)).toEqual(['mod+J', 'mod+\\']);
  });

  it('answers to its own keys once bound, and to none once unbound', () => {
    expect(resolveShortcutCombos('nameVersion', 'mod+shift+S')).toEqual(['mod+shift+S']);
    expect(resolveShortcutCombos('toggleAssistant', 'mod+K')).toEqual(['mod+K']);
    expect(resolveShortcutCombos('nameVersion', null)).toEqual([]);
  });

  it('keeps fixed keys whatever is stored for them', () => {
    expect(resolveShortcutCombos('undo', null)).toEqual(['mod+Z']);
  });
});

describe('reading stored bindings back', () => {
  it('drops unknown actions, fixed ones, and keys it cannot read', () => {
    expect(
      sanitizeShortcutBindings({
        nameVersion: 'mod+shift+S',
        newSection: null,
        gone: 'mod+G',
        undo: 'mod+U',
        exportResume: 'mod+',
        importResume: 'hyper+O',
        showHistory: 42,
      })
    ).toEqual({ nameVersion: 'mod+shift+S', newSection: null });
  });

  it('starts over from something that is not bindings at all', () => {
    expect(sanitizeShortcutBindings('mod+S')).toEqual({});
    expect(sanitizeShortcutBindings(null)).toEqual({});
  });
});

describe('keys that cannot be bound', () => {
  it('refuses keys the window, text fields or undo own, saying why', () => {
    expect(explainRefusedShortcut('nameVersion', 'mod+Q', LINUX)).toMatch(/quits/);
    expect(explainRefusedShortcut('nameVersion', 'mod+V', LINUX)).toMatch(/paste/);
    expect(explainRefusedShortcut('nameVersion', 'mod+shift+Z', LINUX)).toMatch(/Undo/);
    expect(explainRefusedShortcut('nameVersion', 'alt+F4', LINUX)).toMatch(/closes/);
  });

  it('refuses macOS’s own keys only on macOS, and DevTools only in development', () => {
    const mac = { platform: 'darwin', isDevelopment: false };
    expect(explainRefusedShortcut('nameVersion', 'mod+H', mac)).toMatch(/macOS/);
    expect(explainRefusedShortcut('nameVersion', 'mod+H', LINUX)).toBeNull();
    expect(explainRefusedShortcut('nameVersion', 'mod+shift+I', LINUX)).toBeNull();
    expect(
      explainRefusedShortcut('nameVersion', 'mod+shift+I', { ...LINUX, isDevelopment: true })
    ).toMatch(/DevTools/);
  });

  it('wants a modifier for keys that work anywhere, but not inside the history', () => {
    expect(explainRefusedShortcut('nameVersion', 'S', LINUX)).toMatch(/Ctrl or Alt/);
    expect(explainRefusedShortcut('nameVersion', 'shift+S', LINUX)).toMatch(/Ctrl or Alt/);
    expect(explainRefusedShortcut('nextChange', 'J', LINUX)).toBeNull();
  });
});

describe('taking keys another action has', () => {
  it('finds the action a combination already belongs to, its second key included', () => {
    expect(findShortcutConflict({}, 'nameVersion', 'mod+shift+N')).toBe('newSection');
    expect(findShortcutConflict({}, 'nameVersion', 'mod+\\')).toBe('toggleAssistant');
    expect(findShortcutConflict({}, 'nameVersion', 'mod+shift+S')).toBeNull();
  });

  it('sees an action’s new keys, and no longer its old ones', () => {
    const bindings = { newSection: 'mod+alt+N' };
    expect(findShortcutConflict(bindings, 'nameVersion', 'mod+shift+N')).toBeNull();
    expect(findShortcutConflict(bindings, 'nameVersion', 'mod+alt+N')).toBe('newSection');
  });

  it('leaves the other action unbound when its keys are taken', () => {
    expect(assignShortcut({}, 'nameVersion', 'mod+shift+N', 'newSection')).toEqual({
      nameVersion: 'mod+shift+N',
      newSection: null,
    });
  });

  it('forgets a binding set back to the default, so the action is a default again', () => {
    expect(assignShortcut({ nameVersion: 'mod+shift+S' }, 'nameVersion', 'mod+S')).toEqual({});
    expect(assignShortcut({}, 'nameVersion', null)).toEqual({ nameVersion: null });
  });
});
