import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent, AppDialogDescription } from '@/components/AppDialog';
import { DialogFrameBody, DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What goes, in a sentence. */
  description: ReactNode;
  /** Anything more to know first, under the description. */
  children?: ReactNode;
  confirmLabel?: string;
  /** The deletion is under way: it can't be asked for twice. */
  isDeleting?: boolean;
  /** Off for a deletion that takes a while: the dialog stays until it is done. */
  shouldCloseOnConfirm?: boolean;
  onConfirm: () => void;
}

/** The design's delete confirmation: what goes, then Cancel and a red Delete. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Delete',
  isDeleting = false,
  shouldCloseOnConfirm = true,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const confirm = () => {
    onConfirm();
    if (shouldCloseOnConfirm) onOpenChange(false);
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent showCloseButton={false} className="w-[min(32.5rem,96vw)] gap-0 p-0">
        <DialogFrameHeader
          icon={Trash2}
          tone="danger"
          title={title}
          closeLabel="Close"
          onClose={() => onOpenChange(false)}
        />
        <DialogFrameBody>
          <AppDialogDescription>{description}</AppDialogDescription>
          {children}
        </DialogFrameBody>
        <DialogFrameFooter>
          <AppButton variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </AppButton>
          <AppButton variant="destructive" size="sm" disabled={isDeleting} onClick={confirm}>
            <Trash2 />
            {confirmLabel}
          </AppButton>
        </DialogFrameFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
