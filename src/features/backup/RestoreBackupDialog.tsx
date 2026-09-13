import { useState } from 'react';
import { AlertTriangle, ArchiveRestore, FileJson2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatWhen } from '@/features/templates/formatWhen';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { ImportMode, OpenedBackup } from '@/types/bundle';
import { countBundle } from './backupFiles';

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Backend, Frontend, and 2 more" */
function listNames(names: string[], shown = 3): string {
  if (names.length <= shown) return names.join(', ');
  return `${names.slice(0, shown).join(', ')}, and ${names.length - shown} more`;
}

/**
 * Confirm what a backup holds before anything is written. With templates already here,
 * the user chooses: add the backup's beside them, or replace everything with it. Open
 * while `pendingRestore` holds a file — from Settings, the Import dialog, or Start.
 */
export function RestoreBackupDialog() {
  const backup = useOverlayStore((s) => s.pendingRestore);
  const setPendingRestore = useOverlayStore((s) => s.setPendingRestore);
  const close = () => setPendingRestore(null);

  return (
    <Dialog open={backup !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted per file, so the choice starts on the safe option each time. */}
        {backup && <RestoreForm backup={backup} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function RestoreForm({ backup, onDone }: { backup: OpenedBackup; onDone: () => void }) {
  const localCount = useTemplateStore((s) => s.templates.length);
  const importBundle = useTemplateStore((s) => s.importBundle);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const [mode, setMode] = useState<ImportMode>('as-new-template');
  const [restoring, setRestoring] = useState(false);

  const { templates, versions } = countBundle(backup.bundle);
  const exportedAt = Date.parse(backup.bundle.exportedAt);
  // Nothing here to keep or lose: restore it exactly, ids and all.
  const effectiveMode: ImportMode = localCount === 0 ? 'restore-all' : mode;
  const replacing = effectiveMode === 'restore-all' && localCount > 0;

  const restore = async () => {
    setRestoring(true);
    const restored = await attempt(
      importBundle(backup.text, effectiveMode),
      'Could not restore the backup'
    );
    setRestoring(false);
    if (!restored) return;
    // Chosen from the Start panel: there is a template open now.
    setStartOpen(false);
    showToast(
      effectiveMode === 'restore-all'
        ? `Restored ${count(templates, 'template')} from the backup`
        : `Added ${count(templates, 'template')} from the backup`
    );
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArchiveRestore className="size-4 text-zinc-500" />
          Restore a backup
        </DialogTitle>
        <DialogDescription>
          {localCount === 0
            ? 'Mosaic has no templates, so the backup’s become yours, with their history.'
            : 'Check what the file holds, then choose what happens to the templates here.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <FileJson2 className="mt-0.5 size-4 shrink-0 text-zinc-500" />
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="truncate font-mono text-zinc-900 dark:text-zinc-100">{backup.fileName}</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            {Number.isNaN(exportedAt) ? '' : `Backed up ${formatWhen(exportedAt)} · `}
            {count(templates, 'template')}, {count(versions, 'version')}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {listNames(backup.bundle.templates.map((entry) => entry.template.name))}
          </p>
        </div>
      </div>

      {localCount > 0 && (
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ImportMode)}
          aria-label="What happens to the templates here"
          className="gap-2"
        >
          <ModeOption
            value="as-new-template"
            selected={mode}
            label="Add as new templates"
            description={`Keeps everything here and adds the backup’s ${count(templates, 'template')} beside it.`}
          />
          <ModeOption
            value="restore-all"
            selected={mode}
            label="Replace everything"
            description={`Deletes the ${count(localCount, 'template')} here, history included, and rebuilds Mosaic from the backup.`}
          />
        </RadioGroup>
      )}

      {replacing && (
        <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Replacing can’t be undone. Back up first if you might want what’s here.</span>
        </p>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant={replacing ? 'destructive' : 'default'}
          disabled={restoring}
          onClick={() => void restore()}
        >
          {replacing
            ? 'Replace everything'
            : effectiveMode === 'restore-all'
              ? 'Restore'
              : `Add ${count(templates, 'template')}`}
        </Button>
      </DialogFooter>
    </>
  );
}

function ModeOption({
  value,
  selected,
  label,
  description,
}: {
  value: ImportMode;
  selected: ImportMode;
  label: string;
  description: string;
}) {
  const id = `restore-mode-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        value === selected
          ? 'border-amber-500 bg-zinc-50 dark:border-amber-600 dark:bg-zinc-900'
          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}
