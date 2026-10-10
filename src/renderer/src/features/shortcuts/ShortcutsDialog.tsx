import { Keyboard } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { DialogFrameHeader } from '@/components/DialogFrame';
import { AppDialog, AppDialogContent } from '@/components/AppDialog';
import { useDialog, useOverlayStore } from '@/stores/overlayStore';
import { ShortcutsPanel } from './ShortcutsPanel';

/** The shortcut sheet on its own, from Ctrl/⌘+/ anywhere. Mounted once, in the app shell. */
export function ShortcutsDialog() {
  const { isOpen: open, request } = useDialog('shortcuts');
  const place = request?.place ?? null;
  const closeDialog = useOverlayStore((s) => s.closeDialog);
  const close = () => closeDialog('shortcuts');

  return (
    <AppDialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <AppDialogContent
        showCloseButton={false}
        className="flex h-[min(37.25rem,86vh)] w-[min(53.75rem,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogFrameHeader
          icon={Keyboard}
          title="Keyboard shortcuts"
          description="Every keyboard shortcut in Mosaic, with a search and a lookup by keys."
          closeLabel="Close keyboard shortcuts"
          onClose={close}
        />
        <ShortcutsPanel
          place={place}
          footerAction={
            <AppButton variant="outline" size="xs" onClick={close}>
              Done
            </AppButton>
          }
        />
      </AppDialogContent>
    </AppDialog>
  );
}
