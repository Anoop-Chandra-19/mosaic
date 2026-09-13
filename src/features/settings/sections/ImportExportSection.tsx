import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { SettingRow } from '../SettingRow';

/** Both open their own dialog, so Settings steps out of the way first. */
export function ImportExportSection({ onCloseSettings }: { onCloseSettings: () => void }) {
  const hasOpenTemplate = useResumeStore((s) => s.templateId !== null);
  const setExportOpen = useOverlayStore((s) => s.setExportOpen);
  const openImport = useOverlayStore((s) => s.openImport);

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
    </>
  );
}
