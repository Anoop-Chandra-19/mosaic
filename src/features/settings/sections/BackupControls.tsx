import { useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { exportVaultToFile } from '@/lib/vault/exportVault';
import { parseVault, type VaultErrorCode } from '@/lib/vault/parseVault';
import { applyVault, describeVault, readFileText } from '@/lib/vault/importVault';
import type { MosaicVault } from '@/types/vault';

const IMPORT_ERROR_MESSAGES: Record<VaultErrorCode, string> = {
  'invalid-json': 'That file is not valid JSON.',
  'not-a-vault': 'That file is not a Mosaic backup.',
  'unsupported-version': 'This backup was created by a newer version of Mosaic.',
  'invalid-resume': 'The resume data in this backup is damaged and cannot be imported.',
  'invalid-templates': 'The template data in this backup is damaged and cannot be imported.',
};

const ACTION_BUTTON_CLASS =
  'border-zinc-300 bg-background text-zinc-900 hover:border-zinc-500 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-400 dark:hover:bg-zinc-800';

interface BackupRowProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  error?: string | null;
}

function BackupRow({ title, description, actionLabel, onAction, error }: BackupRowProps) {
  return (
    <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-176">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          {error && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onAction}
            className={ACTION_BUTTON_CLASS}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BackupControls() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingVault, setPendingVault] = useState<MosaicVault | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleExport = () => {
    setFeedback(null);
    setExportError(null);
    try {
      exportVaultToFile();
      setFeedback('Backup downloaded.');
    } catch {
      setExportError('Could not create the backup file.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Reset so selecting the same file again re-fires the change event.
    event.currentTarget.value = '';
    if (!file) return;

    setFeedback(null);
    setImportError(null);

    const text = await readFileText(file);
    if (text === null) {
      setImportError('Could not read that file.');
      return;
    }

    const result = parseVault(text);
    if (!result.ok) {
      setImportError(IMPORT_ERROR_MESSAGES[result.code]);
      return;
    }

    setPendingVault(result.vault);
  };

  const handleConfirmImport = () => {
    if (!pendingVault) return;
    applyVault(pendingVault);
    setPendingVault(null);
    setFeedback('Backup imported.');
  };

  const summary = pendingVault ? describeVault(pendingVault) : null;
  const exportedOn = summary?.exportedAt
    ? new Date(summary.exportedAt).toLocaleDateString()
    : 'an unknown date';

  return (
    <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Backup</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your data lives in this browser. Export a backup file you own.
      </p>

      <div className="mt-3 space-y-3">
        <BackupRow
          title="Export Backup"
          description="Download your resume and templates as a single JSON file."
          actionLabel="Export Backup"
          onAction={handleExport}
          error={exportError}
        />

        <BackupRow
          title="Import Backup"
          description="Restore from a Mosaic backup file. Replaces your current resume and templates."
          actionLabel="Import Backup"
          onAction={() => fileInputRef.current?.click()}
          error={importError}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {feedback && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <ShieldCheck className="size-3" />
          {feedback}
        </p>
      )}

      <Dialog open={pendingVault !== null} onOpenChange={(open) => !open && setPendingVault(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import backup?</DialogTitle>
            <DialogDescription>
              {summary &&
                `Replace your current resume and templates with the backup from ${exportedOn}` +
                  ` (${summary.contactName || 'unnamed'}, ${summary.sectionCount} sections, ` +
                  `${summary.templateCount} templates)? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingVault(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmImport}>
              Replace Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
