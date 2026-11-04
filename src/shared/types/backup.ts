/** How often main automatically writes a backup to the chosen folder. */
export type BackupFrequency = 'off' | 'daily' | 'weekly';

export const BACKUP_FREQUENCIES: readonly BackupFrequency[] = ['off', 'daily', 'weekly'];

/** Time, counts, and size of the most recent manual or scheduled backup, shown in Settings. */
export interface BackupRecord {
  at: number;
  templates: number;
  versions: number;
  bytes: number;
}

export interface BackupStatus {
  frequency: BackupFrequency;
  /** Where scheduled backups go, shortened for display ("~/Backups"); null until chosen. */
  folder: string | null;
  last: BackupRecord | null;
  /** The most recent scheduled backup failure, cleared after a scheduled backup succeeds or the folder changes. */
  failure: { at: number; message: string } | null;
}

/**
 * `window.mosaic.backup`: full backups, written by main. The renderer never supplies a
 * folder or file path; the user chooses them in system dialogs.
 */
export interface MosaicBackup {
  status(): Promise<BackupStatus>;
  /**
   * Writes every template and its history to a file the user chooses. Returns null on
   * cancellation, or 'empty' without a dialog if there are no templates, since restore
   * refuses an empty backup.
   */
  backUpNow(): Promise<{ status: BackupStatus; fileName: string } | 'empty' | null>;
  /**
   * Turning backups on with no folder yet asks for one first; cancelling that leaves the
   * schedule as it was. A backup that is due is written straight away.
   */
  setFrequency(frequency: BackupFrequency): Promise<BackupStatus>;
  /** Asks for a new folder. Cancelling changes nothing. */
  chooseFolder(): Promise<BackupStatus>;
}
