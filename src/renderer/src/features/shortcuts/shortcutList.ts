import type { ShortcutId, ShortcutPlace } from '@/lib/shortcutCatalog';

/*
 * How the shortcut sheet lists the actions in `lib/shortcutCatalog.ts`: one row per action,
 * in groups, and the groups for the place the sheet was opened from.
 */

export interface ShortcutRow {
  id: ShortcutId;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  /** Where the group's keys work, when that is narrower than anywhere. */
  note?: string;
  rows: ShortcutRow[];
}

const LABELS: Record<ShortcutId, string> = {
  newTemplate: 'New template',
  switchTemplate: 'Switch template',
  nameVersion: 'Name version',
  showHistory: 'Version history',
  exportResume: 'Export…',
  importResume: 'Import…',
  openSettings: 'Settings',
  undo: 'Undo',
  redo: 'Redo',
  keepEdit: 'Keep an edit',
  dropEdit: 'Drop an edit',
  moveBulletUp: 'Move bullet up',
  moveBulletDown: 'Move bullet down',
  newBulletBelow: 'New bullet below',
  deleteBullet: 'Delete bullet',
  splitBullet: 'Split bullet at the cursor',
  mergeBullets: 'Merge with bullet below',
  duplicateEntry: 'Duplicate entry',
  newSection: 'New section',
  toggleSidebar: 'Toggle content sidebar',
  toggleAssistant: 'Toggle assistant pane',
  zoomIn: 'Zoom page in',
  zoomOut: 'Zoom page out',
  fitPage: 'Fit page to the panel',
  zoomToPointer: 'Zoom toward the pointer',
  dragPage: 'Move the page',
  toggleTheme: 'Light / dark',
  showShortcuts: 'This sheet',
  newerVersion: 'Newer version',
  olderVersion: 'Older version',
  nextChange: 'Next change',
  previousChange: 'Previous change',
};

export function labelShortcut(id: ShortcutId): string {
  return LABELS[id];
}

function rowsFor(ids: ShortcutId[]): ShortcutRow[] {
  return ids.map((id) => ({ id, label: LABELS[id] }));
}

/**
 * The sheet's groups, everything Mosaic has. The assistant's row is listed while AI is off
 * too: Settings already says so, and its keys simply do nothing until then.
 */
export function listShortcutGroups(): ShortcutGroup[] {
  return [
    {
      title: 'Document',
      rows: rowsFor([
        'newTemplate',
        'switchTemplate',
        'nameVersion',
        'showHistory',
        'exportResume',
        'importResume',
        'openSettings',
      ]),
    },
    {
      title: 'Editing',
      note: 'in the content sidebar',
      rows: rowsFor([
        'undo',
        'redo',
        'keepEdit',
        'dropEdit',
        'moveBulletUp',
        'moveBulletDown',
        'newBulletBelow',
        'deleteBullet',
        'splitBullet',
        'mergeBullets',
        'duplicateEntry',
        'newSection',
      ]),
    },
    {
      title: 'View',
      rows: rowsFor([
        'toggleSidebar',
        'toggleAssistant',
        'zoomIn',
        'zoomOut',
        'fitPage',
        'zoomToPointer',
        'dragPage',
        'toggleTheme',
        'showShortcuts',
      ]),
    },
    {
      title: 'History',
      note: 'in the full history',
      rows: rowsFor(['newerVersion', 'olderVersion', 'nextChange', 'previousChange']),
    },
  ];
}

/** The keys for where the sheet was opened from, shown first. */
const PLACE_GROUPS: Record<ShortcutPlace, ShortcutGroup> = {
  bullet: {
    title: 'Editing a bullet',
    rows: rowsFor([
      'keepEdit',
      'dropEdit',
      'newBulletBelow',
      'splitBullet',
      'mergeBullets',
      'moveBulletUp',
      'moveBulletDown',
      'deleteBullet',
    ]),
  },
  sidebar: {
    title: 'In the content sidebar',
    rows: rowsFor([
      'moveBulletUp',
      'moveBulletDown',
      'newBulletBelow',
      'deleteBullet',
      'mergeBullets',
      'duplicateEntry',
      'newSection',
    ]),
  },
  preview: {
    title: 'On the page',
    rows: rowsFor(['zoomIn', 'zoomOut', 'fitPage', 'zoomToPointer', 'dragPage']),
  },
  history: {
    title: 'Full history',
    rows: rowsFor([
      'newerVersion',
      'olderVersion',
      'nextChange',
      'previousChange',
      'zoomIn',
      'zoomOut',
      'fitPage',
    ]),
  },
};

/** The place's group, tagged so it reads as being about where you are. */
export function listPlaceShortcuts(place: ShortcutPlace): ShortcutGroup {
  return { ...PLACE_GROUPS[place], note: 'where you are' };
}
