import { Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TemplateSummary } from '@/types/db';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4 text-red-600 dark:text-red-400" />
            Delete template
          </DialogTitle>
          <DialogDescription>
            Delete <b className="text-zinc-900 dark:text-zinc-100">{template.name}</b> and its{' '}
            {versions} {versions === 1 ? 'version' : 'versions'}?
          </DialogDescription>
        </DialogHeader>
        <p className="flex gap-2 rounded-lg border border-zinc-300 bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <Info className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
          <span>
            {active &&
              'This is the template you have open — the draft in the editor goes with it. '}
            {last
              ? 'It is your last one, so Mosaic will be left with nothing open. Export it first if you might want it back.'
              : 'Your other templates are untouched. Export it first if you might want it back.'}
          </span>
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete();
              onOpenChange(false);
            }}
          >
            <Trash2 />
            Delete template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
