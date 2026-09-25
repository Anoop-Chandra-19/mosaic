import { Keyboard } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { DialogFrameHeader } from '@/components/DialogFrame';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useOverlayStore } from '@/stores/overlayStore';
import { ShortcutsPanel } from './ShortcutsPanel';

/** The shortcut sheet on its own, from Ctrl/⌘+/ anywhere. Mounted once, in the app shell. */
export function ShortcutsDialog() {
  const open = useOverlayStore((s) => s.shortcutsOpen);
  const setOpen = useOverlayStore((s) => s.setShortcutsOpen);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(37.25rem,86vh)] w-[min(53.75rem,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-line-strong bg-white p-0 sm:max-w-none dark:bg-zinc-950"
      >
        <DialogFrameHeader
          icon={Keyboard}
          title="Keyboard shortcuts"
          description="Every keyboard shortcut in Mosaic, with a search and a lookup by keys."
          closeLabel="Close keyboard shortcuts"
          onClose={close}
        />
        <ShortcutsPanel
          footerAction={
            <AppButton variant="outline" size="xs" onClick={close}>
              Done
            </AppButton>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
