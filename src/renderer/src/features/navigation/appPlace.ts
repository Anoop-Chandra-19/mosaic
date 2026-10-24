import type { DialogRequest, TourKind } from '@/stores/overlayStore';
import type { HistoryComparison, ReadPaneView } from '@/types/history';
import type { SettingsSectionId } from '@/types/settings';

/** A place in the app, by the ids the stores open it with. */
export type AppPlace =
  | { kind: 'start' }
  | { kind: 'editor'; templateId: string; dialog?: DialogRequest }
  | {
      kind: 'history';
      templateId: string;
      versionId?: string;
      comparison?: HistoryComparison;
      reading?: ReadPaneView;
    }
  | { kind: 'review'; templateId: string; proposalId?: string }
  | { kind: 'settings'; section: SettingsSectionId }
  | { kind: 'tour'; tour: TourKind; step: number };
