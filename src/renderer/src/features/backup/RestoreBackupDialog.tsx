import { useState } from 'react';
import { AlertTriangle, ArchiveRestore, FileJson2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent, AppDialogDescription } from '@/components/AppDialog';
import { AppRadioGroup, AppRadioGroupItem } from '@/components/AppRadioGroup';
import { CHOICE_CARD_CLASSES } from '@/components/controlStyles';
import { DialogFrameBody, DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { Note } from '@/components/Note';
import { Text } from '@/components/Text';
import { formatRelativeTime } from '@/features/templates/formatRelativeTime';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { ImportMode, OpenedBackup } from '@shared/types/bundle';
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
    <AppDialog open={backup !== null} onOpenChange={(open) => !open && close()}>
      <AppDialogContent showCloseButton={false} className="w-[min(35rem,96vw)] gap-0 p-0">
        {/* Mounted per file, so the choice starts on the safe option each time. */}
        {backup && <RestoreForm backup={backup} onDone={close} />}
      </AppDialogContent>
    </AppDialog>
  );
}

function RestoreForm({ backup, onDone }: { backup: OpenedBackup; onDone: () => void }) {
  const localCount = useTemplateStore((s) => s.templates.length);
  const importBundle = useTemplateStore((s) => s.importBundle);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
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
    closeSurface('start');
    showToast(
      effectiveMode === 'restore-all'
        ? `Restored ${count(templates, 'template')} from the backup`
        : `Added ${count(templates, 'template')} from the backup`
    );
    onDone();
  };

  return (
    <>
      <DialogFrameHeader
        icon={ArchiveRestore}
        title="Restore a backup"
        closeLabel="Close"
        onClose={onDone}
      />
      <DialogFrameBody>
        <AppDialogDescription>
          {localCount === 0
            ? 'Mosaic has no templates, so the backup’s become yours, with their history.'
            : 'Check what the file holds, then choose what happens to the templates here.'}
        </AppDialogDescription>

        <div className="flex items-start gap-3 rounded-[0.5625rem] border border-line bg-pane p-3">
          <FileJson2 className="mt-0.5 size-4 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <Text as="p" variant="meta" className="truncate text-foreground">
              {backup.fileName}
            </Text>
            <Text as="p" variant="secondary" className="tabular-nums">
              {Number.isNaN(exportedAt) ? '' : `Backed up ${formatRelativeTime(exportedAt)} · `}
              {count(templates, 'template')}, {count(versions, 'version')}
            </Text>
            <Text as="p" variant="secondary" className="mt-1">
              {listNames(backup.bundle.templates.map((entry) => entry.template.name))}
            </Text>
          </div>
        </div>

        {localCount > 0 && (
          <AppRadioGroup
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
          </AppRadioGroup>
        )}

        {replacing && (
          <Note icon={AlertTriangle} tone="warn" size="sm">
            Replacing can’t be undone. Back up first if you might want what’s here.
          </Note>
        )}
      </DialogFrameBody>

      <DialogFrameFooter>
        <AppButton variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </AppButton>
        <AppButton
          variant={replacing ? 'destructive' : 'solid'}
          size="sm"
          disabled={restoring}
          onClick={() => void restore()}
        >
          {replacing
            ? 'Replace everything'
            : effectiveMode === 'restore-all'
              ? 'Restore'
              : `Add ${count(templates, 'template')}`}
        </AppButton>
      </DialogFrameFooter>
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
        CHOICE_CARD_CLASSES.base,
        value === selected ? CHOICE_CARD_CLASSES.chosen : CHOICE_CARD_CLASSES.idle
      )}
    >
      <AppRadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <Text variant="strong" className="block">
          {label}
        </Text>
        <Text variant="secondary" className="mt-0.5 block">
          {description}
        </Text>
      </span>
    </label>
  );
}
