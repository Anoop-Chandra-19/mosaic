import { useState } from 'react';
import { Download, Info, Upload } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  backUpNow,
  chooseBackup,
  fileFailure,
  readLastBackup,
} from '@/features/backup/backupFiles';
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
  const openExport = useOverlayStore((s) => s.openExport);
  const openImport = useOverlayStore((s) => s.openImport);
  const setPendingRestore = useOverlayStore((s) => s.setPendingRestore);
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [backingUp, setBackingUp] = useState(false);

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
      const backup = await chooseBackup();
      if (!backup) return;
      onCloseSettings();
      setPendingRestore(backup);
    } catch (error) {
      showToast(fileFailure(error, 'Could not open the file'), 'error');
    }
  };

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

      {lastBackup && (
        <SettingsNote icon={Info} className="mt-4">
          Last backup: <b className="font-semibold">{formatWhen(lastBackup.at)}</b> ·{' '}
          {count(lastBackup.templates, 'template')}, {count(lastBackup.versions, 'version')} ·{' '}
          {formatSize(lastBackup.bytes)}
        </SettingsNote>
      )}
    </>
  );
}
