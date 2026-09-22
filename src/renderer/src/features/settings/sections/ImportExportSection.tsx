import { useEffect, useState } from 'react';
import { Download, Info, TriangleAlert, Upload } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { backUpNow, chooseBackup, fileFailure } from '@/features/backup/backupFiles';
import { formatRelativeTime } from '@/features/templates/formatRelativeTime';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { flushDraft, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { BackupFrequency, BackupStatus } from '@shared/types/backup';
import { SettingRow, SettingsNote } from '../SettingRow';

const FREQUENCY_OPTIONS: { value: BackupFrequency; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Export and Import open their own dialogs, so Settings steps out of the way first. */
export function ImportExportSection({ onCloseSettings }: { onCloseSettings: () => void }) {
  const hasOpenTemplate = useResumeStore((s) => s.templateId !== null);
  const hasTemplates = useTemplateStore((s) => s.templates.length > 0);
  const openExport = useOverlayStore((s) => s.openExport);
  const openImport = useOverlayStore((s) => s.openImport);
  const setPendingRestore = useOverlayStore((s) => s.setPendingRestore);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void window.mosaic.backup.status().then((status) => {
      if (isCurrent) setBackup(status);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const backUp = async () => {
    if (!hasTemplates) {
      showToast('Nothing to back up yet');
      return;
    }
    setBackingUp(true);
    try {
      const saved = await backUpNow();
      if (!saved) return;
      setBackup(saved.status);
      showToast(`Backed up to ${saved.fileName}`);
    } catch (error) {
      console.error('Could not write the backup', error);
      showToast('Could not write the backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  // Main may ask for a folder first, and writes a backup that is due straight away.
  const changeSchedule = async (change: () => Promise<BackupStatus>) => {
    try {
      await flushDraft();
      setBackup(await change());
    } catch (error) {
      console.error('Could not change the backup schedule', error);
      showToast('Could not change the backup schedule', 'error');
    }
  };

  const chooseRestore = async () => {
    try {
      const backup = await chooseBackup();
      if (!backup) return;
      onCloseSettings();
      setPendingRestore(backup);
    } catch (error) {
      showToast(fileFailure(error, 'Could not open the file'), 'error');
    }
  };

  const isScheduled = backup !== null && backup.frequency !== 'off';
  const last = backup?.last ?? null;
  // A failure matters until a backup has been written since.
  const failure = backup?.failure && (!last || backup.failure.at > last.at) ? backup.failure : null;

  return (
    <>
      <SettingRow
        label="Export this resume"
        description="PDF for applications; Markdown or plain text for anything else; JSON for other tools."
      >
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => {
            onCloseSettings();
            if (hasOpenTemplate) openExport();
            else showToast('Nothing to export yet');
          }}
        >
          <Download />
          Export…
        </AppButton>
      </SettingRow>

      <SettingRow
        label="Import a resume"
        description="Read a Markdown or text resume into the content model, or restore a Mosaic backup."
      >
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => {
            onCloseSettings();
            openImport(!hasOpenTemplate);
          }}
        >
          <Upload />
          Import…
        </AppButton>
      </SettingRow>

      <SettingRow
        label="Full backup"
        description="Every template and its version history in one JSON file. Restoring it rebuilds this app exactly."
      >
        <AppButton variant="outline" size="sm" onClick={() => void chooseRestore()}>
          Restore…
        </AppButton>
        <AppButton size="sm" disabled={backingUp} onClick={() => void backUp()}>
          Back up now
        </AppButton>
      </SettingRow>

      <SettingRow
        label="Scheduled backup"
        description="Writes a dated JSON file to the folder below."
      >
        <Select
          value={backup?.frequency ?? 'off'}
          disabled={!backup}
          onValueChange={(value) =>
            void changeSchedule(() => window.mosaic.backup.setFrequency(value as BackupFrequency))
          }
        >
          <SelectTrigger size="sm" className="w-28" aria-label="Scheduled backup">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {isScheduled && (
        <SettingRow
          label="Backup folder"
          description="A synced folder works. Backups are plain files, separate from the app’s own data."
        >
          {backup.folder && (
            <AppTooltip content={backup.folder}>
              {/* Clipped from the left, so the folder's own name stays in view. The path is
                  isolated, or right-to-left would move its leading "/" or "~" to the end. */}
              <span className="max-w-55 truncate font-mono text-[0.71875rem] tracking-[-0.01em] text-ink-soft [direction:rtl]">
                <bdi>{backup.folder}</bdi>
              </span>
            </AppTooltip>
          )}
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => void changeSchedule(() => window.mosaic.backup.chooseFolder())}
          >
            Change…
          </AppButton>
        </SettingRow>
      )}

      {failure ? (
        <SettingsNote icon={TriangleAlert} className="mt-4">
          The scheduled backup {formatRelativeTime(failure.at)} couldn’t be written.{' '}
          {failure.message}
        </SettingsNote>
      ) : (
        last && (
          <SettingsNote icon={Info} className="mt-4">
            Last backup: <b className="font-semibold">{formatRelativeTime(last.at)}</b> ·{' '}
            {count(last.templates, 'template')}, {count(last.versions, 'version')} ·{' '}
            {formatSize(last.bytes)}
          </SettingsNote>
        )
      )}
    </>
  );
}
