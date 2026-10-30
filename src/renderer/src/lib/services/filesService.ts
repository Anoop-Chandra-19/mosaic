import type { BackupFrequency, BackupStatus } from '@shared/types/backup';
import type { FileType } from '@shared/types/files';
import { readOr } from './readOr';

/* Files main reads and writes for the page: the system dialogs, and the backups. */
export const filesService = {
  /** Writes `content` where the user chooses. Resolves with the file's name, or null if cancelled. */
  save: (type: FileType, suggestedName: string, content: string | Uint8Array) =>
    window.mosaic.files.save(type, suggestedName, content),
  /** One file the user chooses, or null if cancelled. */
  open: (type: FileType) => window.mosaic.files.open(type),
  /** The schedule and the last backup, or null when main can't say. Never rejects. */
  backupStatus: () =>
    readOr<BackupStatus | null>(
      () => window.mosaic.backup.status(),
      null,
      'Could not read the backup status'
    ),
  backUpNow: () => window.mosaic.backup.backUpNow(),
  setBackupFrequency: (frequency: BackupFrequency) => window.mosaic.backup.setFrequency(frequency),
  chooseBackupFolder: () => window.mosaic.backup.chooseFolder(),
};
