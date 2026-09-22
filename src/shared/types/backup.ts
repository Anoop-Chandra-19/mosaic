/** How often main writes a backup into the chosen folder on its own. */
export type BackupFrequency = 'off' | 'daily' | 'weekly';

export const BACKUP_FREQUENCIES: readonly BackupFrequency[] = ['off', 'daily', 'weekly'];

/** The most recent backup, by hand or on schedule, counted for Settings to report. */
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
  /** The last scheduled backup that could not be written, if none has been since. */
  failure: { at: number; message: string } | null;
}

/**
 * `window.mosaic.backup`: full backups, written by main. The renderer never names a
 * folder or a path; the user picks both in the system dialogs.
 */
export interface MosaicBackup {
  status(): Promise<BackupStatus>;
  /** Every template and its history, to a file the user picks. Null if they cancelled. */
  backUpNow(): Promise<{ status: BackupStatus; fileName: string } | null>;
  /**
   * Turning backups on with no folder yet asks for one first; cancelling that leaves the
   * schedule as it was. A backup that is due is written straight away.
   */
  setFrequency(frequency: BackupFrequency): Promise<BackupStatus>;
  /** Asks for a new folder. Cancelling changes nothing. */
  chooseFolder(): Promise<BackupStatus>;
}
