/*
 * Every keyboard shortcut Mosaic has, in one table: the handlers match against these
 * combos, and the sheet lists them, so the two can never disagree.
 */

export const SHORTCUTS = {
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
  duplicateEntry: 'mod+D',
  newSection: 'mod+shift+N',
  keepEdit: 'enter',
  dropEdit: 'esc',
  toggleSidebar: 'mod+B',
  // J is in the same place on every layout; \ takes AltGr on many.
  toggleAssistant: 'mod+J',
  toggleAssistantBackslash: 'mod+\\',
  zoomIn: 'mod+plus',
  zoomOut: 'mod+minus',
  fitPage: 'mod+0',
  toggleTheme: 'mod+shift+L',
  showShortcuts: 'mod+/',
  zoomToPointer: 'mod+scroll',
  dragPage: 'space+drag',
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;

export interface ShortcutRow {
  id: ShortcutId;
  label: string;
  combo: string;
  /** A second binding shown beside the first: the other direction, or another spelling. */
  alt?: string;
  /** Listed, but it does nothing right now. */
  isUnavailable?: boolean;
  /** Why it does nothing right now. */
  unavailableNote?: string;
}

export interface ShortcutGroup {
  title: string;
  /** Where the group's keys work, when that is narrower than anywhere. */
  note?: string;
  rows: ShortcutRow[];
}

function row(id: ShortcutId, label: string, alt?: ShortcutId): ShortcutRow {
  return { id, label, combo: SHORTCUTS[id], alt: alt && SHORTCUTS[alt] };
}

/** The sheet's groups. Windows and Linux redo with Ctrl+Y as well. */
export function listShortcutGroups({
  platform,
  isAiEnabled,
}: {
  platform: string;
  isAiEnabled: boolean;
}): ShortcutGroup[] {
  const redo = row('redo', 'Redo');
  if (platform !== 'darwin') redo.alt = 'mod+Y';
  const assistant: ShortcutRow = {
    ...row('toggleAssistant', 'Toggle assistant pane', 'toggleAssistantBackslash'),
    isUnavailable: !isAiEnabled,
    unavailableNote: 'AI is off',
  };

  return [
    {
      title: 'Document',
      rows: [
        row('newTemplate', 'New template'),
        row('switchTemplate', 'Switch template'),
        row('nameVersion', 'Name version'),
        row('showHistory', 'Version history'),
        row('exportResume', 'Export…'),
        row('importResume', 'Import…'),
        row('openSettings', 'Settings'),
      ],
    },
    {
      title: 'Editing',
      note: 'in the content sidebar',
      rows: [
        row('undo', 'Undo'),
        redo,
        row('keepEdit', 'Keep an edit'),
        row('dropEdit', 'Drop an edit'),
        row('moveBulletUp', 'Move bullet up / down', 'moveBulletDown'),
        row('newBulletBelow', 'New bullet below'),
        row('deleteBullet', 'Delete bullet'),
        row('duplicateEntry', 'Duplicate entry'),
        row('newSection', 'New section'),
      ],
    },
    {
      title: 'View',
      rows: [
        row('toggleSidebar', 'Toggle content sidebar'),
        assistant,
        row('zoomIn', 'Zoom page in / out', 'zoomOut'),
        row('fitPage', 'Fit page to the panel'),
        row('zoomToPointer', 'Zoom toward the pointer'),
        row('dragPage', 'Move the page'),
        row('toggleTheme', 'Light / dark'),
        row('showShortcuts', 'This sheet'),
      ],
    },
  ];
}
