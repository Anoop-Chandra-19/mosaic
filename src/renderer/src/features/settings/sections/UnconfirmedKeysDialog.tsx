import { KeyRound } from 'lucide-react';
import {
  AppButton,
  AppDialog,
  AppDialogContent,
  AppDialogDescription,
  DialogFrameBody,
  DialogFrameFooter,
  DialogFrameHeader,
} from '@/components/ui-kit';
import type { KeyedProvider } from '@shared/types/secrets';
import { describeUnconfirmedKeys } from './ai/apiKeyWords';

interface UnconfirmedKeysDialogProps {
  /** Empty: the dialog is closed. */
  providers: KeyedProvider[];
  /** What happens on closing: done after Forget, starting over after Erase. */
  closeLabel: string;
  onClose: () => void;
}

/** After Forget or Erase: keychain entries Mosaic had no record of that wouldn't go. */
export function UnconfirmedKeysDialog({
  providers,
  closeLabel,
  onClose,
}: UnconfirmedKeysDialogProps) {
  return (
    <AppDialog open={providers.length > 0} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AppDialogContent showCloseButton={false} className="w-[min(32.5rem,96vw)] gap-0 p-0">
        <DialogFrameHeader
          icon={KeyRound}
          title="Check your keychain"
          closeLabel={closeLabel}
          onClose={onClose}
        />
        <DialogFrameBody>
          <AppDialogDescription>{describeUnconfirmedKeys(providers)}</AppDialogDescription>
        </DialogFrameBody>
        <DialogFrameFooter>
          <AppButton size="sm" onClick={onClose}>
            {closeLabel}
          </AppButton>
        </DialogFrameFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
