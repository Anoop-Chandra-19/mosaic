import type { DialogKind, TourKind } from '@/stores/overlayStore';
import type { ReadPaneView } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';

/**
 * A view as its address names it, in plain values: a template by its name, a version by its
 * label ("v12"), a suggestion and a tour's step by their number from 1. The developer tools
 * and e2e pass the same values.
 */
export type ViewPlace =
  | { kind: 'start' }
  | { kind: 'editor'; template: string; dialog?: AddressDialog }
  | {
      kind: 'history';
      template: string;
      /** Without one, the view opens where it would. */
      version?: string;
      /** "v11" or "draft"; without one, the view compares as it would. */
      base?: string;
      reading?: ReadPaneView;
    }
  | { kind: 'review'; template: string; suggestion?: number }
  | { kind: 'settings'; section: SettingsSectionId }
  | { kind: 'tour'; tour: TourKind; step: number };

export type ViewKind = ViewPlace['kind'];

/** The dialogs an address can open over the editor, by the words it uses for them. */
export const ADDRESS_DIALOGS = {
  import: 'import',
  export: 'export',
  nameVersion: 'name version',
  shortcuts: 'shortcuts',
} as const satisfies Partial<Record<DialogKind, string>>;
export type AddressDialog = keyof typeof ADDRESS_DIALOGS;

export const ADDRESS_TOURS: Record<TourKind, string> = {
  gettingStarted: 'getting started',
  history: 'history',
};

export const ADDRESS_READINGS: Record<ReadPaneView, string> = {
  page: 'page',
  changes: 'changes',
};

/** The words an address starts with. */
export const VIEW_KINDS: readonly ViewKind[] = [
  'start',
  'editor',
  'history',
  'review',
  'settings',
  'tour',
];
