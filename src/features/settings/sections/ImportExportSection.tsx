import { useState } from 'react';
import { Download, Info, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  backUpNow,
  chooseBackup,
  readLastBackup,
  UnreadableBackupError,
  type OpenedBackup,
} from '@/features/backup/backupFiles';
import { RestoreBackupDialog } from '@/features/backup/RestoreBackupDialog';
import { formatWhen } from '@/features/templates/formatWhen';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { SettingRow, SettingsNote } from '../SettingRow';

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
  const setExportOpen = useOverlayStore((s) => s.setExportOpen);
  const openImport = useOverlayStore((s) => s.openImport);
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<OpenedBackup | null>(null);

  const backUp = async () => {
    if (!hasTemplates) {
      showToast('Nothing to back up yet');
      return;
    }
    setBackingUp(true);
    try {
      const saved = await backUpNow();
      if (!saved) return;
      setLastBackup(saved.record);
      showToast(`Backed up to ${saved.fileName}`);
    } catch (error) {
      console.error('Could not write the backup', error);
      showToast('Could not write the backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const chooseRestore = async () => {
    try {
      setRestoring(await chooseBackup());
    } catch (error) {
      if (!(error instanceof UnreadableBackupError)) console.error(error);
      showToast(
        error instanceof UnreadableBackupError ? error.message : 'Could not open the file',
        'error'
      );
    }
  };

  return (
    <>
      <SettingRow
        label="Export this resume"
        description="PDF for applications; Markdown, plain text, or JSON for anything else."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onCloseSettings();
            if (hasOpenTemplate) setExportOpen(true);
            else showToast('Nothing to export yet');
          }}
        >
          <Download />
          Export…
        </Button>
      </SettingRow>

      <SettingRow
        label="Import a resume"
        description="Paste a resume’s text and review how Mosaic reads it before anything is written."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onCloseSettings();
            openImport(!hasOpenTemplate);
          }}
        >
          <Upload />
          Import…
        </Button>
      </SettingRow>

      <SettingRow
        label="Full backup"
        description="Every template and its version history in one JSON file. Restoring it rebuilds this app exactly."
      >
        <Button variant="outline" size="sm" onClick={() => void chooseRestore()}>
          Restore…
        </Button>
        <Button size="sm" disabled={backingUp} onClick={() => void backUp()}>
          Back up now
        </Button>
      </SettingRow>

      {lastBackup && (
        <SettingsNote icon={Info} className="mt-4">
          Last backup: <b className="font-semibold">{formatWhen(lastBackup.at)}</b> ·{' '}
          {count(lastBackup.templates, 'template')}, {count(lastBackup.versions, 'version')} ·{' '}
          {formatSize(lastBackup.bytes)}
        </SettingsNote>
      )}

      <RestoreBackupDialog backup={restoring} onClose={() => setRestoring(null)} />
    </>
  );
}
