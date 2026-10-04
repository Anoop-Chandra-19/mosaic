import { Info } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Note } from '@/components/Note';
import type { TemplateSummary } from '@shared/types/db';

interface DeleteTemplateDialogProps {
  template: TemplateSummary;
  open: boolean;
  /** The template in the editor — its draft goes too. */
  active: boolean;
  /** Nothing will be left open afterwards. */
  last: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

/**
 * Deleting a template takes its history with it, so the confirm names what goes — the open
 * one and the last one included. Nothing is protected just for being last.
 */
export function DeleteTemplateDialog({
  template,
  open,
  active,
  last,
  onOpenChange,
  onDelete,
}: DeleteTemplateDialogProps) {
  const versions = template.versionCount;

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete template"
      description={
        <>
          Delete <b className="font-strong text-foreground">{template.name}</b> and its {versions}{' '}
          {versions === 1 ? 'version' : 'versions'}?
        </>
      }
      confirmLabel="Delete template"
      onConfirm={onDelete}
    >
      <Note icon={Info} size="sm">
        {active && 'This is the template you have open, so your draft goes with it. '}
        {last
          ? 'It is your last one, so Mosaic will be left with nothing open. Export it first if you might want it back.'
          : 'Your other templates are untouched. Export it first if you might want it back.'}
      </Note>
    </ConfirmDeleteDialog>
  );
}
