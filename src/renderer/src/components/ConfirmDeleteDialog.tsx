import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { AppButton } from '@/components/kit/AppButton';
import { AppDialog, AppDialogContent, AppDialogDescription } from '@/components/kit/AppDialog';
import {
  DialogFrameBody,
  DialogFrameFooter,
  DialogFrameHeader,
} from '@/components/kit/DialogFrame';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What goes, in a sentence. */
  description: ReactNode;
  /** Anything more to know first, under the description. */
  children?: ReactNode;
  confirmLabel?: string;
  /** The deletion is under way: it can't be asked for twice, and the dialog stays open. */
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
  const close = () => {
    if (!isDeleting) onOpenChange(false);
  };

  return (
    <AppDialog open={open} onOpenChange={(isOpen) => (isOpen ? onOpenChange(true) : close())}>
      <AppDialogContent showCloseButton={false} className="w-[min(32.5rem,96vw)] gap-0 p-0">
        <DialogFrameHeader
          icon={Trash2}
          tone="danger"
          title={title}
          closeLabel="Close"
          onClose={close}
        />
        <DialogFrameBody>
          <AppDialogDescription>{description}</AppDialogDescription>
          {children}
        </DialogFrameBody>
        <DialogFrameFooter>
          <AppButton variant="ghost" size="sm" disabled={isDeleting} onClick={close}>
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
